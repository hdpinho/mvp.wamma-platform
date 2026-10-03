package com.wamma.contratos;

import com.wamma.crm.CaptureRateLimiter;
import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.ContractShape;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import com.wamma.support.TestData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Contratos de la API con la web (hallazgos F-05, F-06 y F-07 del informe QA: el servidor y el navegador se habían
 * separado sin que nadie se enterara).
 * <p>
 * Cada respuesta real del recorrido —cita, confirmación, venta, enlace, solicitud, dictamen— se compara con el archivo
 * de {@code src/test/resources/contratos/}. La web pasa esos mismos archivos por sus adaptadores
 * ({@code frontend-web/src/api/*.test.ts}): si una clave cambia de un lado, falla una de las dos pruebas.
 */
class ContratosApiTest extends ApiIntegrationTest {

    /** Cabecera JPEG real: el tipo de un recaudo se reconoce por el contenido. */
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F', 0};

    /** Mapas libres del expediente: su contenido lo fija el formulario, no el DTO. */
    private static final Set<String> EXPEDIENTE_LIBRE = Set.of(
            "datosPersonales", "datosContacto", "datosLaborales", "datosFinancieros", "datosBancarios",
            "declaraciones", "evidenciaAceptacion");

    @Autowired
    private CaptureRateLimiter captureRateLimiter;

    private TestAccounts.Account advisor;

    @BeforeEach
    void setUpAccounts() {
        captureRateLimiter.reset();
        advisor = accounts.createAndLogin("asesor_contrato", "ASESOR_COMERCIAL");
    }

    @Test
    @SuppressWarnings("unchecked")
    void theWholeJourneyRespondsWithTheShapesTheWebExpects() {
        TestData.Vehicle vehicle = TestData.publishedVehicle(jdbc, new BigDecimal("18000"));
        String phone = "+58412" + (1_000_000 + (int) (Math.random() * 8_000_000));
        String cedula = "V" + (20_000_000 + (int) (Math.random() * 9_000_000));

        // ── Captación pública y seguimiento comercial ─────────────────────────────────────────
        TestApi.Response booked = api.post("/v1/citas", null, Map.of(
                "nombreApellido", "Carlos Rodríguez",
                "telefonoWhatsApp", phone,
                "correo", "carlos@ejemplo.invalid",
                "diaPreferencia", LocalDate.now().plusDays(1).toString(),
                "franjaHoraria", "manana",
                "modalidadPago", "financiamiento",
                "vehiculoCodigo", vehicle.code()));
        assertThat(booked.status()).isEqualTo(201);
        ContractShape.assertMatches("crm-cita-publica", booked.body());
        String appointmentId = booked.str("id");

        TestApi.Response confirmed = api.post("/v1/crm/citas/" + appointmentId + "/confirmacion", advisor.token(),
                Map.of("cedula", cedula, "correo", "carlos@ejemplo.invalid"));
        assertThat(confirmed.status()).isEqualTo(200);
        ContractShape.assertMatches("crm-confirmacion", confirmed.body());

        TestApi.Response appointments = api.get("/v1/crm/citas", advisor.token());
        assertThat(appointments.status()).isEqualTo(200);
        Map<String, Object> appointment = appointments.list().stream()
                .map(o -> (Map<String, Object>) o)
                .filter(a -> appointmentId.equals(a.get("id")))
                .findFirst().orElseThrow();
        ContractShape.assertMatches("crm-cita", appointment);
        String personId = appointment.get("personaId").toString();
        String opportunityId = appointment.get("oportunidadId").toString();

        TestApi.Response opportunities = api.get("/v1/crm/oportunidades", advisor.token());
        assertThat(opportunities.status()).isEqualTo(200);
        Map<String, Object> opportunity = opportunities.list().stream()
                .map(o -> (Map<String, Object>) o)
                .filter(o -> opportunityId.equals(o.get("id")))
                .findFirst().orElseThrow();
        ContractShape.assertMatches("crm-oportunidad", opportunity);

        assertThat(api.post("/v1/crm/personas/" + personId + "/interacciones", advisor.token(), Map.of(
                "canal", "whatsapp", "direccion", "saliente", "nota", "Confirmó que viene",
                "oportunidadId", opportunityId)).status()).isEqualTo(200);

        assertThat(api.post("/v1/crm/citas/" + appointmentId + "/asistencia", advisor.token(), null).status())
                .isEqualTo(204);
        TestApi.Response sale = api.post("/v1/crm/oportunidades/" + opportunityId + "/venta", advisor.token(),
                Map.of("modalidad", "financiamiento"));
        assertThat(sale.status()).isEqualTo(200);
        ContractShape.assertMatches("crm-venta", sale.body());
        String token = sale.str("tokenFinanciamiento");

        TestApi.Response persons = api.get("/v1/crm/personas", advisor.token());
        assertThat(persons.status()).isEqualTo(200);
        ContractShape.assertMatches("crm-persona-resumen", persons.list().stream()
                .filter(p -> personId.equals(((Map<String, Object>) p).get("id"))).findFirst().orElseThrow());
        TestApi.Response personDetail = api.get("/v1/crm/personas/" + personId, advisor.token());
        assertThat(personDetail.status()).isEqualTo(200);
        ContractShape.assertMatches("crm-persona-detalle", personDetail.body());

        // ── Política, enlace y solicitud ──────────────────────────────────────────────────────
        TestApi.Response parameters = api.get("/v1/parametros-financiamiento", null);
        assertThat(parameters.status()).isEqualTo(200);
        ContractShape.assertMatches("parametros-financiamiento", parameters.body());

        TestApi.Response link = api.get("/v1/solicitudes-credito/enlace/" + token, null);
        assertThat(link.status()).isEqualTo(200);
        ContractShape.assertMatches("credito-enlace", link.body());

        TestApi.Response uploaded = api.upload("/v1/solicitudes-credito/recaudos", null, "cedula.jpg", "image/jpeg", JPEG,
                Map.of("token", token, "tipoDocumento", "cedula"));
        assertThat(uploaded.status()).isEqualTo(200);
        ContractShape.assertMatches("credito-recaudo-cargado", uploaded.body());

        // La solicitud es exactamente la que arma la web: el archivo de contrato, con el token y el recaudo reales.
        Map<String, Object> request = new HashMap<>((Map<String, Object>) ContractShape.fixture("credito-solicitud-envio"));
        request.put("token", token);
        request.put("recaudos", List.of(uploaded.body()));
        TestApi.Response submitted = api.post("/v1/solicitudes-credito", null, request);
        assertThat(submitted.status()).isEqualTo(200);
        ContractShape.assertMatches("credito-solicitud-enviada", submitted.body());
        String applicationId = submitted.str("id");

        // Un enlace ya usado se informa con su motivo, sin datos del vehículo ni de la persona.
        TestApi.Response used = api.get("/v1/solicitudes-credito/enlace/" + token, null);
        assertThat(used.status()).isEqualTo(200);
        assertThat(used.str("invalidReason")).isEqualTo("usado");
        ContractShape.assertMatches("credito-enlace-invalido", used.body());

        // ── Análisis y dictamen ───────────────────────────────────────────────────────────────
        String analyst = accounts.createAndLogin("analista_contrato", "ANALISTA_CREDITO").token();
        TestApi.Response list = api.get("/v1/solicitudes-credito", analyst);
        assertThat(list.status()).isEqualTo(200);
        ContractShape.assertMatches("credito-solicitud-resumen", list.list().stream()
                .filter(s -> applicationId.equals(((Map<String, Object>) s).get("id"))).findFirst().orElseThrow());

        assertThat(api.post("/v1/solicitudes-credito/" + applicationId + "/evaluacion", analyst, Map.of(
                "resultado", "aprobado",
                "justificacion", "Capacidad de pago demostrada y recaudos conformes.",
                "limiteAprobado", 14400,
                "cuotaMaximaPermitida", 1140)).status()).isEqualTo(200);

        TestApi.Response detail = api.get("/v1/solicitudes-credito/" + applicationId, analyst);
        assertThat(detail.status()).isEqualTo(200);
        ContractShape.assertMatches("credito-solicitud-detalle", detail.body(), EXPEDIENTE_LIBRE);

        // El expediente vuelve tal como lo envió la web: mismas claves, mismos valores.
        for (String dossierPart : List.of("datosPersonales", "datosContacto", "datosLaborales", "datosFinancieros",
                "datosBancarios", "declaraciones")) {
            assertThat(detail.map().get(dossierPart)).as(dossierPart).isEqualTo(request.get(dossierPart));
        }
        assertThat(detail.map().get("referencias")).isEqualTo(request.get("referencias"));
        assertThat(detail.obj("evidenciaAceptacion").keySet())
                .containsExactlyInAnyOrder("aceptadoEn", "ip", "userAgent", "versionTexto");
        assertThat(detail.obj("evidenciaAceptacion").get("versionTexto")).isEqualTo("WMA-F-FIN-001 v1");
        List<Object> recaudos = (List<Object>) detail.map().get("recaudos");
        assertThat(recaudos).hasSize(1);
        // El recaudo no expone su clave ni su dirección: se abre con un enlace firmado (D-59).
        assertThat(new ArrayList<>(((Map<String, Object>) recaudos.getFirst()).keySet()))
                .doesNotContain("fileKey", "clave", "url", "ruta");
    }

    @Test
    void anUnknownLinkIsANotFoundTheWebCanTellApartFromAnOutage() {
        TestApi.Response response = api.get("/v1/solicitudes-credito/enlace/" + "x".repeat(43), null);
        assertThat(response.status()).isIn(400, 404);
    }

    @Test
    void theFixturesAreValidJson() {
        for (String name : List.of("crm-oportunidad", "crm-cita", "crm-persona-resumen", "crm-persona-detalle",
                "crm-cita-publica", "crm-confirmacion", "crm-venta", "credito-enlace", "credito-enlace-invalido",
                "credito-recaudo-cargado", "credito-solicitud-envio", "credito-solicitud-enviada",
                "credito-solicitud-resumen", "credito-solicitud-detalle", "parametros-financiamiento")) {
            assertThat(ContractShape.fixture(name)).as(name).isNotNull();
        }
    }
}
