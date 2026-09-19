package com.wamma.platform.auth;

import com.wamma.platform.config.SecurityProperties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La curva del retardo progresivo (D-40), que es lógica pura y se puede probar sin base.
 * El comportamiento sobre la base vive en {@link LoginRateLimitIntegrationTest}: desde el
 * spec 011 §6.3 el estado del límite ya no está en memoria.
 */
class LoginRateLimiterTest {

    private static SecurityProperties conCurva(List<Integer> curva) {
        return new SecurityProperties("", "", Duration.ofMinutes(30), Duration.ofHours(12),
                Duration.ofMinutes(5), 12, 5, Duration.ofMinutes(15), 20, Duration.ofMinutes(10), curva);
    }

    @Test
    @DisplayName("La curva aprobada da 0, 1, 2, 4 y 8 segundos")
    void sigueLaCurvaAprobada() {
        SecurityProperties properties = conCurva(List.of(0, 1, 2, 4, 8));

        assertThat(properties.delayAfter(0)).isZero();
        assertThat(properties.delayAfter(1)).isEqualTo(1);
        assertThat(properties.delayAfter(2)).isEqualTo(2);
        assertThat(properties.delayAfter(3)).isEqualTo(4);
        assertThat(properties.delayAfter(4)).isEqualTo(8);
    }

    @Test
    @DisplayName("El último valor es el tope y no se pasa de ahí")
    void elUltimoValorEsElTope() {
        SecurityProperties properties = conCurva(List.of(0, 1, 2, 4, 8));

        assertThat(properties.delayAfter(5)).isEqualTo(8);
        assertThat(properties.delayAfter(50)).isEqualTo(8);
        assertThat(properties.delayAfter(Integer.MAX_VALUE)).isEqualTo(8);
    }

    @Test
    @DisplayName("Sin curva configurada no hay retardo: las pruebas de otros módulos dependen de ello")
    void sinCurvaNoHayRetardo() {
        assertThat(conCurva(List.of()).delayAfter(9)).isZero();
        assertThat(conCurva(null).delayAfter(9)).isZero();
    }
}
