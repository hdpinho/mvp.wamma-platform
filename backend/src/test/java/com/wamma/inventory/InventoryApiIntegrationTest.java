package com.wamma.inventory;

import com.wamma.exchangerate.ExchangeRateService;
import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.PostgresIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.InstanceOfAssertFactories.list;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Inventario, fotos, publicación, disponibilidad y vitrina contra la API real (spec 005 §11). */
class InventoryApiIntegrationTest extends ApiIntegrationTest {

    private static final Path PHOTOS = PostgresIntegrationTest.PHOTOS;

    private TestAccounts.Account manager;
    private TestAccounts.Account advisor;

    @BeforeEach
    void users() {
        manager = accounts.createAndLogin("inventario", "INVENTARIO");
        advisor = accounts.createAndLogin("asesora", "ASESOR_COMERCIAL");
    }

    @Test
    void aVehicleGoesFromDraftToTheShowcase() throws Exception {
        TestApi.Response created = api.post("/v1/inventario", manager.token(), vehicle(vin()));
        assertThat(created.status()).isEqualTo(201);
        String code = created.str("codigo");
        assertThat(code).matches("WAM-\\d{5}");
        assertThat(created.obj("publicacion").get("estado")).isEqualTo("borrador");
        assertThat(created.map().get("faltaParaPublicar")).asInstanceOf(list(String.class))
                .contains("Faltan 5 fotos (se necesitan al menos 5).");
        assertThat(api.get("/v1/catalogo/" + code, null).status()).isEqualTo(404);

        addPhotos(code, 5);
        clearEuroRates();
        TestApi.Response withoutRate = api.post("/v1/inventario/" + code + "/publicacion", manager.token(), null);
        assertThat(withoutRate.status()).isEqualTo(409);
        assertThat(withoutRate.str("detail")).contains("tasa BCV del euro");

        registerRate("40");
        TestApi.Response published = api.post("/v1/inventario/" + code + "/publicacion", manager.token(), null);
        assertThat(published.status()).isEqualTo(200);
        assertThat(published.obj("publicacion").get("estado")).isEqualTo("publicado");

        TestApi.Response catalog = api.get("/v1/catalogo", null);
        assertThat(catalog.status()).isEqualTo(200);
        Map<String, Object> item = findVehicle(catalog, code);
        assertThat(new BigDecimal(item.get("precioVes").toString())).isEqualByComparingTo("636020.00");
        assertThat(item).doesNotContainKeys("placa", "adquisicion");
        assertThat(item.get("certificado")).isEqualTo(true);
        assertThat((List<?>) item.get("imperfecciones")).hasSize(1);
        List<?> photos = (List<?>) item.get("fotos");
        assertThat(photos).hasSize(5);
        String url = ((Map<?, ?>) photos.getFirst()).get("url").toString();
        assertThat(url).startsWith("http://localhost/archivos/" + code + "/");
        mvc.perform(get(url.replace("http://localhost", "")))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"));

        Long publications = jdbc.sql("""
                        select count(*) from auditoria_evento e join vehiculo v on v.id = e.entidad_id
                        where v.codigo = :code and e.accion = 'publicacion.publicada'
                        """)
                .param("code", code)
                .query(Long.class)
                .single();
        assertThat(publications).isEqualTo(1);
    }

    @Test
    void onlyInventoryManagesAndTheAcquisitionStaysInternal() {
        Map<String, Object> input = vehicle(vin());
        input.put("placa", "ab123cd");
        input.put("adquisicion", Map.of("precio", 9000, "moneda", "USD", "tasaBcv", 36.5, "fecha", today().toString()));

        assertThat(api.post("/v1/inventario", advisor.token(), input).status()).isEqualTo(403);
        Long denials = jdbc.sql("select count(*) from auditoria_evento where accion = 'acceso.denegado' and actor_id = :id")
                .param("id", advisor.id())
                .query(Long.class)
                .single();
        assertThat(denials).isPositive();

        String code = api.post("/v1/inventario", manager.token(), input).str("codigo");
        assertThat(api.get("/v1/inventario/" + code, manager.token()).obj("adquisicion")).containsEntry("moneda", "USD");
        TestApi.Response asAdvisor = api.get("/v1/inventario/" + code, advisor.token());
        assertThat(asAdvisor.status()).isEqualTo(200);
        assertThat(asAdvisor.map().get("adquisicion")).isNull();
        assertThat(asAdvisor.str("placa")).isEqualTo("AB123CD");
    }

    @Test
    void aPublishedVehicleIsPausedNotDeletedAndKeepsItsMinimumPhotos() throws IOException {
        String code = publishedVehicle();
        String firstPhoto = ((Map<?, ?>) ((List<?>) api.get("/v1/inventario/" + code, manager.token()).map().get("fotos"))
                .getFirst()).get("id").toString();
        TestApi.Response belowMinimum = api.delete(photosPath(code) + "/" + firstPhoto, manager.token());
        assertThat(belowMinimum.status()).isEqualTo(409);
        assertThat(belowMinimum.str("detail")).contains("al menos 5 fotos");

        TestApi.Response delete = api.delete("/v1/inventario/" + code, manager.token());
        assertThat(delete.status()).isEqualTo(409);
        assertThat(delete.str("detail")).contains("pausa su publicación");

        TestApi.Response paused = api.delete("/v1/inventario/" + code + "/publicacion", manager.token());
        assertThat(paused.obj("publicacion").get("estado")).isEqualTo("pausado");
        assertThat(api.get("/v1/catalogo/" + code, null).status()).isEqualTo(404);

        String draft = api.post("/v1/inventario", manager.token(), vehicle(vin())).str("codigo");
        addPhotos(draft, 1);
        assertThat(api.delete("/v1/inventario/" + draft, manager.token()).status()).isEqualTo(204);
        assertThat(api.get("/v1/inventario/" + draft, manager.token()).status()).isEqualTo(404);
        try (Stream<Path> files = Files.list(PHOTOS.resolve(draft))) {
            assertThat(files).isEmpty();
        }
    }

    @Test
    void concurrentEditsAreDetected() {
        TestApi.Response created = api.post("/v1/inventario", manager.token(), vehicle(vin()));
        String code = created.str("codigo");
        Map<String, Object> edit = vehicle(created.str("vin"));
        edit.put("kilometraje", 46000);
        edit.put("certificado", false);
        edit.put("actualizadoEn", created.str("actualizadoEn"));

        TestApi.Response first = api.put("/v1/inventario/" + code, manager.token(), edit);
        assertThat(first.status()).isEqualTo(200);
        assertThat(first.map().get("kilometraje")).isEqualTo(46000);
        assertThat(first.map().get("certificado")).isEqualTo(false);

        TestApi.Response stale = api.put("/v1/inventario/" + code, manager.token(), edit);
        assertThat(stale.status()).isEqualTo(409);
        assertThat(stale.str("title")).isEqualTo("Cambio simultáneo");
    }

    @Test
    void availabilityFollowsTheCrmAndOnlyInventoryUndoesASale() {
        String code = publishedVehicle();
        assertThat(availability(code, advisor, "cita_agendada", null).status()).isEqualTo(200);
        assertThat(api.get("/v1/catalogo/" + code, null).str("disponibilidad")).isEqualTo("cita_agendada");

        assertThat(availability(code, advisor, "vendido", null).status()).isEqualTo(200);
        assertThat(api.get("/v1/catalogo/" + code, null).status()).isEqualTo(404);

        TestApi.Response undoByAdvisor = availability(code, advisor, "disponible", "Error de registro");
        assertThat(undoByAdvisor.status()).isEqualTo(409);
        assertThat(undoByAdvisor.str("detail")).isEqualTo("Solo el rol Inventario puede corregir un vehículo vendido.");
        assertThat(availability(code, manager, "disponible", null).status()).isEqualTo(409);
        assertThat(availability(code, manager, "disponible", "Venta anulada").status()).isEqualTo(200);
        assertThat(api.get("/v1/catalogo/" + code, null).status()).isEqualTo(200);
    }

    @Test
    void photosAreCappedOrderedAndRemovedFromStorage() {
        String code = api.post("/v1/inventario", manager.token(), vehicle(vin())).str("codigo");
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            ids.add(api.upload(photosPath(code), manager.token(), jpeg()).str("id"));
        }
        assertThat(api.upload(photosPath(code), manager.token(), jpeg()).status()).isEqualTo(409);

        List<String> reversed = new ArrayList<>(ids);
        Collections.reverse(reversed);
        TestApi.Response reordered = api.put(photosPath(code) + "/orden", manager.token(), Map.of("fotos", reversed));
        assertThat(reordered.status()).isEqualTo(200);
        assertThat(((Map<?, ?>) reordered.list().getFirst()).get("id")).isEqualTo(ids.getLast());

        String url = ((Map<?, ?>) reordered.list().getFirst()).get("url").toString();
        Path file = PHOTOS.resolve(url.substring("http://localhost/archivos/".length()));
        assertThat(Files.exists(file)).isTrue();
        assertThat(api.delete(photosPath(code) + "/" + ids.getLast(), manager.token()).status()).isEqualTo(204);
        assertThat(Files.exists(file)).isFalse();

        List<?> remaining = (List<?>) api.get("/v1/inventario/" + code, manager.token()).map().get("fotos");
        assertThat(remaining).hasSize(9);
        assertThat(((Map<?, ?>) remaining.getFirst()).get("orden")).isEqualTo(0);
        assertThat(api.upload(photosPath(code), manager.token(), "no es una foto".getBytes()).status()).isEqualTo(400);
    }

    @Test
    void invalidAndDuplicatedVehiclesGetClearMessages() {
        TestApi.Response badVin = api.post("/v1/inventario", manager.token(), vehicle("abc!"));
        assertThat(badVin.status()).isEqualTo(400);
        assertThat(badVin.str("title")).isEqualTo("VIN no válido");

        Map<String, Object> withoutBrand = vehicle(vin());
        withoutBrand.remove("marca");
        TestApi.Response missing = api.post("/v1/inventario", manager.token(), withoutBrand);
        assertThat(missing.status()).isEqualTo(400);
        assertThat(missing.obj("errores")).containsEntry("marca", "Indica la marca");

        String vin = vin();
        assertThat(api.post("/v1/inventario", manager.token(), vehicle(vin)).status()).isEqualTo(201);
        TestApi.Response duplicated = api.post("/v1/inventario", manager.token(), vehicle(vin.toLowerCase()));
        assertThat(duplicated.status()).isEqualTo(409);
        assertThat(duplicated.str("title")).isEqualTo("VIN duplicado");
    }

    @Test
    void publishReadyPublishesOnlyWhatIsReady() {
        String ready = api.post("/v1/inventario", manager.token(), vehicle(vin())).str("codigo");
        addPhotos(ready, 5);
        String notReady = api.post("/v1/inventario", manager.token(), vehicle(vin())).str("codigo");
        addPhotos(notReady, 1);
        registerRate("40");

        TestApi.Response batch = api.post("/v1/inventario/publicacion-en-lote", manager.token(), null);
        assertThat(batch.status()).isEqualTo(200);
        assertThat(batch.map().get("publicados")).asInstanceOf(list(String.class)).contains(ready).doesNotContain(notReady);
        assertThat(batch.map().get("pendientes")).asInstanceOf(list(Map.class)).anySatisfy(pending -> {
            assertThat(pending.get("codigo")).isEqualTo(notReady);
            assertThat(pending.get("motivos")).isEqualTo(List.of("Faltan 4 fotos (se necesitan al menos 5)."));
        });
    }

    private String publishedVehicle() {
        String code = api.post("/v1/inventario", manager.token(), vehicle(vin())).str("codigo");
        addPhotos(code, 5);
        registerRate("40");
        assertThat(api.post("/v1/inventario/" + code + "/publicacion", manager.token(), null).status()).isEqualTo(200);
        return code;
    }

    private TestApi.Response availability(String code, TestAccounts.Account account, String target, String reason) {
        Map<String, Object> body = new HashMap<>();
        body.put("disponibilidad", target);
        body.put("motivo", reason);
        return api.put("/v1/inventario/" + code + "/disponibilidad", account.token(), body);
    }

    private void addPhotos(String code, int count) {
        for (int i = 0; i < count; i++) {
            TestApi.Response response = api.upload(photosPath(code), manager.token(), jpeg());
            assertThat(response.status()).as(String.valueOf(response.body())).isEqualTo(201);
        }
    }

    private void registerRate(String rate) {
        TestApi.Response response = api.post("/v1/tasas-bcv", accounts.adminToken(),
                Map.of("fecha", today().toString(), "tasa", new BigDecimal(rate), "fuente", "BCV"));
        assertThat(response.status()).isEqualTo(200);
    }

    private void clearEuroRates() {
        jdbc.sql("delete from tasa_cambio_bcv where moneda = 'EUR'").update();
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(ExchangeRateService.VENEZUELA));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> findVehicle(TestApi.Response catalog, String code) {
        return ((List<Map<String, Object>>) catalog.map().get("vehiculos")).stream()
                .filter(vehicle -> code.equals(vehicle.get("codigo")))
                .findFirst()
                .orElseThrow();
    }

    private static String photosPath(String code) {
        return "/v1/inventario/" + code + "/fotos";
    }

    private static String vin() {
        return ("T" + UUID.randomUUID().toString().replace("-", "")).substring(0, 17).toUpperCase();
    }

    private static Map<String, Object> vehicle(String vin) {
        Map<String, Object> vehicle = new LinkedHashMap<>();
        vehicle.put("vin", vin);
        vehicle.put("marca", "Toyota");
        vehicle.put("modelo", "Corolla");
        vehicle.put("version", "XEI 1.8");
        vehicle.put("anio", 2020);
        vehicle.put("kilometraje", 45000);
        vehicle.put("transmision", "automatica");
        vehicle.put("combustible", "gasolina");
        vehicle.put("carroceria", "sedan");
        vehicle.put("puestos", 5);
        vehicle.put("traccion", "4x2");
        vehicle.put("color", "#FFFFFF");
        vehicle.put("precio", new BigDecimal("15900.50"));
        vehicle.put("etiqueta", "recien_ingresado");
        vehicle.put("certificado", true);
        vehicle.put("imperfecciones", List.of(Map.of("zona", "exterior", "tipo", "Rayón superficial",
                "descripcion", "No requiere repintado.", "severidad", "leve", "ubicacion", "Puerta delantera derecha",
                "x", 46, "y", 58)));
        return vehicle;
    }

    private static byte[] jpeg() {
        BufferedImage image = new BufferedImage(120, 90, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(Color.ORANGE);
        graphics.fillRect(0, 0, 120, 90);
        graphics.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            ImageIO.write(image, "jpeg", out);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return out.toByteArray();
    }
}
