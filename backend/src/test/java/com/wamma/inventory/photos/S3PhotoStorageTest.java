package com.wamma.inventory.photos;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * El adaptador S3 contra un servidor falso: rutas de estilo "path", tipo de contenido y
 * cuerpo sin transformar. Contra Supabase se prueba en el despliegue (plan 005 §9).
 */
class S3PhotoStorageTest {

    @Test
    void uploadsAndDeletesWithPathStyleUrls() throws Exception {
        List<String> requests = new CopyOnWriteArrayList<>();
        Map<String, byte[]> objects = new ConcurrentHashMap<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            requests.add(exchange.getRequestMethod() + " " + path + " " + exchange.getRequestHeaders().getFirst("Content-Type"));
            byte[] body = exchange.getRequestBody().readAllBytes();
            switch (exchange.getRequestMethod()) {
                case "PUT" -> {
                    objects.put(path, body);
                    exchange.getResponseHeaders().add("ETag", "\"ensayo\"");
                    exchange.sendResponseHeaders(200, -1);
                }
                case "DELETE" -> {
                    objects.remove(path);
                    exchange.sendResponseHeaders(204, -1);
                }
                default -> exchange.sendResponseHeaders(400, -1);
            }
            exchange.close();
        });
        server.start();
        String endpoint = "http://127.0.0.1:" + server.getAddress().getPort();
        String publicBase = "https://ejemplo.supabase.co/storage/v1/object/public/vehiculos/";
        try (S3PhotoStorage storage = new S3PhotoStorage(
                new PhotoStorageProperties.S3(endpoint, "us-east-1", "vehiculos", "clave-ensayo", "secreto-ensayo"),
                publicBase)) {
            byte[] content = {1, 2, 3, 4, 5};
            storage.put("veh-001/abc-1600.jpg", content, "image/jpeg");

            assertThat(requests.getFirst()).isEqualTo("PUT /vehiculos/veh-001/abc-1600.jpg image/jpeg");
            assertThat(objects.get("/vehiculos/veh-001/abc-1600.jpg")).containsExactly(content);
            assertThat(storage.publicUrl("veh-001/abc-1600.jpg"))
                    .isEqualTo("https://ejemplo.supabase.co/storage/v1/object/public/vehiculos/veh-001/abc-1600.jpg");

            storage.delete("veh-001/abc-1600.jpg");
            assertThat(objects).isEmpty();
        } finally {
            server.stop(0);
        }
    }

    @Test
    void refusesToStartWithoutItsVariables() {
        assertThatThrownBy(() -> new S3PhotoStorage(new PhotoStorageProperties.S3("", "", "vehiculos", "", ""), ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("WAMMA_S3_ENDPOINT")
                .hasMessageContaining("WAMMA_S3_SECRET_KEY")
                .hasMessageContaining("WAMMA_FOTOS_URL_PUBLICA");
    }

    @Test
    void keysCannotEscapeTheirFolder() {
        assertThatThrownBy(() -> PhotoStorage.requireSafeKey("../secreto.txt")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PhotoStorage.requireSafeKey("/raiz.jpg")).isInstanceOf(IllegalArgumentException.class);
        PhotoStorage.requireSafeKey("veh-001/5f3c-1600.jpg");
    }
}
