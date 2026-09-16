package com.wamma.platform.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;

class TotpTest {

    /** Secreto de los vectores del RFC 6238, apéndice B (SHA-1). */
    private static final byte[] RFC_SECRET = "12345678901234567890".getBytes(StandardCharsets.US_ASCII);

    /** El RFC publica 8 dígitos; los 6 que usamos son los 6 últimos. */
    @ParameterizedTest
    @CsvSource({
            "59, 287082",
            "1111111109, 081804",
            "1111111111, 050471",
            "1234567890, 005924",
            "2000000000, 279037",
            "20000000000, 353130"
    })
    void matchesRfc6238Vectors(long epochSeconds, String expected) {
        assertThat(Totp.code(RFC_SECRET, Totp.step(Instant.ofEpochSecond(epochSeconds)))).isEqualTo(expected);
    }

    @Test
    void acceptsNeighbourStepsForClockDrift() {
        Instant now = Instant.ofEpochSecond(1_111_111_111L);
        long current = Totp.step(now);
        assertThat(Totp.verify(RFC_SECRET, Totp.code(RFC_SECRET, current - 1), now, null)).hasValue(current - 1);
        assertThat(Totp.verify(RFC_SECRET, Totp.code(RFC_SECRET, current + 1), now, null)).hasValue(current + 1);
    }

    @Test
    void rejectsCodesOutsideTheWindow() {
        Instant now = Instant.ofEpochSecond(1_111_111_111L);
        long current = Totp.step(now);
        assertThat(Totp.verify(RFC_SECRET, Totp.code(RFC_SECRET, current - 2), now, null)).isEmpty();
        assertThat(Totp.verify(RFC_SECRET, Totp.code(RFC_SECRET, current + 2), now, null)).isEmpty();
    }

    @Test
    void rejectsReusedCodes() {
        Instant now = Instant.ofEpochSecond(1_111_111_111L);
        String code = Totp.code(RFC_SECRET, Totp.step(now));
        OptionalLong accepted = Totp.verify(RFC_SECRET, code, now, null);
        assertThat(accepted).isPresent();
        assertThat(Totp.verify(RFC_SECRET, code, now, accepted.getAsLong())).isEmpty();
    }

    @Test
    void rejectsMalformedCodes() {
        Instant now = Instant.now();
        assertThat(Totp.verify(RFC_SECRET, null, now, null)).isEmpty();
        assertThat(Totp.verify(RFC_SECRET, "12345", now, null)).isEmpty();
        assertThat(Totp.verify(RFC_SECRET, "abcdef", now, null)).isEmpty();
    }

    @Test
    void base32FollowsRfc4648WithoutPadding() {
        assertThat(Totp.base32("foobar".getBytes(StandardCharsets.US_ASCII))).isEqualTo("MZXW6YTBOI");
        assertThat(Totp.fromBase32("MZXW6YTBOI")).isEqualTo("foobar".getBytes(StandardCharsets.US_ASCII));
        byte[] secret = Totp.newSecret();
        assertThat(Totp.fromBase32(Totp.base32(secret))).isEqualTo(secret);
    }

    @Test
    void otpauthUriCarriesIssuerAccountAndParameters() {
        String uri = Totp.otpauthUri("WAMMA", "hdpinho", RFC_SECRET);
        assertThat(uri)
                .startsWith("otpauth://totp/WAMMA%3Ahdpinho?secret=")
                .contains("&issuer=WAMMA", "&algorithm=SHA1", "&digits=6", "&period=30");
    }
}
