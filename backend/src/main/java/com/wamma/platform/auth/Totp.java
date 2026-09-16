package com.wamma.platform.auth;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;
import java.util.OptionalLong;

/**
 * Códigos temporales de un solo uso, RFC 6238 (plan 001 §6): HMAC-SHA1, 6 dígitos y pasos
 * de 30 segundos. Compatible con Google Authenticator, Microsoft Authenticator y Authy.
 */
public final class Totp {

    public static final int DIGITS = 6;
    public static final int PERIOD_SECONDS = 30;
    /** Pasos aceptados a cada lado del actual, por desfase de reloj. */
    private static final int WINDOW_STEPS = 1;
    private static final int SECRET_BYTES = 20;
    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {
    }

    /** Secreto aleatorio de 160 bits, el tamaño que recomienda el RFC 4226. */
    public static byte[] newSecret() {
        byte[] secret = new byte[SECRET_BYTES];
        RANDOM.nextBytes(secret);
        return secret;
    }

    public static long step(Instant instant) {
        return Math.floorDiv(instant.getEpochSecond(), PERIOD_SECONDS);
    }

    public static String code(byte[] secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret, "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24)
                    | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8)
                    | (hash[offset + 3] & 0xff);
            return String.format(Locale.ROOT, "%06d", binary % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA1 no disponible", e);
        }
    }

    /**
     * Verifica un código contra el paso actual y sus vecinos, y devuelve el paso aceptado.
     * Un paso igual o anterior al último usado se rechaza: un código no sirve dos veces
     * (CA-001.6).
     */
    public static OptionalLong verify(byte[] secret, String code, Instant now, Long lastUsedStep) {
        if (code == null || !code.matches("\\d{" + DIGITS + "}")) {
            return OptionalLong.empty();
        }
        byte[] presented = code.getBytes(StandardCharsets.US_ASCII);
        long current = step(now);
        for (long candidate = current - WINDOW_STEPS; candidate <= current + WINDOW_STEPS; candidate++) {
            if (lastUsedStep != null && candidate <= lastUsedStep) {
                continue;
            }
            if (MessageDigest.isEqual(code(secret, candidate).getBytes(StandardCharsets.US_ASCII), presented)) {
                return OptionalLong.of(candidate);
            }
        }
        return OptionalLong.empty();
    }

    /** URI {@code otpauth://} que la app autenticadora lee del código QR. */
    public static String otpauthUri(String issuer, String account, byte[] secret) {
        String label = URLEncoder.encode(issuer + ":" + account, StandardCharsets.UTF_8).replace("+", "%20");
        return "otpauth://totp/" + label
                + "?secret=" + base32(secret)
                + "&issuer=" + URLEncoder.encode(issuer, StandardCharsets.UTF_8).replace("+", "%20")
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + PERIOD_SECONDS;
    }

    /** Base32 (RFC 4648) sin relleno, como lo esperan las apps autenticadoras. */
    public static String base32(byte[] data) {
        StringBuilder out = new StringBuilder((data.length * 8 + 4) / 5);
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                out.append(BASE32.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) {
            out.append(BASE32.charAt((buffer << (5 - bits)) & 31));
        }
        return out.toString();
    }

    public static byte[] fromBase32(String text) {
        String clean = text.replace("=", "").replace(" ", "").toUpperCase(Locale.ROOT);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int buffer = 0;
        int bits = 0;
        for (char c : clean.toCharArray()) {
            int value = BASE32.indexOf(c);
            if (value < 0) {
                throw new IllegalArgumentException("Texto Base32 inválido");
            }
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8) {
                out.write((buffer >> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return out.toByteArray();
    }
}
