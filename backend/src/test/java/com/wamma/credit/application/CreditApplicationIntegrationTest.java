package com.wamma.credit.application;

import com.wamma.credit.application.documents.DocumentStorage;
import com.wamma.crm.CaptureRateLimiter;
import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletResponse;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

class CreditApplicationIntegrationTest extends ApiIntegrationTest {

    /** Cabecera JPEG real: el tipo de un recaudo se reconoce por el contenido. */
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F', 0};
    private static final byte[] PDF = "%PDF-1.4\n% recaudo de prueba\n".getBytes(StandardCharsets.US_ASCII);

    @Autowired
    private CaptureRateLimiter captureRateLimiter;

    @Autowired
    private CreditApplicationRepository creditApplications;

    @Autowired
    private DocumentStorage documents;

    private TestAccounts.Account advisor;
    private UUID vehicleId;
    private UUID opportunityId;
    private String financingToken;
    private String testCedula;

    @BeforeEach
    void setUpTestData() {
        // Cada prueba agenda una cita desde la misma IP; el límite vive en memoria y se comparte.
        captureRateLimiter.reset();
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
        String analystToken = accounts.createAndLogin("analista_cred", "ANALISTA_CREDITO").token();

        // 1. Enviar la solicitud de crédito con datos WMA-F-FIN-001
        Map<String, Object> req = solicitudCompleta();

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

        // 3. No hay consulta pública por número: es secuencial y permitiría enumerar solicitudes
        assertThat(api.get("/v1/solicitudes-credito/" + numeroSolicitud + "/estado", null).status()).isEqualTo(401);

        // 4. Backoffice: Listado de solicitudes de crédito
        TestApi.Response listRes = api.get("/v1/solicitudes-credito", analystToken);
        assertThat(listRes.status()).isEqualTo(200);
        List<Object> apps = listRes.list();
        assertThat(apps).isNotEmpty();

        // 5. Backoffice: Expediente digital completo
        TestApi.Response detailRes = api.get("/v1/solicitudes-credito/" + appId, analystToken);
        assertThat(detailRes.status()).isEqualTo(200);
        assertThat(detailRes.str("numeroSolicitud")).isEqualTo(numeroSolicitud);
        assertThat(detailRes.str("moneda")).isEqualTo("EUR");
        List<?> recaudos = (List<?>) detailRes.map().get("recaudos");
        assertThat(recaudos).hasSize(2);

        // 6. Backoffice: Evaluar solicitud (dictamen del analista)
        TestApi.Response evalRes = api.post("/v1/solicitudes-credito/" + appId + "/evaluacion",
                analystToken, Map.of(
                        "resultado", "aprobado",
                        "limiteAprobado", 14400,
                        "cuotaMaximaPermitida", 1000,
                        "justificacion", "Cumple capacidad de pago y recaudos conformes"
                ));
        assertThat(evalRes.status()).isEqualTo(200);

        // 7. Verificar que el estado cambió a 'aprobada'
        TestApi.Response updatedDetailRes = api.get("/v1/solicitudes-credito/" + appId, analystToken);
        assertThat(updatedDetailRes.str("estado")).isEqualTo("aprobada");
        assertThat(updatedDetailRes.obj("decisionRiesgo").get("result")).isEqualTo("aprobado");
        // D-63: el dictamen manual no trae puntajes ni nivel de riesgo, y no se inventan.
        assertThat(updatedDetailRes.obj("decisionRiesgo").get("internalScore")).isNull();
        assertThat(updatedDetailRes.obj("decisionRiesgo").get("riskLevel")).isNull();
    }

    // ── R3 · Integridad del crédito ────────────────────────────────────────────────────────

    /** C-01, C-02, C-08: el servidor calcula monto, cuota y capacidad; lo que mande el navegador se ignora. */
    @Test
    void theServerCalculatesTheAmountThePaymentAndTheCapacityAndIgnoresWhatTheBrowserSends() {
        Map<String, Object> req = new HashMap<>(solicitudCon(List.of()));
        req.put("montoSolicitado", 1);
        req.put("cuotaEstimada", 1);
        req.put("capacidadPagoMensual", 99999);
        req.put("frecuenciaPago", "Semanal");
        TestApi.Response submitted = api.post("/v1/solicitudes-credito", null, req);
        assertThat(submitted.status()).isEqualTo(200);

        String analyst = accounts.createAndLogin("analista_calc", "ANALISTA_CREDITO").token();
        TestApi.Response detail = api.get("/v1/solicitudes-credito/" + submitted.str("id"), analyst);
        // Precio 18.000 − inicial 3.600 = 14.400 al 4 % mensual a 24 meses (sistema francés) = 944,45.
        assertThat(new java.math.BigDecimal(detail.map().get("montoSolicitado").toString())).isEqualByComparingTo("14400.00");
        assertThat(new java.math.BigDecimal(detail.map().get("cuotaEstimada").toString())).isEqualByComparingTo("944.45");
        // 30 % del ingreso declarado (3.000), contado una sola vez.
        assertThat(new java.math.BigDecimal(detail.map().get("capacidadPagoMensual").toString())).isEqualByComparingTo("900.00");
        assertThat(detail.str("frecuenciaPago")).isEqualTo("Mensual");
    }

    @Test
    void theDownPaymentAndTheIncomeAreValidatedByTheServerAndARejectionDoesNotSpendTheLink() {
        // 20 % de 18.000 son 3.600: menos no se admite, y tampoco igualar o superar el precio.
        for (int inicial : new int[]{3599, 0, 18000, 25000}) {
            Map<String, Object> req = new HashMap<>(solicitudCon(List.of()));
            req.put("cuotaInicial", inicial);
            assertThat(api.post("/v1/solicitudes-credito", null, req).status()).as("inicial " + inicial).isEqualTo(422);
        }
        Map<String, Object> sinInicial = new HashMap<>(solicitudCon(List.of()));
        sinInicial.remove("cuotaInicial");
        assertThat(api.post("/v1/solicitudes-credito", null, sinInicial).status()).isEqualTo(422);

        Map<String, Object> sinIngreso = new HashMap<>(solicitudCon(List.of()));
        sinIngreso.put("datosFinancieros", Map.of("sueldoMensual", 0, "otrosIngresos", 500));
        assertThat(api.post("/v1/solicitudes-credito", null, sinIngreso).status()).isEqualTo(422);

        // El enlace sigue vigente y la solicitud correcta pasa.
        assertThat(api.post("/v1/solicitudes-credito", null, solicitudCon(List.of())).status()).isEqualTo(200);
    }

    /** C-09, D-63: el dictamen es manual, con justificación, sin puntaje por defecto y con reglas de estado. */
    @Test
    void theManualRulingNeedsAJustificationExplicitConditionsAndCannotReverseAFinalRuling() {
        String appId = api.post("/v1/solicitudes-credito", null, solicitudCon(List.of())).str("id");
        String analyst = accounts.createAndLogin("analista_regla", "ANALISTA_CREDITO").token();
        String path = "/v1/solicitudes-credito/" + appId + "/evaluacion";

        // Sin justificación (o con una de relleno) no hay dictamen.
        assertThat(api.post(path, analyst, Map.of("resultado", "rechazado")).status()).isEqualTo(422);
        assertThat(api.post(path, analyst, Map.of("resultado", "rechazado", "justificacion", "   ")).status()).isEqualTo(422);
        assertThat(api.post(path, analyst, Map.of("resultado", "rechazado", "justificacion", "no")).status()).isEqualTo(422);
        // Un resultado que no existe es un 400, y «en análisis» ya no es un dictamen.
        assertThat(api.post(path, analyst, Map.of("resultado", "en_analisis", "justificacion", "Estoy revisando.")).status())
                .isEqualTo(400);
        // Aprobar exige decir cuánto, sin pasar de lo solicitado (14.400).
        assertThat(api.post(path, analyst, Map.of("resultado", "aprobado", "justificacion", "Cumple todo lo exigido.")).status())
                .isEqualTo(422);
        assertThat(api.post(path, analyst, Map.of("resultado", "aprobado", "justificacion", "Cumple todo lo exigido.",
                "limiteAprobado", 20000, "cuotaMaximaPermitida", 1000)).status()).isEqualTo(422);
        assertThat(api.get("/v1/solicitudes-credito/" + appId, analyst).str("estado")).isEqualTo("enviada");

        // Condicionar y luego aprobar sí se puede: el historial queda en la bitácora.
        assertThat(api.post(path, analyst, Map.of("resultado", "condicionado", "justificacion", "Falta el estado de cuenta."))
                .status()).isEqualTo(200);
        assertThat(api.get("/v1/solicitudes-credito/" + appId, analyst).str("estado")).isEqualTo("condicionada");
        assertThat(api.post(path, analyst, Map.of("resultado", "aprobado", "justificacion", "Entregó el estado de cuenta.",
                "limiteAprobado", 14400, "cuotaMaximaPermitida", 1000)).status()).isEqualTo(200);

        // Un dictamen final no se revierte desde aquí.
        assertThat(api.post(path, analyst, Map.of("resultado", "rechazado", "justificacion", "Cambié de opinión.")).status())
                .isEqualTo(409);
        TestApi.Response detail = api.get("/v1/solicitudes-credito/" + appId, analyst);
        assertThat(detail.str("estado")).isEqualTo("aprobada");
        assertThat(detail.obj("decisionRiesgo").get("justification")).isEqualTo("Entregó el estado de cuenta.");

        String anterior = jdbc.sql("""
                        select despues->>'resultado_anterior' from auditoria_evento
                        where accion = 'solicitud_credito.evaluada' and entidad_id = :id
                        order by creado_en desc limit 1
                        """)
                .param("id", UUID.fromString(appId), java.sql.Types.OTHER)
                .query(String.class).single();
        assertThat(anterior).isEqualTo("condicionado");
    }

    /** Leer el expediente (datos personales y financieros) deja huella: quién y cuándo. */
    @Test
    void readingTheDossierIsRecordedInTheAuditLog() {
        String appId = api.post("/v1/solicitudes-credito", null, solicitudCon(List.of())).str("id");
        String analyst = accounts.createAndLogin("analista_lee", "ANALISTA_CREDITO").token();
        long antes = eventos("solicitud_credito.consultada", appId);
        assertThat(api.get("/v1/solicitudes-credito/" + appId, analyst).status()).isEqualTo(200);
        assertThat(eventos("solicitud_credito.consultada", appId)).isEqualTo(antes + 1);
        // Quien no puede leerlo no deja un evento de lectura, sino el rechazo.
        String asesor = accounts.createAndLogin("asesor_lee", "ASESOR_COMERCIAL").token();
        assertThat(api.get("/v1/solicitudes-credito/" + appId, asesor).status()).isEqualTo(403);
        assertThat(eventos("solicitud_credito.consultada", appId)).isEqualTo(antes + 1);
    }

    /** C-11: dos envíos simultáneos nunca reciben el mismo número de solicitud. */
    @Test
    void applicationNumbersAreUniqueUnderConcurrency() throws Exception {
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(8);
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        List<java.util.concurrent.Future<String>> numbers = new java.util.ArrayList<>();
        for (int i = 0; i < 24; i++) {
            numbers.add(pool.submit(() -> {
                start.await();
                return creditApplications.generateNextApplicationNumber(2099);
            }));
        }
        start.countDown();
        List<String> distinct = new java.util.ArrayList<>();
        for (java.util.concurrent.Future<String> number : numbers) {
            distinct.add(number.get());
        }
        pool.shutdown();
        assertThat(distinct).doesNotHaveDuplicates().hasSize(24).allMatch(n -> n.matches("SOL-2099-\\d{4}"));
    }

    /**
     * Separación de funciones (Principio I, spec 010 §8.3): el expediente financiero lo leen el
     * analista y el auditor; el dictamen y los recaudos, solo el analista. Ni la capa comercial,
     * ni inventario, ni el administrador de usuarios.
     */
    @Test
    void onlyCreditRolesReadTheFileAndOnlyTheAnalystDecides() {
        String appId = api.post("/v1/solicitudes-credito", null, solicitudCompleta()).str("id");
        String docId = recaudoDe(appId);
        Map<String, Object> dictamen = Map.of("resultado", "condicionado", "justificacion", "Falta un recaudo");

        for (String rol : List.of("ASESOR_COMERCIAL", "COORDINADOR_COMERCIAL", "INVENTARIO", "ADMINISTRADOR")) {
            String token = tokenDe(rol);
            assertThat(api.get("/v1/solicitudes-credito", token).status()).as(rol).isEqualTo(403);
            assertThat(api.get("/v1/solicitudes-credito/" + appId, token).status()).as(rol).isEqualTo(403);
            assertThat(api.post("/v1/solicitudes-credito/" + appId + "/evaluacion", token, dictamen).status())
                    .as(rol).isEqualTo(403);
            assertThat(api.patch("/v1/solicitudes-credito/" + appId + "/recaudos/" + docId, token,
                    Map.of("estado", "conforme")).status()).as(rol).isEqualTo(403);
        }

        String auditor = accounts.createAndLogin("auditor_cred", "AUDITOR").token();
        assertThat(api.get("/v1/solicitudes-credito/" + appId, auditor).status()).isEqualTo(200);
        assertThat(api.post("/v1/solicitudes-credito/" + appId + "/evaluacion", auditor, dictamen).status()).isEqualTo(403);
        assertThat(api.patch("/v1/solicitudes-credito/" + appId + "/recaudos/" + docId, auditor,
                Map.of("estado", "conforme")).status()).isEqualTo(403);

        String analyst = accounts.createAndLogin("analista_dict", "ANALISTA_CREDITO").token();
        assertThat(api.patch("/v1/solicitudes-credito/" + appId + "/recaudos/" + docId, analyst,
                Map.of("estado", "conforme")).status()).isEqualTo(200);
        assertThat(api.post("/v1/solicitudes-credito/" + appId + "/evaluacion", analyst, dictamen).status()).isEqualTo(200);
    }

    @Test
    void aDocumentIsValidatedOnlyWithinItsApplicationAndWithAKnownStatus() {
        String appId = api.post("/v1/solicitudes-credito", null, solicitudCompleta()).str("id");
        String docId = recaudoDe(appId);
        String analyst = accounts.createAndLogin("analista_rec", "ANALISTA_CREDITO").token();

        // Un estado que la base no admite es un 422, no un error interno.
        assertThat(api.patch("/v1/solicitudes-credito/" + appId + "/recaudos/" + docId, analyst,
                Map.of("estado", "verificado")).status()).isEqualTo(422);
        // Sin estado no se aprueba por omisión.
        assertThat(api.patch("/v1/solicitudes-credito/" + appId + "/recaudos/" + docId, analyst,
                Map.of("observaciones", "sin estado")).status()).isEqualTo(422);
        // El recaudo de una solicitud no se toca a través de otra.
        assertThat(api.patch("/v1/solicitudes-credito/" + UUID.randomUUID() + "/recaudos/" + docId, analyst,
                Map.of("estado", "rechazado")).status()).isEqualTo(404);
        assertThat(jdbc.sql("select estado_validacion from solicitud_recaudo where id = :id")
                .param("id", UUID.fromString(docId), java.sql.Types.OTHER)
                .query(String.class).single()).isEqualTo("pendiente");
    }

    /**
     * Recaudos privados (D-59): se guardan fuera del almacén público de fotos, el expediente no
     * expone su clave ni una dirección, y el archivo solo abre con un enlace firmado que vence en
     * minutos y que queda en la bitácora.
     */
    @Test
    @SuppressWarnings("unchecked")
    void recaudosArePrivateAndOpenOnlyWithAShortLivedSignedLink() throws Exception {
        Map<String, Object> cargado = recaudoCargado("cedula", "C:\\fotos\\mi cedula.jpg", "application/pdf", JPEG);
        String clave = cargado.get("fileKey").toString();
        assertThat(clave).startsWith("recaudos/" + opportunityId + "/").endsWith(".jpg").doesNotContain("http");
        assertThat(cargado.get("mimeType")).as("el tipo lo decide el contenido, no el navegador").isEqualTo("image/jpeg");
        assertThat(cargado.get("fileName")).isEqualTo("mi cedula.jpg");
        assertThat(abrir("/archivos/" + clave)).as("el almacén público de fotos no lo sirve").isEqualTo(404);

        String appId = api.post("/v1/solicitudes-credito", null, solicitudCon(List.of(cargado))).str("id");
        String analista = accounts.createAndLogin("analista_doc", "ANALISTA_CREDITO").token();

        TestApi.Response detalle = api.get("/v1/solicitudes-credito/" + appId, analista);
        Map<String, Object> recaudo = (Map<String, Object>) ((List<?>) detalle.map().get("recaudos")).getFirst();
        assertThat(recaudo).doesNotContainKeys("fileUrl", "fileKey");
        assertThat(json.writeValueAsString(detalle.body())).doesNotContain(clave);

        String docId = recaudo.get("id").toString();
        String pedirEnlace = "/v1/solicitudes-credito/" + appId + "/recaudos/" + docId + "/enlace";
        TestApi.Response enlace = api.get(pedirEnlace, analista);
        assertThat(enlace.status()).isEqualTo(200);
        String ruta = enlace.str("ruta");
        assertThat(ruta).startsWith("/v1/recaudos/archivo?");

        // Sin sesión abre, con el tipo real y sin que nadie guarde copia.
        MockHttpServletResponse archivo = mvc.perform(get(URI.create(ruta))).andReturn().getResponse();
        assertThat(archivo.getStatus()).isEqualTo(200);
        assertThat(archivo.getContentType()).isEqualTo("image/jpeg");
        assertThat(archivo.getHeader("Cache-Control")).contains("no-store");
        assertThat(archivo.getContentAsByteArray()).isEqualTo(JPEG);

        // Una firma alterada, u otro archivo con la misma firma, no abren nada.
        String firma = ruta.substring(ruta.indexOf("firma=") + "firma=".length());
        String otraFirma = (firma.startsWith("0") ? "1" : "0") + firma.substring(1);
        assertThat(abrir(ruta.replace("firma=" + firma, "firma=" + otraFirma))).isEqualTo(403);
        assertThat(abrir(ruta.replace(opportunityId.toString(), UUID.randomUUID().toString()))).isEqualTo(403);

        // Pasados los minutos de vigencia, el mismo enlace ya no abre.
        clock.advance(Duration.ofMinutes(6));
        assertThat(abrir(ruta)).isEqualTo(403);

        // Solo los roles de crédito piden enlaces, y solo de recaudos de esa solicitud.
        String asesor = accounts.createAndLogin("asesor_doc", "ASESOR_COMERCIAL").token();
        assertThat(api.get(pedirEnlace, asesor).status()).isEqualTo(403);
        String auditor = accounts.createAndLogin("auditor_doc", "AUDITOR").token();
        assertThat(api.get(pedirEnlace, auditor).status()).isEqualTo(200);
        assertThat(api.get("/v1/solicitudes-credito/" + appId + "/recaudos/" + UUID.randomUUID() + "/enlace", analista)
                .status()).isEqualTo(404);

        assertThat(eventos("solicitud_recaudo.enlace_emitido", docId)).isEqualTo(2);
        assertThat(eventos("solicitud_recaudo.abierto", docId)).isEqualTo(1);
    }

    @Test
    void anUploadNeedsAnOpenLinkAndARealDocument() {
        // Un ejecutable o un texto no pasan, digan lo que digan su nombre y su tipo.
        byte[] ejecutable = "MZ ejecutable".getBytes(StandardCharsets.US_ASCII);
        assertThat(cargarRecaudo("cedula", "cedula.pdf", "application/pdf", ejecutable).status()).isEqualTo(422);
        assertThat(cargarRecaudo("cedula", "cedula.jpg", "image/jpeg", "hola".getBytes(StandardCharsets.US_ASCII))
                .status()).isEqualTo(422);
        assertThat(cargarRecaudo("cedula", "cedula.pdf", "application/pdf", new byte[0]).status()).isEqualTo(400);

        // Sin un enlace emitido por el asesor no se carga nada.
        assertThat(api.upload("/v1/solicitudes-credito/recaudos", null, "rif.pdf", "application/pdf", PDF,
                Map.of("token", "A".repeat(43), "tipoDocumento", "rif")).status()).isEqualTo(404);
        assertThat(api.upload("/v1/solicitudes-credito/recaudos", null, "rif.pdf", "application/pdf", PDF,
                Map.of("token", "corto", "tipoDocumento", "rif")).status()).isEqualTo(400);

        // Con el enlace ya usado, tampoco.
        assertThat(api.post("/v1/solicitudes-credito", null, solicitudCon(List.of())).status()).isEqualTo(200);
        assertThat(cargarRecaudo("rif", "rif.pdf", "application/pdf", PDF).status()).isEqualTo(422);
    }

    @Test
    void aSubmissionOnlyAcceptsFilesUploadedWithItsOwnLink() {
        Map<String, Object> propio = recaudoCargado("cedula", "cedula.pdf", "application/pdf", PDF);
        String deOtraOportunidad = "recaudos/" + UUID.randomUUID() + "/" + UUID.randomUUID() + ".pdf";
        String nuncaCargado = "recaudos/" + opportunityId + "/" + UUID.randomUUID() + ".pdf";

        for (String clave : List.of(deOtraOportunidad, nuncaCargado, "https://ejemplo.invalid/recaudos/cedula.pdf", "")) {
            Map<String, Object> ajeno = new HashMap<>(propio);
            ajeno.put("fileKey", clave);
            assertThat(api.post("/v1/solicitudes-credito", null, solicitudCon(List.of(propio, ajeno))).status())
                    .as(clave).isEqualTo(422);
        }

        // Los intentos rechazados no gastan el enlace.
        assertThat(api.post("/v1/solicitudes-credito", null, solicitudCon(List.of(propio))).status()).isEqualTo(200);
    }

    /** El expediente se guarda cifrado (V0019): la base no ve ingresos, empleador ni cuenta. */
    @Test
    void theDossierIsEncryptedAtRest() {
        String appId = api.post("/v1/solicitudes-credito", null, solicitudCon(List.of())).str("id");

        byte[] guardado = jdbc.sql("select expediente_cifrado from solicitud_credito where id = :id")
                .param("id", UUID.fromString(appId), java.sql.Types.OTHER)
                .query(byte[].class)
                .single();
        assertThat(new String(guardado, StandardCharsets.ISO_8859_1))
                .doesNotContain("01020000000000000000")
                .doesNotContain("Empresa C.A.")
                .doesNotContain("Rodriguez");
        assertThat(jdbc.sql("""
                        select count(*) from information_schema.columns
                        where table_schema = current_schema() and table_name = 'solicitud_credito'
                          and data_type in ('json', 'jsonb')
                        """)
                .query(Long.class).single()).isZero();

        String analista = accounts.createAndLogin("analista_cifra", "ANALISTA_CREDITO").token();
        TestApi.Response detalle = api.get("/v1/solicitudes-credito/" + appId, analista);
        assertThat(detalle.obj("datosBancarios").get("numeroCuenta")).isEqualTo("01020000000000000000");
        assertThat(detalle.obj("datosLaborales").get("empresa")).isEqualTo("Empresa C.A.");
    }

    /**
     * D-70: al condicionar, el analista emite un enlace y el cliente completa LA MISMA solicitud, con su número. Un
     * recaudo del mismo tipo reemplaza al anterior, la solicitud vuelve a la bandeja y el enlace queda usado.
     */
    @Test
    void aConditionedApplicationReopensItsDocumentsAndTheClientCompletesTheSameApplication() {
        TestApi.Response created = api.post("/v1/solicitudes-credito", null, solicitudCompleta());
        String appId = created.str("id");
        String number = created.str("numeroSolicitud");
        String analyst = accounts.createAndLogin("analista_comp", "ANALISTA_CREDITO").token();
        String linkPath = "/v1/solicitudes-credito/" + appId + "/enlace-recaudos";

        // Solo se piden más recaudos a una solicitud condicionada, y solo lo hace el analista.
        assertThat(api.post(linkPath, analyst, null).status()).isEqualTo(409);
        assertThat(api.post("/v1/solicitudes-credito/" + appId + "/evaluacion", analyst,
                Map.of("resultado", "condicionado", "justificacion", "Falta un estado de cuenta nuevo.")).status())
                .isEqualTo(200);
        assertThat(api.post(linkPath, advisor.token(), null).status()).isEqualTo(403);
        TestApi.Response issued = api.post(linkPath, analyst, null);
        assertThat(issued.status()).isEqualTo(200);
        String token = issued.str("token");
        assertThat(token).isNotBlank().isNotEqualTo(financingToken);

        // El enlace anterior deja de servir; el nuevo se reconoce como complemento de ESA solicitud.
        assertThat(api.get("/v1/solicitudes-credito/enlace/" + financingToken, null).status()).isEqualTo(404);
        TestApi.Response link = api.get("/v1/solicitudes-credito/enlace/" + token, null);
        assertThat(link.map().get("valid")).isEqualTo(true);
        Map<String, Object> complement = link.obj("complemento");
        assertThat(complement.get("applicationNumber")).isEqualTo(number);
        assertThat(complement.keySet()).as("la justificación interna del analista no sale en un enlace público")
                .containsExactlyInAnyOrder("applicationNumber", "documentTypes");
        List<Object> pendingTypes = new java.util.ArrayList<>((List<?>) complement.get("documentTypes"));
        assertThat(pendingTypes).containsExactlyInAnyOrder("cedula", "rif");

        // Un enlace de complemento no abre una solicitud nueva.
        Map<String, Object> another = new HashMap<>(solicitudCon(List.of()));
        another.put("token", token);
        assertThat(api.post("/v1/solicitudes-credito", null, another).status()).isEqualTo(409);

        // Sin recaudos no hay complemento.
        assertThat(api.post("/v1/solicitudes-credito/complemento", null,
                Map.of("token", token, "recaudos", List.of())).status()).isEqualTo(422);

        String oldRifKey = jdbc.sql("select archivo_clave from solicitud_recaudo where solicitud_id = :id and tipo_documento = 'rif'")
                .param("id", UUID.fromString(appId), java.sql.Types.OTHER).query(String.class).single();
        assertThat(documents.exists(oldRifKey)).isTrue();

        Map<String, Object> newRif = api.upload("/v1/solicitudes-credito/recaudos", null, "rif-nuevo.pdf",
                "application/pdf", PDF, Map.of("token", token, "tipoDocumento", "rif")).map();
        Map<String, Object> statement = api.upload("/v1/solicitudes-credito/recaudos", null, "estado-cuenta.jpg",
                "image/jpeg", JPEG, Map.of("token", token, "tipoDocumento", "bancario")).map();
        TestApi.Response completed = api.post("/v1/solicitudes-credito/complemento", null,
                Map.of("token", token, "recaudos", List.of(newRif, statement)));
        assertThat(completed.status()).as(String.valueOf(completed.body())).isEqualTo(200);
        assertThat(completed.str("numeroSolicitud")).isEqualTo(number);
        assertThat(completed.str("estado")).isEqualTo("en_evaluacion");

        // Misma solicitud, con la cédula intacta, el RIF reemplazado y el estado de cuenta sumado.
        TestApi.Response detail = api.get("/v1/solicitudes-credito/" + appId, analyst);
        assertThat(detail.str("estado")).isEqualTo("en_evaluacion");
        List<String> names = jdbc.sql("select nombre_archivo from solicitud_recaudo where solicitud_id = :id order by nombre_archivo")
                .param("id", UUID.fromString(appId), java.sql.Types.OTHER).query(String.class).list();
        assertThat(names).containsExactly("cedula.jpg", "estado-cuenta.jpg", "rif-nuevo.pdf");
        assertThat(documents.exists(oldRifKey)).as("el archivo reemplazado se borra del contenedor").isFalse();

        // El enlace queda usado y la bitácora guarda lo ocurrido.
        assertThat(api.get("/v1/solicitudes-credito/enlace/" + token, null).str("invalidReason")).isEqualTo("usado");
        assertThat(api.post("/v1/solicitudes-credito/complemento", null,
                Map.of("token", token, "recaudos", List.of(newRif))).status()).isEqualTo(422);
        assertThat(eventos("solicitud_credito.enlace_recaudos_emitido", appId)).isEqualTo(1);
        assertThat(eventos("solicitud_credito.recaudos_completados", appId)).isEqualTo(1);
    }

    /** Si el analista ya decidió, el enlace de recaudos no vuelve a mover la solicitud. */
    @Test
    void theComplementIsRefusedOnceTheApplicationIsNoLongerConditioned() {
        String appId = api.post("/v1/solicitudes-credito", null, solicitudCompleta()).str("id");
        String analyst = accounts.createAndLogin("analista_comp2", "ANALISTA_CREDITO").token();
        String evaluation = "/v1/solicitudes-credito/" + appId + "/evaluacion";
        api.post(evaluation, analyst, Map.of("resultado", "condicionado", "justificacion", "Falta el estado de cuenta."));
        String token = api.post("/v1/solicitudes-credito/" + appId + "/enlace-recaudos", analyst, null).str("token");
        Map<String, Object> rif = api.upload("/v1/solicitudes-credito/recaudos", null, "rif2.pdf",
                "application/pdf", PDF, Map.of("token", token, "tipoDocumento", "rif")).map();

        // Mientras tanto el analista aprueba.
        assertThat(api.post(evaluation, analyst, Map.of("resultado", "aprobado", "justificacion", "Ya cumple todo.",
                "limiteAprobado", 14400, "cuotaMaximaPermitida", 1000)).status()).isEqualTo(200);

        assertThat(api.post("/v1/solicitudes-credito/complemento", null,
                Map.of("token", token, "recaudos", List.of(rif))).status()).isEqualTo(409);
        assertThat(api.get("/v1/solicitudes-credito/" + appId, analyst).str("estado")).isEqualTo("aprobada");
    }

    /**
     * D-71: un expediente aprobado o rechazado se puede reabrir con justificación y dictaminar de nuevo. No procede si el
     * crédito ya se desembolsó ni si la venta se cerró.
     */
    @Test
    void anApprovedOrRejectedFileCanBeReopenedWithAJustificationButNotOnceItHasConsequences() {
        String appId = api.post("/v1/solicitudes-credito", null, solicitudCon(List.of())).str("id");
        String analyst = accounts.createAndLogin("analista_reabre", "ANALISTA_CREDITO").token();
        String evaluation = "/v1/solicitudes-credito/" + appId + "/evaluacion";
        String reopen = "/v1/solicitudes-credito/" + appId + "/reapertura";

        // Sin dictamen final no hay nada que reabrir.
        assertThat(api.post(reopen, analyst, Map.of("justificacion", "Quiero revisarlo otra vez.")).status()).isEqualTo(409);

        assertThat(api.post(evaluation, analyst, Map.of("resultado", "aprobado", "justificacion", "Cumple lo exigido.",
                "limiteAprobado", 14400, "cuotaMaximaPermitida", 1000)).status()).isEqualTo(200);

        // Pide justificación y solo la reabre el analista.
        assertThat(api.post(reopen, analyst, Map.of("justificacion", "no")).status()).isEqualTo(422);
        assertThat(api.post(reopen, analyst, Map.of()).status()).isEqualTo(422);
        assertThat(api.post(reopen, advisor.token(), Map.of("justificacion", "Quiero reabrirlo ya.")).status()).isEqualTo(403);
        assertThat(api.post(reopen, tokenDe("AUDITOR"), Map.of("justificacion", "Quiero reabrirlo ya.")).status()).isEqualTo(403);

        assertThat(api.post(reopen, analyst, Map.of("justificacion", "Falta verificar el ingreso.")).status()).isEqualTo(200);
        TestApi.Response reopened = api.get("/v1/solicitudes-credito/" + appId, analyst);
        assertThat(reopened.str("estado")).isEqualTo("en_evaluacion");
        assertThat(reopened.obj("decisionRiesgo").get("result")).as("el dictamen anterior sigue visible como contexto")
                .isEqualTo("aprobado");

        // Se dictamina de nuevo, y un rechazo también se puede reabrir.
        assertThat(api.post(evaluation, analyst, Map.of("resultado", "rechazado", "justificacion", "El ingreso no alcanza."))
                .status()).isEqualTo(200);
        assertThat(api.get("/v1/solicitudes-credito/" + appId, analyst).str("estado")).isEqualTo("rechazada");
        assertThat(api.post(reopen, analyst, Map.of("justificacion", "El cliente trajo otro comprobante.")).status())
                .isEqualTo(200);
        assertThat(eventos("solicitud_credito.reabierta", appId)).isEqualTo(2);
        String previous = jdbc.sql("""
                        select despues->>'estado_anterior' from auditoria_evento
                        where accion = 'solicitud_credito.reabierta' and entidad_id = :id
                        order by creado_en desc limit 1
                        """)
                .param("id", UUID.fromString(appId), java.sql.Types.OTHER).query(String.class).single();
        assertThat(previous).isEqualTo("rechazada");

        // Con la venta cerrada o el crédito desembolsado ya no.
        assertThat(api.post(evaluation, analyst, Map.of("resultado", "aprobado", "justificacion", "Ahora sí cumple.",
                "limiteAprobado", 14400, "cuotaMaximaPermitida", 1000)).status()).isEqualTo(200);
        jdbc.sql("update oportunidad set etapa = 'cerrado_ganado' where id = :id")
                .param("id", opportunityId, java.sql.Types.OTHER).update();
        assertThat(api.post(reopen, analyst, Map.of("justificacion", "Se me ocurrió reabrirlo.")).status()).isEqualTo(409);
        jdbc.sql("update oportunidad set etapa = 'negociacion' where id = :id")
                .param("id", opportunityId, java.sql.Types.OTHER).update();
        creditApplications.updateStatus(UUID.fromString(appId), "desembolsada");
        assertThat(api.post(reopen, analyst, Map.of("justificacion", "Se me ocurrió reabrirlo.")).status()).isEqualTo(409);
    }

    /**
     * Token de un usuario con ese rol. El administrador es el de arranque: crear otro rompería la
     * regla de «al menos un administrador» que UserAdminIntegrationTest prueba en la base compartida.
     */
    private String tokenDe(String rol) {
        return "ADMINISTRADOR".equals(rol) ? accounts.adminToken() : accounts.createAndLogin("sin_credito", rol).token();
    }

    private int abrir(String ruta) throws Exception {
        return mvc.perform(get(URI.create(ruta))).andReturn().getResponse().getStatus();
    }

    private long eventos(String accion, String entidadId) {
        return jdbc.sql("select count(*) from auditoria_evento where accion = :accion and entidad_id = :id")
                .param("accion", accion)
                .param("id", UUID.fromString(entidadId), java.sql.Types.OTHER)
                .query(Long.class)
                .single();
    }

    /** Carga un recaudo con el enlace de la prueba, como el paso 6 del formulario. */
    private TestApi.Response cargarRecaudo(String tipo, String nombre, String contentType, byte[] contenido) {
        return api.upload("/v1/solicitudes-credito/recaudos", null, nombre, contentType, contenido,
                Map.of("token", financingToken, "tipoDocumento", tipo));
    }

    private Map<String, Object> recaudoCargado(String tipo, String nombre, String contentType, byte[] contenido) {
        TestApi.Response cargado = cargarRecaudo(tipo, nombre, contentType, contenido);
        assertThat(cargado.status()).as(String.valueOf(cargado.body())).isEqualTo(200);
        return cargado.map();
    }

    private String recaudoDe(String appId) {
        return jdbc.sql("select id from solicitud_recaudo where solicitud_id = :id order by creado_en limit 1")
                .param("id", UUID.fromString(appId), java.sql.Types.OTHER)
                .query(UUID.class)
                .single()
                .toString();
    }

    /** Solicitud con dos recaudos cargados de verdad con el enlace: cédula (JPG) y RIF (PDF). */
    private Map<String, Object> solicitudCompleta() {
        return solicitudCon(List.of(
                recaudoCargado("cedula", "cedula.jpg", "image/jpeg", JPEG),
                recaudoCargado("rif", "rif.pdf", "application/pdf", PDF)));
    }

    private Map<String, Object> solicitudCon(List<Map<String, Object>> recaudos) {
        return Map.ofEntries(
                Map.entry("token", financingToken),
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
                Map.entry("recaudos", recaudos),
                Map.entry("versionTexto", "WMA-F-FIN-001 v1")
        );
    }
}
