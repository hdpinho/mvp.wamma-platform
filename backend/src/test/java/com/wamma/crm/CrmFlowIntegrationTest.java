package com.wamma.crm;

import com.wamma.crm.domain.CedulaNormalizer;
import com.wamma.crm.domain.PhoneNormalizer;
import com.wamma.platform.web.ApiException;
import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import com.wamma.support.TestData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.sql.Types;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El recorrido comercial contra la API real (spec 010): captación pública, confirmación con fusión de personas,
 * visita, venta y enlace de financiamiento. Complementa a {@link CrmApiIntegrationTest} con las reglas que
 * la evaluación QA encontró rotas (reserva, franja, fusión, venta y visibilidad).
 */
class CrmFlowIntegrationTest extends ApiIntegrationTest {

    private static final LocalDate TOMORROW = LocalDate.now().plusDays(1);

    @Autowired
    private CaptureRateLimiter captureRateLimiter;

    @Autowired
    private AppointmentService appointmentService;

    private TestAccounts.Account advisor;
    private TestAccounts.Account coordinator;
    private int phoneSequence;

    @BeforeEach
    void setUpAccounts() {
        // El límite de citas por IP vive en memoria y lo comparten todas las pruebas.
        captureRateLimiter.reset();
        advisor = accounts.createAndLogin("asesor_flujo", "ASESOR_COMERCIAL");
        coordinator = accounts.createAndLogin("coord_flujo", "COORDINADOR_COMERCIAL");
        phoneSequence = 1_000_000 + (int) (Math.random() * 5_000_000);
    }

    private String phone() {
        return "+58416" + (phoneSequence++);
    }

    private TestApi.Response book(String name, String phone, String vehicleCode, String slot) {
        return api.post("/v1/citas", null, Map.of(
                "nombreApellido", name,
                "telefonoWhatsApp", phone,
                "diaPreferencia", TOMORROW.toString(),
                "franjaHoraria", slot,
                "modalidadPago", "financiamiento",
                "vehiculoCodigo", vehicleCode));
    }

    private UUID opportunityOf(String appointmentId) {
        return jdbc.sql("select oportunidad_id from cita_inspeccion where id = :id")
                .param("id", UUID.fromString(appointmentId), Types.OTHER)
                .query(UUID.class).single();
    }

    private UUID personOf(String appointmentId) {
        return jdbc.sql("select persona_id from cita_inspeccion where id = :id")
                .param("id", UUID.fromString(appointmentId), Types.OTHER)
                .query(UUID.class).single();
    }

    private String vehicleState(UUID vehicleId) {
        return jdbc.sql("select estado from vehiculo where id = :id")
                .param("id", vehicleId, Types.OTHER)
                .query(String.class).single();
    }

    private TestApi.Response confirm(String appointmentId, String cedula) {
        return api.post("/v1/crm/citas/" + appointmentId + "/confirmacion", advisor.token(), Map.of("cedula", cedula));
    }

    private String cedula() {
        return "V-" + (10_000_000 + (int) (Math.random() * 20_000_000));
    }

    @Test
    void theMorningSlotAcceptsTheAccentAndAnInvalidOneIsA422() {
        TestData.Vehicle first = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));
        TestData.Vehicle second = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));

        TestApi.Response withAccent = book("Cliente Mañana", phone(), first.code(), "Mañana");
        assertThat(withAccent.status()).isEqualTo(201);
        assertThat(withAccent.str("franjaHoraria")).isEqualTo("manana");
        assertThat(withAccent.str("estado")).isEqualTo("pendiente");

        assertThat(book("Cliente Noche", phone(), second.code(), "noche").status()).isEqualTo(422);
        assertThat(vehicleState(second.id())).as("un rechazo no reserva nada").isEqualTo("exhibicion");

        // Confirmar cambiando el horario con la tilde ya no es un error interno (antes: 500).
        TestApi.Response confirmed = api.post("/v1/crm/citas/" + withAccent.str("id") + "/confirmacion", advisor.token(),
                Map.of("cedula", cedula(), "franja", "Tarde", "dia", TOMORROW.plusDays(1).toString()));
        assertThat(confirmed.status()).isEqualTo(200);
        assertThat(confirmed.str("franja")).isEqualTo("tarde");
        assertThat(api.post("/v1/crm/citas/" + withAccent.str("id") + "/confirmacion", advisor.token(),
                Map.of("cedula", cedula(), "franja", "madrugada")).status())
                .as("ya confirmada").isEqualTo(422);
    }

    @Test
    void ofSeveralSimultaneousRequestsOnlyOneReservesTheVehicle() throws Exception {
        TestData.Vehicle vehicle = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));
        int requests = 6;
        ExecutorService pool = Executors.newFixedThreadPool(requests);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<String>> results = new ArrayList<>();
        for (int i = 0; i < requests; i++) {
            final int n = i;
            final String phone = phone();
            results.add(pool.submit(() -> {
                start.await();
                try {
                    appointmentService.schedule("Cliente Carrera " + n, phone, null, TOMORROW, "tarde",
                            "financiamiento", vehicle.id(), null, "10.20.30." + n);
                    return "creada";
                } catch (ApiException e) {
                    return e.status().name();
                }
            }));
        }
        start.countDown();
        List<String> outcomes = new ArrayList<>();
        for (Future<String> result : results) {
            outcomes.add(result.get());
        }
        pool.shutdown();

        assertThat(outcomes).filteredOn("creada"::equals).as(outcomes.toString()).hasSize(1);
        assertThat(outcomes).filteredOn(o -> !o.equals("creada")).containsOnly(HttpStatus.CONFLICT.name());
        assertThat(jdbc.sql("select count(*) from cita_inspeccion where vehiculo_id = :id")
                .param("id", vehicle.id(), Types.OTHER).query(Long.class).single()).isEqualTo(1L);
        assertThat(vehicleState(vehicle.id())).isEqualTo("reservado");
    }

    @Test
    void aResubmissionFromTheSamePersonReturnsTheirAppointmentAndDuplicatesNothing() {
        TestData.Vehicle vehicle = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));
        String phone = phone();
        TestApi.Response first = book("Cliente Doble Clic", phone, vehicle.code(), "tarde");
        TestApi.Response second = book("Cliente Doble Clic", phone, vehicle.code(), "tarde");

        assertThat(first.status()).isEqualTo(201);
        assertThat(second.status()).isEqualTo(201);
        assertThat(second.str("id")).isEqualTo(first.str("id"));
        assertThat(jdbc.sql("select count(*) from cita_inspeccion where vehiculo_id = :id")
                .param("id", vehicle.id(), Types.OTHER).query(Long.class).single()).isEqualTo(1L);
        assertThat(jdbc.sql("select count(*) from oportunidad where vehiculo_id = :id")
                .param("id", vehicle.id(), Types.OTHER).query(Long.class).single()).isEqualTo(1L);
    }

    @Test
    void theOpportunityKeepsThePublishedPriceAndRateAndStartsItsHistory() {
        TestData.Vehicle vehicle = TestData.publishedVehicle(jdbc, new BigDecimal("13750.50"));
        String appointment = book("Cliente Precio", phone(), vehicle.code(), "tarde").str("id");
        UUID opportunity = opportunityOf(appointment);

        Map<String, Object> row = jdbc.sql("select valor_estimado, moneda, tasa_bcv from oportunidad where id = :id")
                .param("id", opportunity, Types.OTHER)
                .query((rs, n) -> Map.<String, Object>of("valor", rs.getBigDecimal("valor_estimado"),
                        "moneda", rs.getString("moneda"), "tasa", rs.getBigDecimal("tasa_bcv")))
                .single();
        assertThat((BigDecimal) row.get("valor")).isEqualByComparingTo("13750.50");
        assertThat(row.get("moneda")).isEqualTo("EUR");
        assertThat((BigDecimal) row.get("tasa")).isEqualByComparingTo("45.0");

        // La captura queda como primer evento: sin él, el embudo no sabe cuándo empezó.
        assertThat(jdbc.sql("select etapa_anterior is null and etapa_nueva = 'nuevo' from etapa_historial where oportunidad_id = :id")
                .param("id", opportunity, Types.OTHER).query(Boolean.class).single()).isTrue();
    }

    @Test
    void aVehicleThatIsNotPublishedCannotBeBooked() {
        TestData.Vehicle draft = TestData.vehicle(jdbc, "exhibicion");
        assertThat(book("Cliente Borrador", phone(), draft.code(), "tarde").status()).isEqualTo(409);
        assertThat(vehicleState(draft.id())).isEqualTo("exhibicion");
    }

    @Test
    void mergingKeepsTheOlderPersonCarriesTheCedulaAndLeavesAFullCopy() {
        TestData.Vehicle first = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));
        TestData.Vehicle second = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));
        String olderName = "Ana \"La Única\" O'Brien Pérez";
        String olderPhone = phone();
        String newerPhone = phone();
        String cedula = cedula();

        // La persona más antigua agenda con un teléfono; la más nueva, con otro, y ya dio su cédula.
        String olderAppointment = book(olderName, olderPhone, first.code(), "tarde").str("id");
        String newerAppointment = book("Ana Pérez", newerPhone, second.code(), "tarde").str("id");
        assertThat(confirm(newerAppointment, cedula).status()).isEqualTo(200);
        UUID older = personOf(olderAppointment);
        UUID newer = personOf(newerAppointment);
        assertThat(older).isNotEqualTo(newer);

        // Al llegar la misma cédula para la más antigua, son la misma persona.
        TestApi.Response merged = confirm(olderAppointment, cedula);
        assertThat(merged.status()).isEqualTo(200);

        String canonical = CedulaNormalizer.canonical(cedula);
        assertThat(jdbc.sql("select estado from persona where id = :id").param("id", newer, Types.OTHER)
                .query(String.class).single()).isEqualTo("fusionado");
        assertThat(personOf(newerAppointment)).as("la cita de la absorbida pasó a la sobreviviente").isEqualTo(older);

        // La sobreviviente se puede encontrar por la cédula: si se quedara en el registro fusionado, nadie la hallaría.
        List<Object> byCedula = api.get("/v1/crm/personas?q=" + canonical, coordinator.token()).list();
        assertThat(byCedula).hasSize(1);
        TestApi.Response detail = api.get("/v1/crm/personas/" + older, coordinator.token());
        assertThat(detail.status()).isEqualTo(200);
        assertThat(detail.str("cedula")).isEqualTo(canonical);
        assertThat(detail.str("criterioResolucion")).isEqualTo("cedula");
        assertThat(strings(detail.map().get("telefonos")))
                .containsExactlyInAnyOrder(PhoneNormalizer.mobileE164(olderPhone), PhoneNormalizer.mobileE164(newerPhone));
        assertThat((List<?>) detail.map().get("citas")).hasSize(2);
        assertThat((List<?>) detail.map().get("oportunidades")).hasSize(2);

        // La copia íntegra: JSON válido aunque el nombre lleve comillas, con lo reasignado y sin datos en claro.
        Map<?, ?> fusion = (Map<?, ?>) ((List<?>) detail.map().get("fusiones")).getFirst();
        assertThat(fusion.get("id")).isEqualTo(newer.toString());
        assertThat(strings(fusion.get("telefonos"))).containsExactly(PhoneNormalizer.mobileE164(newerPhone));
        assertThat(strings(fusion.get("oportunidadIds"))).containsExactly(opportunityOf(newerAppointment).toString());
        assertThat(strings(fusion.get("citaIds"))).containsExactly(newerAppointment);

        String copy = jdbc.sql("select copia_absorbida_json::text from fusion_persona where persona_absorbida_id = :id")
                .param("id", newer, Types.OTHER).query(String.class).single();
        assertThat(copy).contains("\"nombreApellido\"").contains("\"cedulaCifrada\"").contains("\"telefonoCifrado\"")
                .doesNotContain(canonical).doesNotContain(PhoneNormalizer.mobileE164(newerPhone));

        // Con el nombre más antiguo entre comillas: la ficha lo devuelve tal cual.
        assertThat(detail.str("nombreApellido")).isEqualTo(olderName);
    }

    @Test
    void aDifferentCedulaForAPersonWhoAlreadyHasOneIsRejected() {
        TestData.Vehicle first = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));
        TestData.Vehicle second = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));
        String phone = phone();
        String firstAppointment = book("Cliente Con Cedula", phone, first.code(), "tarde").str("id");
        assertThat(confirm(firstAppointment, "V-12345678").status()).isEqualTo(200);

        String secondAppointment = book("Cliente Con Cedula", phone, second.code(), "tarde").str("id");
        TestApi.Response wrong = confirm(secondAppointment, "V-87654321");
        assertThat(wrong.status()).isEqualTo(422);
        assertThat(jdbc.sql("select estado from cita_inspeccion where id = :id")
                .param("id", UUID.fromString(secondAppointment), Types.OTHER).query(String.class).single())
                .isEqualTo("pendiente");
        assertThat(confirm(secondAppointment, "V-12345678").status()).as("la misma cédula sí").isEqualTo(200);
    }

    @Test
    void selling_needsTheVisit_andTheFinancingLinkIsReissuedUntilTheApplicationIsSent() {
        TestData.Vehicle vehicle = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));
        String appointment = book("Cliente Venta", phone(), vehicle.code(), "tarde").str("id");
        UUID opportunity = opportunityOf(appointment);
        String sellPath = "/v1/crm/oportunidades/" + opportunity + "/venta";

        // Una cita sin confirmar no registra asistencia, y sin visita no se vende.
        assertThat(api.post("/v1/crm/citas/" + appointment + "/asistencia", advisor.token(), null).status()).isEqualTo(422);
        assertThat(confirm(appointment, cedula()).status()).isEqualTo(200);
        assertThat(api.post(sellPath, advisor.token(), Map.of("modalidad", "financiamiento")).status()).isEqualTo(422);
        assertThat(api.post("/v1/crm/citas/" + appointment + "/asistencia", advisor.token(), null).status()).isEqualTo(204);
        assertThat(api.post("/v1/crm/citas/" + appointment + "/asistencia", advisor.token(), null).status())
                .as("registrarla otra vez no cambia nada").isEqualTo(204);

        TestApi.Response sale = api.post(sellPath, advisor.token(), Map.of("modalidad", "financiamiento"));
        assertThat(sale.status()).isEqualTo(200);
        String firstToken = sale.str("tokenFinanciamiento");
        assertThat(firstToken).isNotBlank();
        assertThat(sale.obj("oportunidad").get("etapa")).isEqualTo("negociacion");
        assertThat(sale.obj("oportunidad").get("tieneEnlaceFinanciamiento")).isEqualTo(true);
        assertThat(vehicleState(vehicle.id())).as("sigue reservado hasta que se apruebe").isEqualTo("reservado");

        // Emitirlo de nuevo invalida el anterior (C9).
        TestApi.Response reissued = api.post(sellPath, advisor.token(), Map.of("modalidad", "financiamiento"));
        assertThat(reissued.status()).isEqualTo(200);
        String secondToken = reissued.str("tokenFinanciamiento");
        assertThat(secondToken).isNotBlank().isNotEqualTo(firstToken);
        assertThat(api.get("/v1/enlaces-financiamiento/" + firstToken, null).status()).isEqualTo(404);
        assertThat(api.get("/v1/enlaces-financiamiento/" + secondToken, null).status()).isEqualTo(200);

        // Con la solicitud enviada ya no se emite otro enlace.
        jdbc.sql("update oportunidad set solicitud_credito_id = :sol where id = :id")
                .param("sol", UUID.randomUUID(), Types.OTHER)
                .param("id", opportunity, Types.OTHER)
                .update();
        assertThat(api.post(sellPath, advisor.token(), Map.of("modalidad", "financiamiento")).status()).isEqualTo(409);
    }

    @Test
    void aCashSaleClosesTheOpportunityRecordsTheRealPaymentAndSellsTheVehicle() {
        TestData.Vehicle vehicle = TestData.publishedVehicle(jdbc, new BigDecimal("12000"));
        String appointment = book("Cliente Contado", phone(), vehicle.code(), "tarde").str("id");
        UUID opportunity = opportunityOf(appointment);
        assertThat(confirm(appointment, cedula()).status()).isEqualTo(200);
        assertThat(api.post("/v1/crm/citas/" + appointment + "/asistencia", advisor.token(), null).status()).isEqualTo(204);

        TestApi.Response sale = api.post("/v1/crm/oportunidades/" + opportunity + "/venta", advisor.token(),
                Map.of("modalidad", "contado"));
        assertThat(sale.status()).isEqualTo(200);
        assertThat(sale.str("tokenFinanciamiento")).isNull();
        assertThat(sale.obj("oportunidad").get("etapa")).isEqualTo("cerrado_ganado");
        assertThat(sale.obj("oportunidad").get("modalidadPago")).as("agendó para financiar y pagó de contado")
                .isEqualTo("contado");
        assertThat(vehicleState(vehicle.id())).isEqualTo("vendido");
    }

    @Test
    void theFunnelShowsEachAdvisorTheirOwnAndTheUnassignedAndTheCoordinatorEverything() {
        TestAccounts.Account other = accounts.createAndLogin("asesor_otro_flujo", "ASESOR_COMERCIAL");
        UUID mine = opportunityOf(book("Cliente Mia", phone(),
                TestData.publishedVehicle(jdbc, new BigDecimal("12000")).code(), "tarde").str("id"));
        UUID free = opportunityOf(book("Cliente Libre", phone(),
                TestData.publishedVehicle(jdbc, new BigDecimal("12000")).code(), "tarde").str("id"));
        UUID theirs = opportunityOf(book("Cliente Ajena", phone(),
                TestData.publishedVehicle(jdbc, new BigDecimal("12000")).code(), "tarde").str("id"));
        assertThat(api.put("/v1/crm/oportunidades/" + mine + "/asesor", advisor.token(), Map.of()).status()).isEqualTo(200);
        assertThat(api.put("/v1/crm/oportunidades/" + theirs + "/asesor", other.token(), Map.of()).status()).isEqualTo(200);

        List<String> mineList = ids(api.get("/v1/crm/oportunidades", advisor.token()));
        assertThat(mineList).contains(mine.toString(), free.toString()).doesNotContain(theirs.toString());

        List<String> all = ids(api.get("/v1/crm/oportunidades", coordinator.token()));
        assertThat(all).contains(mine.toString(), free.toString(), theirs.toString());
        assertThat(ids(api.get("/v1/crm/oportunidades?sinAsesor=true", coordinator.token())))
                .contains(free.toString()).doesNotContain(mine.toString(), theirs.toString());
        assertThat(ids(api.get("/v1/crm/oportunidades?asesorId=" + advisor.id(), coordinator.token())))
                .contains(mine.toString()).doesNotContain(free.toString(), theirs.toString());

        // El coordinador reparte y conoce a los asesores; el asesor no ve esa lista.
        assertThat(api.get("/v1/crm/asesores", advisor.token()).status()).isEqualTo(403);
        List<Object> advisors = api.get("/v1/crm/asesores", coordinator.token()).list();
        assertThat(advisors.toString()).contains(advisor.id().toString());
        assertThat(api.put("/v1/crm/oportunidades/" + free + "/asesor", coordinator.token(),
                Map.of("asesorId", advisor.id().toString())).status()).isEqualTo(200);
    }

    private static List<String> strings(Object list) {
        return ((List<?>) list).stream().map(Object::toString).toList();
    }

    private static List<String> ids(TestApi.Response response) {
        assertThat(response.status()).isEqualTo(200);
        return response.list().stream().map(o -> ((Map<?, ?>) o).get("id").toString()).toList();
    }
}
