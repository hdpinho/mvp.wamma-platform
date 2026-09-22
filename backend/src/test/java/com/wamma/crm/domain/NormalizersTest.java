package com.wamma.crm.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cédula y celular (spec 010 RF-010.2). Mismos casos y mensajes que
 * {@code validacion/venezuela.ts} del frontend.
 */
class NormalizersTest {

    @Test
    void theSameCedulaWrittenInManyWaysIsOne() {
        for (String raw : new String[]{"V12345678", "v-12.345.678", " V 12345678 ", "V.12345678"}) {
            assertThat(CedulaNormalizer.canonical(raw)).isEqualTo("V12345678");
        }
        assertThat(CedulaNormalizer.canonical("e-1234567")).isEqualTo("E1234567");
        assertThat(CedulaNormalizer.problem("V123456")).isEmpty();
        assertThat(CedulaNormalizer.problem("V123456789")).isEmpty();
    }

    @Test
    void anInvalidCedulaSaysWhy() {
        assertThat(CedulaNormalizer.problem(null)).contains("La cédula es obligatoria");
        assertThat(CedulaNormalizer.problem(" - ")).contains("La cédula es obligatoria");
        assertThat(CedulaNormalizer.problem("J12345678")).contains("El prefijo debe ser V o E");
        assertThat(CedulaNormalizer.problem("V")).contains("La cédula solo admite dígitos tras el prefijo");
        assertThat(CedulaNormalizer.problem("V12A45678")).contains("La cédula solo admite dígitos tras el prefijo");
        assertThat(CedulaNormalizer.problem("V12345")).contains("La cédula debe tener entre 6 y 9 dígitos");
        assertThat(CedulaNormalizer.problem("V1234567890")).contains("La cédula debe tener entre 6 y 9 dígitos");
        assertThatThrownBy(() -> CedulaNormalizer.canonical("12345678"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("El prefijo debe ser V o E");
    }

    @Test
    void theSameMobileWrittenInManyWaysIsOne() {
        for (String raw : new String[]{"04141234567", "4141234567", "584141234567", "+58 414-123.45.67", "(0414) 123 4567"}) {
            assertThat(PhoneNormalizer.mobileE164(raw)).isEqualTo("+584141234567");
        }
        for (String operator : new String[]{"412", "414", "416", "424", "426"}) {
            assertThat(PhoneNormalizer.mobileProblem("0" + operator + "1234567")).isEmpty();
        }
    }

    @Test
    void anInvalidMobileSaysWhy() {
        assertThat(PhoneNormalizer.mobileProblem(null)).contains("El teléfono celular es obligatorio");
        assertThat(PhoneNormalizer.mobileProblem("sin número")).contains("El teléfono celular es obligatorio");
        assertThat(PhoneNormalizer.mobileProblem("041412345")).contains("Un celular tiene 10 dígitos");
        assertThat(PhoneNormalizer.mobileProblem("0414123456")).contains("Un celular empieza por 4");
        assertThat(PhoneNormalizer.mobileProblem("5804141234567")).contains("Un celular tiene 10 dígitos");
        assertThat(PhoneNormalizer.mobileProblem("02121234567")).contains("Un celular empieza por 4");
        assertThat(PhoneNormalizer.mobileProblem("04151234567")).contains("15 no es un código de operadora válido");
        assertThatThrownBy(() -> PhoneNormalizer.mobileE164("0212 555 1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Un celular empieza por 4");
    }

    @Test
    void whatsAppLinksDropThePlus() {
        assertThat(PhoneNormalizer.forWhatsApp("+584141234567")).isEqualTo("584141234567");
        assertThat(PhoneNormalizer.forWhatsApp("584141234567")).isEqualTo("584141234567");
    }
}
