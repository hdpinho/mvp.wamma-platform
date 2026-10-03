package com.wamma.crm;

import com.wamma.inventory.VehicleRepository;
import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CrmApiIntegrationTest extends ApiIntegrationTest {

    @Autowired
    private CaptureRateLimiter captureRateLimiter;

    private TestAccounts.Account coordinator;
    private TestAccounts.Account advisor;
    private UUID testVehicleId;

    @BeforeEach
    void setUpCrm() {
        // El límite de citas por IP vive en memoria y es compartido por todas las pruebas.
        captureRateLimiter.reset();
        coordinator = accounts.createAndLogin("coordinador_crm", "COORDINADOR_COMERCIAL");
        advisor = accounts.createAndLogin("asesor_crm", "ASESOR_COMERCIAL");

        // Crear vehículo en estado exhibición para las pruebas (código y VIN únicos por prueba)
        String sufijo = String.valueOf(10000 + (int) (Math.random() * 89999));
        testVehicleId = jdbc.sql("""
                        insert into vehiculo (codigo, vin, marca, modelo, version, anio, color, kilometraje,
                                              carroceria, transmision, combustible, traccion, puestos, estado,
                                              sede_id, precio_adquisicion, moneda_adquisicion, tasa_bcv_adquisicion,
                                              fecha_tasa_adquisicion, es_demostracion)
                        select :codigo, :vin, 'Toyota', 'Corolla', 'XLi', 2021, 'Blanco', 15000,
                               'sedan', 'automatica', 'gasolina', '4x2', 5, 'exhibicion',
                               id, 12000, 'EUR', 45.0, current_date, true
                        from sede where codigo = 'DC'
                        returning id
                        """)
                .param("codigo", "WAM-" + sufijo)
                .param("vin", "CRMTEST0000" + sufijo)
                .query(UUID.class)
                .single();

        jdbc.sql("""
                        insert into publicacion (vehiculo_id, titulo, precio_venta, moneda, tasa_bcv, fecha_tasa,
                                                 estado, etiqueta, publicado_en)
                        values (:vId, 'Toyota Corolla 2021', 14500, 'EUR', 45.0, current_date, 'publicado',
                                'recien_ingresado', now())
                        """)
                .param("vId", testVehicleId, java.sql.Types.OTHER)
                .update();
    }

    @Test
    void completeCrmWorkflowFromPublicSchedulingToSale() {
        LocalDate tomorrow = LocalDate.now().plusDays(1);

        // 1. Agendamiento público
        TestApi.Response scheduleRes = api.post("/v1/citas", null, Map.of(
                "nombreApellido", "Pedro Pérez",
                "telefonoWhatsApp", "+584141112233",
                "correo", "pedro@ejemplo.invalid",
                "diaPreferencia", tomorrow.toString(),
                "franjaHoraria", "tarde",
                "modalidadPago", "financiamiento",
                "vehiculoId", testVehicleId.toString()
        ));

        assertThat(scheduleRes.status()).isEqualTo(201);
        String appointmentIdStr = scheduleRes.str("id");
        UUID appointmentId = UUID.fromString(appointmentIdStr);

        // Vehículo quedó reservado
        String vehicleState = jdbc.sql("select estado from vehiculo where id = :id")
                .param("id", testVehicleId, java.sql.Types.OTHER)
                .query(String.class)
                .single();
        assertThat(vehicleState).isEqualTo("reservado");

        // Intentar agendar el mismo vehículo debe fallar con 409
        TestApi.Response duplicateSchedule = api.post("/v1/citas", null, Map.of(
                "nombreApellido", "Otro Cliente",
                "telefonoWhatsApp", "+584129998877",
                "diaPreferencia", tomorrow.toString(),
                "franjaHoraria", "manana",
                "modalidadPago", "contado",
                "vehiculoId", testVehicleId.toString()
        ));
        assertThat(duplicateSchedule.status()).isEqualTo(409);

        // 2. El asesor consulta la bandeja de citas
        TestApi.Response listCitas = api.get("/v1/crm/citas?estado=pendiente", advisor.token());
        assertThat(listCitas.status()).isEqualTo(200);
        assertThat(listCitas.list().size()).isGreaterThanOrEqualTo(1);

        // 3. Confirmar cita (ingresando cédula)
        TestApi.Response confirmRes = api.post("/v1/crm/citas/" + appointmentId + "/confirmacion",
                advisor.token(), Map.of(
                        "cedula", "V-19876543",
                        "correo", "pedro.perez@confirmado.invalid"
                ));
        assertThat(confirmRes.status()).isEqualTo(200);
        assertThat(confirmRes.map().get("ok")).isEqualTo(true);

        // 4. Asistencia a la cita
        TestApi.Response attendRes = api.post("/v1/crm/citas/" + appointmentId + "/asistencia",
                advisor.token(), null);
        assertThat(attendRes.status()).isEqualTo(204);

        // 5. Consultar oportunidad y verificar avance a 'visito'
        UUID oppId = jdbc.sql("select oportunidad_id from cita_inspeccion where id = :id")
                .param("id", appointmentId, java.sql.Types.OTHER)
                .query(UUID.class)
                .single();

        TestApi.Response oppRes = api.get("/v1/crm/oportunidades/" + oppId, advisor.token());
        assertThat(oppRes.status()).isEqualTo(200);
        assertThat(oppRes.str("etapa")).isEqualTo("visito");

        // 6. Venta con financiamiento
        TestApi.Response sellRes = api.post("/v1/crm/oportunidades/" + oppId + "/venta",
                advisor.token(), Map.of("modalidad", "financiamiento"));
        assertThat(sellRes.status()).isEqualTo(200);
        String token = sellRes.str("tokenFinanciamiento");
        assertThat(token).isNotBlank();

        // 7. Validar el enlace de financiamiento de forma pública
        TestApi.Response linkRes = api.get("/v1/enlaces-financiamiento/" + token, null);
        assertThat(linkRes.status()).isEqualTo(200);
        assertThat(linkRes.map().get("valid")).isEqualTo(true);
        assertThat(linkRes.obj("vehicle").get("brand")).isEqualTo("Toyota");

        // 8. Registrar una interacción
        UUID personId = jdbc.sql("select persona_id from oportunidad where id = :id")
                .param("id", oppId, java.sql.Types.OTHER)
                .query(UUID.class)
                .single();

        TestApi.Response interRes = api.post("/v1/crm/personas/" + personId + "/interacciones",
                advisor.token(), Map.of(
                        "canal", "whatsapp",
                        "direccion", "saliente",
                        "nota", "Enlace de financiamiento enviado por WhatsApp.",
                        "oportunidadId", oppId.toString()
                ));
        assertThat(interRes.status()).isEqualTo(200);
        assertThat(interRes.str("nota")).isEqualTo("Enlace de financiamiento enviado por WhatsApp.");

        // 9. Ficha 360 de la persona
        TestApi.Response personDetail = api.get("/v1/crm/personas/" + personId, advisor.token());
        assertThat(personDetail.status()).isEqualTo(200);
        assertThat(personDetail.str("nombreApellido")).isEqualTo("Pedro Pérez");
        assertThat(((List<?>) personDetail.map().get("interacciones")).size()).isGreaterThanOrEqualTo(1);
    }

    /**
     * Visibilidad por rol (plan 010 §7, CA-010.8, D-48): el asesor ve y opera lo suyo y lo que no
     * tiene dueño, y solo puede tomarlo para sí. Lo de otro asesor es un 404 que queda en la
     * bitácora; el coordinador lo ve todo.
     */
    @Test
    void anAdvisorOnlySeesAndOperatesTheirOwnOrUnassignedRecords() {
        TestAccounts.Account other = accounts.createAndLogin("asesor_otro", "ASESOR_COMERCIAL");
        String nombre = "Lucia Ajena " + UUID.randomUUID().toString().substring(0, 6);
        TestApi.Response scheduleRes = api.post("/v1/citas", null, Map.of(
                "nombreApellido", nombre,
                "telefonoWhatsApp", "+58414" + (1000000 + (int) (Math.random() * 8999999)),
                "diaPreferencia", LocalDate.now().plusDays(1).toString(),
                "franjaHoraria", "tarde",
                "modalidadPago", "financiamiento",
                "vehiculoId", testVehicleId.toString()));
        assertThat(scheduleRes.status()).isEqualTo(201);
        UUID appointmentId = UUID.fromString(scheduleRes.str("id"));
        UUID oppId = jdbc.sql("select oportunidad_id from cita_inspeccion where id = :id")
                .param("id", appointmentId, java.sql.Types.OTHER)
                .query(UUID.class).single();
        UUID personId = jdbc.sql("select persona_id from oportunidad where id = :id")
                .param("id", oppId, java.sql.Types.OTHER)
                .query(UUID.class).single();

        // Sin dueño la ven los dos asesores, pero ninguno puede dársela a otro.
        assertThat(api.get("/v1/crm/oportunidades/" + oppId, other.token()).status()).isEqualTo(200);
        assertThat(api.put("/v1/crm/oportunidades/" + oppId + "/asesor", other.token(),
                Map.of("asesorId", advisor.id().toString())).status()).isEqualTo(403);

        // El asesor la toma para sí.
        TestApi.Response taken = api.put("/v1/crm/oportunidades/" + oppId + "/asesor", advisor.token(), Map.of());
        assertThat(taken.status()).isEqualTo(200);
        assertThat(taken.str("asesorId")).isEqualTo(advisor.id().toString());

        // Para el otro asesor ahora es ajena: 404 en todo, sin confirmar que existe.
        String ajeno = other.token();
        assertThat(api.get("/v1/crm/oportunidades/" + oppId, ajeno).status()).isEqualTo(404);
        assertThat(api.patch("/v1/crm/oportunidades/" + oppId + "/etapa", ajeno,
                Map.of("etapa", "contactado", "version", 1)).status()).isEqualTo(404);
        assertThat(api.put("/v1/crm/oportunidades/" + oppId + "/proxima-accion", ajeno,
                Map.of("accion", "Llamar", "fecha", LocalDate.now().plusDays(2).toString())).status()).isEqualTo(404);
        assertThat(api.post("/v1/crm/oportunidades/" + oppId + "/venta", ajeno, Map.of("modalidad", "contado")).status())
                .isEqualTo(404);
        assertThat(api.post("/v1/crm/citas/" + appointmentId + "/confirmacion", ajeno,
                Map.of("cedula", "V-12345678")).status()).isEqualTo(404);
        assertThat(api.post("/v1/crm/citas/" + appointmentId + "/descarte", ajeno, Map.of("motivo", "desistio")).status())
                .isEqualTo(404);
        assertThat(api.post("/v1/crm/citas/" + appointmentId + "/asistencia", ajeno, null).status()).isEqualTo(404);
        assertThat(api.get("/v1/crm/personas/" + personId, ajeno).status()).isEqualTo(404);
        assertThat(api.post("/v1/crm/personas/" + personId + "/interacciones", ajeno,
                Map.of("canal", "whatsapp", "direccion", "saliente", "nota", "intento ajeno")).status()).isEqualTo(404);
        assertThat(api.get("/v1/crm/personas?q=" + nombre, ajeno).list()).isEmpty();

        // El dueño y el coordinador sí la ven.
        assertThat(api.get("/v1/crm/personas/" + personId, advisor.token()).status()).isEqualTo(200);
        assertThat(api.get("/v1/crm/personas/" + personId, coordinator.token()).status()).isEqualTo(200);
        assertThat(api.get("/v1/crm/personas?q=" + nombre, coordinator.token()).list()).hasSize(1);

        // Cada intento ajeno quedó en la bitácora.
        long denegados = jdbc.sql("""
                        select count(*) from auditoria_evento
                        where accion = 'acceso.denegado' and (entidad_id = :opp or entidad_id = :per)
                        """)
                .param("opp", oppId, java.sql.Types.OTHER)
                .param("per", personId, java.sql.Types.OTHER)
                .query(Long.class).single();
        assertThat(denegados).isGreaterThanOrEqualTo(9);
    }
}
