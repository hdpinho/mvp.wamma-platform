package com.wamma.credit.application;

import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CreditApplicationIntegrationTest extends ApiIntegrationTest {

    private TestAccounts.Account advisor;
    private UUID vehicleId;
    private UUID opportunityId;
    private String financingToken;
    private String testCedula;

    @BeforeEach
    void setUpTestData() {
        advisor = accounts.createAndLogin("asesor_cred", "ASESOR_COMERCIAL");

        String uid = UUID.randomUUID().toString().substring(0, 6);
        String code = "WAM-" + (10000 + (int)(Math.random() * 89999));
        String vin = "VIN" + uid.toUpperCase();
        testCedula = "V" + (25000000 + (int)(Math.random() * 8999999));

        // 1. Vehículo publicado
        vehicleId = jdbc.sql("""
                        insert into vehiculo (codigo, vin, marca, modelo, version, anio, color, kilometraje,
                                              carroceria, transmision, combustible, traccion, puestos, estado,
                                              sede_id, precio_adquisicion, moneda_adquisicion, tasa_bcv_adquisicion,
                                              fecha_tasa_adquisicion, es_demostracion)
                        select :code, :vin, 'Toyota', 'Corolla', 'XLi', 2021, 'Blanco', 15000,
                               'sedan', 'automatica', 'gasolina', '4x2', 5, 'exhibicion',
                               id, 12000, 'EUR', 54.25, current_date, true
                        from sede where codigo = 'DC'
                        returning id
                        """)
                .param("code", code)
                .param("vin", vin)
                .query(UUID.class)
                .single();

        jdbc.sql("""
                INSERT INTO publicacion (vehiculo_id, titulo, precio_venta, moneda, tasa_bcv, fecha_tasa, estado, etiqueta, publicado_en)
                VALUES (:vId, 'Toyota Corolla 2021', 18000, 'EUR', 54.25, current_date, 'publicado', 'recien_ingresado', now())
                """)
                .param("vId", vehicleId, java.sql.Types.OTHER)
                .update();

        // 2. Agendar cita pública para generar oportunidad
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        TestApi.Response citaRes = api.post("/v1/citas", null, Map.of(
                "nombreApellido", "Carlos Rodriguez",
                "telefonoWhatsApp", "+58412" + (1000000 + (int)(Math.random() * 8999999)),
                "correo", "carlos." + uid + "@example.com",
                "vehiculoId", vehicleId.toString(),
                "diaPreferencia", tomorrow.toString(),
                "franjaHoraria", "manana",
                "modalidadPago", "financiamiento"
        ));
        assertThat(citaRes.status()).isEqualTo(201);
        String citaId = citaRes.str("id");

        // 3. Confirmar cita como asesor
        TestApi.Response confRes = api.post("/v1/crm/citas/" + citaId + "/confirmacion",
                advisor.token(), Map.of("cedula", testCedula, "correo", "carlos." + uid + "@example.com"));
        assertThat(confRes.status()).isEqualTo(200);

        opportunityId = jdbc.sql("select oportunidad_id from cita_inspeccion where id = :id")
                .param("id", UUID.fromString(citaId), java.sql.Types.OTHER)
                .query(UUID.class)
                .single();

        // 4. Asistencia
        TestApi.Response attendRes = api.post("/v1/crm/citas/" + citaId + "/asistencia",
                advisor.token(), null);
        assertThat(attendRes.status()).isEqualTo(204);

        // 5. Venta financiada -> genera token
        TestApi.Response sellRes = api.post("/v1/crm/oportunidades/" + opportunityId + "/venta",
                advisor.token(), Map.of("modalidad", "financiamiento"));
        assertThat(sellRes.status()).isEqualTo(200);
        financingToken = sellRes.str("tokenFinanciamiento");
        assertThat(financingToken).isNotBlank();
    }

    @Test
    void publicCanValidateFinancingLinkAndGetPrefillData() {
        TestApi.Response res = api.get("/v1/solicitudes-credito/enlace/" + financingToken, null);
        assertThat(res.status()).isEqualTo(200);

        Map<String, Object> body = res.map();
        assertThat(body.get("valid")).isEqualTo(true);
        assertThat(body.get("opportunityId")).isEqualTo(opportunityId.toString());

        Map<String, Object> vehicle = res.obj("vehicle");
        assertThat(vehicle.get("brand")).isEqualTo("Toyota");
        assertThat(vehicle.get("model")).isEqualTo("Corolla");
        assertThat(vehicle.get("priceEur")).isNotNull();

        Map<String, Object> applicant = res.obj("applicant");
        assertThat(applicant.get("nationalId")).isEqualTo(testCedula);
        assertThat(applicant.get("phone")).isNotNull();

        Map<String, Object> params = res.obj("financingParams");
        assertThat(params.get("minDownPaymentPercentage")).isNotNull();
    }

    @Test
    void submitCreditApplicationFlowEndToEnd() {
        String adminToken = accounts.adminToken();

        // 1. Enviar la solicitud de crédito con datos WMA-F-FIN-001
        Map<String, Object> req = Map.ofEntries(
                Map.entry("token", financingToken),
                Map.entry("vehiculoId", vehicleId.toString()),
                Map.entry("montoSolicitado", 14400),
                Map.entry("cuotaInicial", 3600),
                Map.entry("plazoMeses", 24),
                Map.entry("frecuenciaPago", "Mensual"),
                Map.entry("cuotaEstimada", 750.50),
                Map.entry("capacidadPagoMensual", 900.00),
                Map.entry("datosPersonales", Map.of(
                        "primerNombre", "Carlos",
                        "primerApellido", "Rodriguez",
                        "tipoDocumento", "V",
                        "numeroDocumento", testCedula.substring(1),
                        "estadoCivil", "Soltero(a)"
                )),
                Map.entry("datosContacto", Map.of(
                        "telefonoCelular", "+584121234567",
                        "correo", "carlos@example.com",
                        "estado", "Miranda",
                        "municipio", "Chacao"
                )),
                Map.entry("datosLaborales", Map.of(
                        "situacionLaboral", "Empleado Fijo",
                        "empresa", "Empresa C.A.",
                        "cargo", "Gerente"
                )),
                Map.entry("datosFinancieros", Map.of(
                        "sueldoMensual", 3000,
                        "otrosIngresos", 0
                )),
                Map.entry("referencias", List.of(
                        Map.of("nombre", "Maria Perez", "parentesco", "Madre", "telefono", "04141112233")
                )),
                Map.entry("datosBancarios", Map.of(
                        "banco", "0102 - Banco de Venezuela",
                        "tipoCuenta", "Corriente",
                        "numeroCuenta", "01020000000000000000"
                )),
                Map.entry("declaraciones", Map.of(
                        "veracidad", true,
                        "centralesRiesgo", true,
                        "origenFondos", true,
                        "compromisoPago", true
                )),
                Map.entry("recaudos", List.of(
                        Map.of("documentType", "cedula", "fileUrl", "/archivos/recaudos/test-ci.jpg", "fileName", "cedula.jpg"),
                        Map.of("documentType", "rif", "fileUrl", "/archivos/recaudos/test-rif.jpg", "fileName", "rif.jpg")
                )),
                Map.entry("codigoOtp", "123456"),
                Map.entry("otpVerificado", true)
        );

        TestApi.Response submitRes = api.post("/v1/solicitudes-credito", null, req);
        assertThat(submitRes.status()).isEqualTo(200);

        String appId = submitRes.str("id");
        String numeroSolicitud = submitRes.str("numeroSolicitud");
        assertThat(appId).isNotBlank();
        assertThat(numeroSolicitud).startsWith("SOL-");
        assertThat(submitRes.str("estado")).isEqualTo("enviada");

        // 2. Verificar que el token quedó usado y no se puede reutilizar
        TestApi.Response duplicateRes = api.post("/v1/solicitudes-credito", null, req);
        assertThat(duplicateRes.status()).isEqualTo(422);

        // 3. Consulta de estado pública por número de solicitud
        TestApi.Response statusRes = api.get("/v1/solicitudes-credito/" + numeroSolicitud + "/estado", null);
        assertThat(statusRes.status()).isEqualTo(200);
        assertThat(statusRes.str("numeroSolicitud")).isEqualTo(numeroSolicitud);
        assertThat(statusRes.str("estado")).isEqualTo("enviada");

        // 4. Backoffice: Listado de solicitudes de crédito
        TestApi.Response listRes = api.get("/v1/solicitudes-credito", adminToken);
        assertThat(listRes.status()).isEqualTo(200);
        List<Object> apps = listRes.list();
        assertThat(apps).isNotEmpty();

        // 5. Backoffice: Expediente digital completo
        TestApi.Response detailRes = api.get("/v1/solicitudes-credito/" + appId, adminToken);
        assertThat(detailRes.status()).isEqualTo(200);
        assertThat(detailRes.str("numeroSolicitud")).isEqualTo(numeroSolicitud);
        assertThat(detailRes.str("moneda")).isEqualTo("EUR");
        List<?> recaudos = (List<?>) detailRes.map().get("recaudos");
        assertThat(recaudos).hasSize(2);

        // 6. Backoffice: Evaluar solicitud (aprobación analista)
        TestApi.Response evalRes = api.post("/v1/solicitudes-credito/" + appId + "/evaluacion",
                adminToken, Map.of(
                        "resultado", "aprobado",
                        "scoreInterno", 780,
                        "scoreBuro", 750,
                        "riesgoNivel", "bajo",
                        "limiteAprobado", 15000,
                        "cuotaMaximaPermitida", 1000,
                        "justificacion", "Cumple capacidad de pago y recaudos conformes"
                ));
        assertThat(evalRes.status()).isEqualTo(200);

        // 7. Verificar que el estado cambió a 'aprobada'
        TestApi.Response updatedDetailRes = api.get("/v1/solicitudes-credito/" + appId, adminToken);
        assertThat(updatedDetailRes.str("estado")).isEqualTo("aprobada");
        assertThat(updatedDetailRes.obj("decisionRiesgo").get("result")).isEqualTo("aprobado");
    }
}
