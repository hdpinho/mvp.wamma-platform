package com.wamma.crm;

import com.wamma.inventory.VehicleRepository;
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

class CrmApiIntegrationTest extends ApiIntegrationTest {

    private TestAccounts.Account coordinator;
    private TestAccounts.Account advisor;
    private UUID testVehicleId;

    @BeforeEach
    void setUpCrm() {
        coordinator = accounts.createAndLogin("coordinador_crm", "COORDINADOR_COMERCIAL");
        advisor = accounts.createAndLogin("asesor_crm", "ASESOR_COMERCIAL");

        // Crear vehículo en estado exhibición para las pruebas
        testVehicleId = jdbc.sql("""
                        insert into vehiculo (codigo, vin, marca, modelo, version, anio, color, kilometraje,
                                              carroceria, transmision, combustible, traccion, puestos, estado,
                                              sede_id, precio_adquisicion, moneda_adquisicion, tasa_bcv_adquisicion,
                                              fecha_tasa_adquisicion, es_demostracion)
                        select 'WAM-99001', 'CRMTEST000000001', 'Toyota', 'Corolla', 'XLi', 2021, 'Blanco', 15000,
                               'sedan', 'automatica', 'gasolina', '4x2', 5, 'exhibicion',
                               id, 12000, 'EUR', 45.0, current_date, true
                        from sede where codigo = 'DC'
                        returning id
                        """)
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
        assertThat(interRes.str("note")).isEqualTo("Enlace de financiamiento enviado por WhatsApp.");

        // 9. Ficha 360 de la persona
        TestApi.Response personDetail = api.get("/v1/crm/personas/" + personId, advisor.token());
        assertThat(personDetail.status()).isEqualTo(200);
        assertThat(personDetail.str("nombreApellido")).isEqualTo("Pedro Pérez");
        assertThat(((List<?>) personDetail.map().get("interacciones")).size()).isGreaterThanOrEqualTo(1);
    }
}
