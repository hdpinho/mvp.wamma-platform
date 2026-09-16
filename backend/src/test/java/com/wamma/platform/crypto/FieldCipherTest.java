package com.wamma.platform.crypto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FieldCipherTest {

    private static final byte[] KEY = sequence(0);
    private static final byte[] OTHER_KEY = sequence(100);

    private final FieldCipher cipher = new FieldCipher(KEY);

    @Test
    void roundTripsText() {
        byte[] sealed = cipher.encrypt("V-12345678", "persona.cedula");
        assertThat(cipher.decrypt(sealed, "persona.cedula")).isEqualTo("V-12345678");
    }

    @Test
    void sameTextEncryptsDifferentlyEachTime() {
        assertThat(cipher.encrypt("V-12345678", "persona.cedula"))
                .isNotEqualTo(cipher.encrypt("V-12345678", "persona.cedula"));
    }

    @Test
    void ciphertextDoesNotContainThePlaintext() {
        byte[] sealed = cipher.encrypt("V-12345678", "persona.cedula");
        assertThat(new String(sealed, java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("12345678");
    }

    @Test
    void tamperedDataFails() {
        byte[] sealed = cipher.encrypt("V-12345678", "persona.cedula");
        sealed[sealed.length - 1] ^= 1;
        assertThatThrownBy(() -> cipher.decrypt(sealed, "persona.cedula")).isInstanceOf(FieldDecryptionException.class);
    }

    @Test
    void anotherKeyCannotDecrypt() {
        byte[] sealed = cipher.encrypt("V-12345678", "persona.cedula");
        assertThatThrownBy(() -> new FieldCipher(OTHER_KEY).decrypt(sealed, "persona.cedula"))
                .isInstanceOf(FieldDecryptionException.class);
    }

    @Test
    void ciphertextCannotMoveToAnotherColumn() {
        byte[] sealed = cipher.encrypt("V-12345678", "persona.cedula");
        assertThatThrownBy(() -> cipher.decrypt(sealed, "persona.correo")).isInstanceOf(FieldDecryptionException.class);
    }

    @Test
    void rejectsGarbageAndWrongKeySizes() {
        assertThatThrownBy(() -> cipher.decrypt(new byte[]{1, 2, 3}, "x")).isInstanceOf(FieldDecryptionException.class);
        assertThatThrownBy(() -> new FieldCipher(new byte[16])).isInstanceOf(IllegalArgumentException.class);
    }

    static byte[] sequence(int start) {
        byte[] key = new byte[32];
        for (int i = 0; i < key.length; i++) {
            key[i] = (byte) (start + i);
        }
        return key;
    }
}
