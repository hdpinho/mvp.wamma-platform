package com.wamma.platform.web;

import com.wamma.support.PostgresIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.TestPropertySource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Resolución de la IP del cliente detrás de un proxy (spec 011 §6.3).
 * <p>
 * Necesita un Tomcat de verdad: {@code RemoteIpValve} es una válvula del contenedor y MockMvc
 * no la ejecuta, así que con MockMvc estas pruebas pasarían sin probar nada.
 * <p>
 * Es la regresión del defecto que motivó el cambio: con
 * {@code forward-headers-strategy: framework} se tomaba el <em>primer</em> elemento de
 * {@code X-Forwarded-For}, que es el que el cliente controla. Detrás de un balanceador que
 * añade en vez de reemplazar —un ALB de AWS— bastaba una cabecera inventada para evadir el
 * límite de ingreso y ensuciar la bitácora con IPs falsas.
 */
class XForwardedForTest {

    /** El caso peligroso: la petición NO viene de un proxy de confianza. */
    @Nested
    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
    @TestPropertySource(properties = {
            "server.forward-headers-strategy=native",
            // 10.x no incluye 127.0.0.1: el cliente de la prueba no es de confianza.
            // Ojo con las barras: @TestPropertySource parsea en formato Properties, donde
            // la barra invertida es un escape. Van dobles para que a la regex llegue una.
            "server.tomcat.remoteip.internal-proxies=10\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}"
    })
    class DesdeUnOrigenNoConfiable extends PostgresIntegrationTest {

        @LocalServerPort
        int puerto;

        @Autowired
        JdbcClient jdbc;

        @Test
        @DisplayName("Una X-Forwarded-For inventada se ignora: se registra la IP real")
        void ignoraLaCabeceraFalsificada() throws Exception {
            jdbc.sql("delete from intento_ingreso").update();
            intentarIngreso(puerto, "9.9.9.9", "prueba.no.confiable");

            assertThat(ipRegistradaPara(jdbc, "prueba.no.confiable"))
                    .as("si aquí apareciera 9.9.9.9, cualquiera podría evadir el límite y "
                            + "falsear la bitácora con una cabecera")
                    .isNotEqualTo("9.9.9.9")
                    .isIn("127.0.0.1", "0:0:0:0:0:0:0:1");
        }
    }

    /** El caso normal en producción: Render y un ALB sí son proxies de confianza. */
    @Nested
    @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
    @TestPropertySource(properties = {
            "server.forward-headers-strategy=native",
            "server.tomcat.remoteip.internal-proxies=127\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}|0:0:0:0:0:0:0:1|::1"
    })
    class DesdeUnProxyConfiable extends PostgresIntegrationTest {

        @LocalServerPort
        int puerto;

        @Autowired
        JdbcClient jdbc;

        @Test
        @DisplayName("Tras un proxy de confianza sí se usa la IP que reenvía")
        void confiaEnElProxyConocido() throws Exception {
            jdbc.sql("delete from intento_ingreso").update();
            intentarIngreso(puerto, "203.0.113.7", "prueba.confiable");

            assertThat(ipRegistradaPara(jdbc, "prueba.confiable"))
                    .as("sin esto, en Render todas las peticiones parecerían venir del proxy "
                            + "y el límite por IP dejaría fuera al backoffice entero")
                    .isEqualTo("203.0.113.7");
        }
    }

    private static void intentarIngreso(int puerto, String forwardedFor, String usuario) throws Exception {
        try (HttpClient cliente = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()) {
            HttpRequest peticion = HttpRequest.newBuilder()
                    .uri(URI.create("http://127.0.0.1:" + puerto + "/v1/auth/ingreso"))
                    .header("Content-Type", "application/json")
                    .header("X-Forwarded-For", forwardedFor)
                    .POST(HttpRequest.BodyPublishers.ofString(
                            "{\"usuario\":\"" + usuario + "\",\"contrasena\":\"clave incorrecta\"}"))
                    .build();
            cliente.send(peticion, HttpResponse.BodyHandlers.ofString());
        }
    }

    /**
     * La IP que la bitácora guardó para <em>ese</em> intento. Se filtra por usuario porque el
     * PostgreSQL embebido lo comparten todas las pruebas: sin el filtro, esto leía la fila
     * del otro caso y la prueba pasaba o fallaba según el orden de ejecución.
     */
    private static String ipRegistradaPara(JdbcClient jdbc, String usuario) {
        return jdbc.sql("""
                        select ip_origen from auditoria_evento
                        where accion = 'sesion.fallida' and despues->>'usuario' = :usuario
                        order by creado_en desc limit 1
                        """)
                .param("usuario", usuario)
                .query(String.class)
                .single();
    }
}
