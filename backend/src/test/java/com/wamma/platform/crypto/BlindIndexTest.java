package com.wamma.platform.crypto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BlindIndexTest {

    private final BlindIndex index = new BlindIndex(FieldCipherTest.sequence(0));

    @Test
    void isDeterministicAndHex64() {
        String a = index.of("+584141234567", "persona_telefono.telefono");
        assertThat(a).hasSize(64).matches("[0-9a-f]{64}");
        assertThat(index.of("+584141234567", "persona_telefono.telefono")).isEqualTo(a);
    }

    @Test
    void differsByValueContextAndKey() {
        String base = index.of("V12345678", "persona.cedula");
        assertThat(index.of("V12345679", "persona.cedula")).isNotEqualTo(base);
        assertThat(index.of("V12345678", "persona.correo")).isNotEqualTo(base);
        assertThat(new BlindIndex(FieldCipherTest.sequence(50)).of("V12345678", "persona.cedula")).isNotEqualTo(base);
    }

    @Test
    void rejectsWrongKeySize() {
        assertThatThrownBy(() -> new BlindIndex(new byte[31])).isInstanceOf(IllegalArgumentException.class);
    }
}
