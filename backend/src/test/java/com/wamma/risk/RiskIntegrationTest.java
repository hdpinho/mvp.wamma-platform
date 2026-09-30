package com.wamma.risk;

import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.wamma.crm.CaptureRateLimiter;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class RiskIntegrationTest extends ApiIntegrationTest {

    @Autowired
    private CaptureRateLimiter captureRateLimiter;

    private TestAccounts.Account analyst;
    private UUID applicationId;
    private String token;

    @BeforeEach
    void setUp() {
        captureRateLimiter.reset();
        analyst = accounts.createAndLogin("analista_riesgo", "ANALISTA_CREDITO");

        String uid = UUID.randomUUID().toString().substring(0, 6);
        String code = "WAM-" + (10000 + (int)(Math.random() * 89999));
        String vin = "VIN" + uid.toUpperCase();

        UUID vehicleId = jdbc.sql("""
                        insert into vehiculo (codigo, vin, marca, modelo, version, anio, color, kilometraje,
                                              carroceria, transmision, combustible, traccion, puestos, estado,
                                              sede_id, precio_adquisicion, moneda_adquisicion, tasa_bcv_adquisicion,
                                              fecha_tasa_adquisicion, es_demostracion)
                        select :code, :vin, 'Toyota', 'Yaris', 'XLi', 2021, 'Blanco', 15000,
                               'sedan', 'automatica', 'gasolina', '4x2', 5, 'exhibicion',
                               id, 10000, 'EUR', 54.25, current_date, true
                        from sede where codigo = 'DC'
                        returning id
                        """)
                .param("code", code)
                .param("vin", vin)
                .query(UUID.class)
                .single();

        jdbc.sql("""
                INSERT INTO publicacion (vehiculo_id, titulo, precio_venta, moneda, tasa_bcv, fecha_tasa, estado, publicado_en)
                VALUES (:vId, 'Toyota Yaris 2021', 14000, 'EUR', 54.25, current_date, 'publicado', now())
                """)
                .param("vId", vehicleId, java.sql.Types.OTHER)
                .update();

        // Crear cita y oportunidad
        TestApi.Response citaRes = api.post("/v1/citas", null, Map.of(
                "nombreApellido", "Carlos Riesgo",
                "telefonoWhatsApp", "+58412" + (1000000 + (int)(Math.random() * 8999999)),
                "correo", "carlos.riesgo." + uid + "@example.com",
                "vehiculoId", vehicleId.toString(),
                "diaPreferencia", LocalDate.now().plusDays(1).toString(),
                "franjaHoraria", "tarde",
                "modalidadPago", "financiamiento"
        ));
        String citaId = citaRes.str("id");

        TestAccounts.Account advisor = accounts.createAndLogin("asesor_com", "ASESOR_COMERCIAL");
        api.post("/v1/crm/citas/" + citaId + "/confirmacion", advisor.token(),
                Map.of("cedula", "V" + (20000000 + (int)(Math.random() * 9999999)), "correo", "carlos.riesgo." + uid + "@example.com"));

        UUID oppId = jdbc.sql("select oportunidad_id from cita_inspeccion where id = :id")
                .param("id", UUID.fromString(citaId), java.sql.Types.OTHER)
                .query(UUID.class)
                .single();

        TestApi.Response saleRes = api.post("/v1/crm/oportunidades/" + oppId + "/venta", advisor.token(),
                Map.of("modalidad", "financiamiento"));
        token = saleRes.str("tokenFinanciamiento");

        // Enviar solicitud de crédito
        TestApi.Response appRes = api.post("/v1/solicitudes-credito", null, Map.ofEntries(
                Map.entry("token", token),
                Map.entry("vehiculoId", vehicleId.toString()),
                Map.entry("montoSolicitado", 10000.00),
                Map.entry("cuotaInicial", 4000.00),
                Map.entry("plazoMeses", 24),
                Map.entry("frecuenciaPago", "MENSUAL"),
                Map.entry("cuotaEstimada", 350.00),
                Map.entry("capacidadPagoMensual", 1800.00),
                Map.entry("datosPersonales", Map.of("primerNombre", "Carlos", "primerApellido", "Riesgo", "cargasFamiliares", 1)),
                Map.entry("datosContacto", Map.of("tipoVivienda", "PROPIA")),
                Map.entry("datosLaborales", Map.of("tipoOcupacion", "EMPLEADO_PRIVADO", "antiguedadAnios", 5)),
                Map.entry("datosFinancieros", Map.of("ingresoMensual", 1800.00)),
                Map.entry("referencias", List.of(Map.of("nombre", "Ref Uno", "telefono", "0412"))),
                Map.entry("datosBancarios", Map.of("banco", "Banesco", "tipoCuenta", "CORRIENTE")),
                Map.entry("declaraciones", Map.of("esPep", false)),
                Map.entry("recaudos", List.of()),
                Map.entry("otpVerificado", true)
        ));

        assertThat(appRes.status()).isEqualTo(200);
        applicationId = UUID.fromString(appRes.str("id"));
    }

    @Test
    @DisplayName("Motor de riesgo ejecuta scoring, genera recomendación y persiste decisión")
    void evaluateApplicationEngineExecutesAndPersists() {
        TestApi.Response res = api.post("/v1/riesgo/solicitudes/" + applicationId + "/evaluar-motor", analyst.token(), Map.of());

        assertThat(res.status()).isEqualTo(200);
        int score = ((Number) res.map().get("scoreInterno")).intValue();
        assertThat(score).isGreaterThanOrEqualTo(750);
        assertThat(res.str("riesgoNivel")).isEqualTo("bajo");
        assertThat(res.str("recomendacion")).isEqualTo("APROBAR");
        assertThat((Boolean) res.map().get("alertaCapacidad")).isFalse();
        assertThat((Boolean) res.map().get("bloqueoAml")).isFalse();

        // Verificar persistencia en decision_riesgo
        Integer scoreDb = jdbc.sql("SELECT score_interno FROM decision_riesgo WHERE solicitud_id = :id")
                .param("id", applicationId, java.sql.Types.OTHER)
                .query(Integer.class)
                .optional()
                .orElse(null);

        assertThat(scoreDb).isNotNull();
        assertThat(scoreDb).isEqualTo(score);
    }

    @Test
    @DisplayName("Cotejo AML genera alerta y permite resolución por el oficial")
    void amlAlertLifecycleCanBeResolved() {
        // Insertar alerta manual para la solicitud
        UUID alertId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO alerta_aml (id, solicitud_id, persona_id, regla_coincidencia, severidad, origen_lista, resolucion, creado_en)
                SELECT :aId, s.id, s.persona_id, 'Regla Test Homonimia', 'media', 'PEP_NACIONAL', 'pendiente', now()
                FROM solicitud_credito s WHERE s.id = :sId
                """)
                .param("aId", alertId, java.sql.Types.OTHER)
                .param("sId", applicationId, java.sql.Types.OTHER)
                .update();

        // Listar alertas
        TestApi.Response listRes = api.get("/v1/riesgo/alertas-aml?resolucion=pendiente", analyst.token());
        assertThat(listRes.status()).isEqualTo(200);
        assertThat(listRes.body().toString()).contains("Regla Test Homonimia");

        // Resolver alerta como falso positivo
        TestApi.Response resolveRes = api.patch("/v1/riesgo/alertas-aml/" + alertId + "/resolucion", analyst.token(), Map.of(
                "resolucion", "falso_positivo",
                "notas", "Documento y segundo apellido no coinciden con la persona sancionada."
        ));

        assertThat(resolveRes.status()).isEqualTo(200);

        String resolucionDb = jdbc.sql("SELECT resolucion FROM alerta_aml WHERE id = :id")
                .param("id", alertId, java.sql.Types.OTHER)
                .query(String.class)
                .single();

        assertThat(resolucionDb).isEqualTo("falso_positivo");
    }
}
