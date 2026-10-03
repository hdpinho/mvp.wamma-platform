package com.wamma.platform.crypto;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SignedLinksTest {

    private static final String KEY = "recaudos/00000000-0000-0000-0000-000000000001/00000000-0000-0000-0000-000000000002.pdf";
    private static final Instant NOW = Instant.parse("2026-09-30T12:00:00Z");
    private static final long EXPIRES = NOW.plusSeconds(300).getEpochSecond();

    private final SignedLinks links = new SignedLinks(FieldCipherTest.sequence(0));

    @Test
    void opensTheSameResourceUntilItExpires() {
        String signature = links.sign(KEY, EXPIRES);
        assertThat(signature).matches("[0-9a-f]{64}");
        assertThat(links.verify(KEY, EXPIRES, signature, NOW)).isTrue();
        assertThat(links.verify(KEY, EXPIRES, signature, NOW.plusSeconds(300))).isTrue();
        assertThat(links.verify(KEY, EXPIRES, signature, NOW.plusSeconds(301))).isFalse();
    }

    @Test
    void anyAlterationInvalidatesTheSignature() {
        String signature = links.sign(KEY, EXPIRES);
        String otherKey = KEY.replace("0002.pdf", "0003.pdf");
        assertThat(links.verify(otherKey, EXPIRES, signature, NOW)).as("otro archivo").isFalse();
        assertThat(links.verify(KEY, EXPIRES + 3600, signature, NOW)).as("vencimiento alargado").isFalse();
        assertThat(links.verify(KEY, EXPIRES, signature.substring(0, 63) + (signature.endsWith("0") ? "1" : "0"), NOW))
                .as("firma alterada").isFalse();
        assertThat(links.verify(KEY, EXPIRES, signature.substring(0, 10), NOW)).as("firma recortada").isFalse();
        assertThat(links.verify(KEY, EXPIRES, null, NOW)).isFalse();
    }

    @Test
    void aSignatureIsNotABlindIndexWithTheSameKey() {
        byte[] key = FieldCipherTest.sequence(0);
        assertThat(new SignedLinks(key).sign(KEY, EXPIRES))
                .isNotEqualTo(new BlindIndex(key).of(KEY + "\n" + EXPIRES, ""));
        assertThat(new SignedLinks(FieldCipherTest.sequence(50)).sign(KEY, EXPIRES)).isNotEqualTo(links.sign(KEY, EXPIRES));
    }

    @Test
    void rejectsWrongKeySize() {
        assertThatThrownBy(() -> new SignedLinks(new byte[16])).isInstanceOf(IllegalArgumentException.class);
    }
}
