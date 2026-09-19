package com.wamma.platform.auth;

import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Límite de ingreso con la curva real de D-40 (spec 011 §6.3). Contexto propio: el resto de
 * las pruebas corre con la curva a cero, porque hacen muchos ingresos seguidos.
 */
@TestPropertySource(properties = {
        "wamma.security.login-delay-curve-seconds=0,1,2,4,8",
        "wamma.security.login-attempts-per-ip=20"
})
class LoginRateLimitIntegrationTest extends ApiIntegrationTest {

    @org.springframework.beans.factory.annotation.Autowired
    private LoginRateLimiter limiter;

    @BeforeEach
    @AfterEach
    void limpiarEstadoDelLimite() {
        // También al terminar, y no solo al empezar: el PostgreSQL embebido lo comparten
        // todas las pruebas, y esta clase adelanta su reloj. Si dejara filas con el
        // `proximo_intento_admitido_en` en ese futuro, las demás clases —cuyo reloj va por
        // detrás— recibirían 429 en ingresos que deberían darles 401.
        jdbc.sql("delete from intento_ingreso").update();
    }

    @Test
    @DisplayName("La curva crece 1, 2, 4, 8 y se queda en 8")
    void laCurvaCreceYTopeEnOchoSegundos() {
        for (int esperado : new int[] {1, 2, 4, 8, 8}) {
            avanzarMasDe(esperado);
            assertThat(fallarIngreso("usuario.curva").status())
                    .as("el intento en sí debe pasar el límite y fallar por credenciales")
                    .isEqualTo(401);

            TestApi.Response rechazado = fallarIngreso("usuario.curva");
            assertThat(rechazado.status()).isEqualTo(429);
            assertThat(retryAfter(rechazado)).isEqualTo(esperado);
        }
    }

    @Test
    @DisplayName("Un ingreso correcto devuelve la cuenta a cero")
    void elIngresoCorrectoReinicia() {
        fallarIngreso("usuario.reinicio");
        assertThat(contarEstado()).isPositive();

        // Se llama al limitador directamente: montar un ingreso correcto de verdad exigiría
        // el flujo 2FA del administrador, cuyo último paso TOTP vive en la base compartida
        // y lo escriben contextos con relojes distintos. La regla que se quiere probar
        // —un acierto borra la cuenta— está aquí, no en el flujo.
        limiter.recordSuccess("127.0.0.1", "usuario.reinicio");

        assertThat(contarEstado()).isZero();
        assertThat(fallarIngreso("usuario.reinicio").status())
                .as("tras el acierto se vuelve a admitir el intento")
                .isEqualTo(401);
    }

    @Test
    @DisplayName("El rechazo es inmediato: el servidor no retiene el hilo")
    void elRechazoNoRetieneElHilo() {
        fallarIngreso("usuario.rapido");

        long inicio = System.nanoTime();
        TestApi.Response rechazado = fallarIngreso("usuario.rapido");
        long milisegundos = (System.nanoTime() - inicio) / 1_000_000;

        assertThat(rechazado.status()).isEqualTo(429);
        assertThat(retryAfter(rechazado)).isEqualTo(1);
        // Si alguien mete un sleep, esto tarda al menos el Retry-After anunciado.
        assertThat(milisegundos)
                .as("un 429 que tarda lo que anuncia significa que el hilo se quedó esperando")
                .isLessThan(900);
    }

    @Test
    @DisplayName("Un identificador inexistente se comporta igual que uno real")
    void noDelataQueCuentasExisten() {
        // El administrador basta como cuenta real: aquí solo se hacen ingresos fallidos,
        // así que no hace falta pasar por el 2FA.
        fallarIngreso(ADMIN_USERNAME);
        TestApi.Response trasCuentaReal = fallarIngreso(ADMIN_USERNAME);

        jdbc.sql("delete from intento_ingreso").update();

        fallarIngreso("no.existe.en.absoluto");
        TestApi.Response trasCuentaFalsa = fallarIngreso("no.existe.en.absoluto");

        assertThat(trasCuentaFalsa.status()).isEqualTo(trasCuentaReal.status());
        assertThat(retryAfter(trasCuentaFalsa)).isEqualTo(retryAfter(trasCuentaReal));
    }

    @Test
    @DisplayName("La IP y el usuario se cuentan por separado")
    void ipYUsuarioSeCuentanPorSeparado() {
        fallarIngreso("usuario.uno");

        // Dos usuarios desde la misma IP SÍ comparten el freno de la IP: es el objetivo del
        // límite por IP, no un efecto colateral. Para ver la dimensión del usuario hay que
        // soltar la de la IP, que es lo que haría una petición desde otra conexión.
        assertThat(fallarIngreso("usuario.dos").status())
                .as("el freno de la IP alcanza a cualquier usuario desde esa IP")
                .isEqualTo(429);

        jdbc.sql("delete from intento_ingreso where tipo = 'ip'").update();

        assertThat(fallarIngreso("usuario.dos").status())
                .as("suelta la IP, un usuario sin fallos previos entra al intento")
                .isEqualTo(401);
        jdbc.sql("delete from intento_ingreso where tipo = 'ip'").update();
        assertThat(fallarIngreso("usuario.uno").status())
                .as("mientras que el que ya falló sigue frenado por su propio contador")
                .isEqualTo(429);
    }

    @Test
    @DisplayName("El límite sobrevive al reinicio del proceso porque vive en la base")
    void elLimiteVieneDeLaBase() {
        fallarIngreso("usuario.persistente");

        assertThat(jdbc.sql("""
                        select count(*) from intento_ingreso
                        where tipo = 'usuario' and identificador = 'usuario.persistente'
                        """)
                .query(Integer.class).single())
                .as("sin fila en la base, el límite se perdería en cada despliegue")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("Pasado el techo de fallos, la congelación es larga")
    void trasElTechoCongelaLaVentanaCompleta() {
        for (int i = 0; i < 20; i++) {
            avanzarMasDe(8);
            fallarIngreso("usuario.techo");
        }

        avanzarMasDe(8);
        TestApi.Response rechazado = fallarIngreso("usuario.techo");
        assertThat(rechazado.status()).isEqualTo(429);
        assertThat(retryAfter(rechazado)).isGreaterThan(60);
    }

    private TestApi.Response fallarIngreso(String usuario) {
        return api.post("/v1/auth/ingreso", null, Map.of("usuario", usuario, "contrasena", "clave incorrecta"));
    }

    private void avanzarMasDe(int segundos) {
        clock.advance(Duration.ofSeconds(segundos + 2));
    }

    private int contarEstado() {
        return jdbc.sql("select count(*) from intento_ingreso").query(Integer.class).single();
    }

    private static int retryAfter(TestApi.Response respuesta) {
        String cabecera = respuesta.header("Retry-After");
        return cabecera == null ? -1 : Integer.parseInt(cabecera);
    }
}
