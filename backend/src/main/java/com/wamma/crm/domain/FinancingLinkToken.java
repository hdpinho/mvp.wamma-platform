package com.wamma.crm.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * Token del enlace personal de financiamiento (spec 010 §8.8, plan 010 E7).
 * <p>
 * 32 bytes aleatorios en Base64 URL, sin relleno: 43 caracteres. En la base solo se guarda
 * su SHA-256; el token se le muestra al asesor una sola vez, para que lo envíe. Quien lea
 * la base no puede reconstruir un enlace válido.
 */
public final class FinancingLinkToken {

    public static final int RANDOM_BYTES = 32;
    private static final Pattern SHAPE = Pattern.compile("[A-Za-z0-9_-]{43}");

    /** El token para el cliente y la huella que se guarda. */
    public record Issued(String token, String hash) {
    }

    private FinancingLinkToken() {
    }

    public static Issued issue(SecureRandom random) {
        byte[] bytes = new byte[RANDOM_BYTES];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        return new Issued(token, hash(token));
    }

    /** SHA-256 en hexadecimal: 64 caracteres, apto para {@code oportunidad.enlace_token_hash}. */
    public static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no está disponible en esta JVM", e);
        }
    }

    /** Si tiene la forma de un token emitido. Lo que no la tiene se rechaza sin consultar la base. */
    public static boolean hasValidShape(String token) {
        return token != null && SHAPE.matcher(token).matches();
    }
}
