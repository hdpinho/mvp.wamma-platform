package com.wamma.platform.crypto;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;

/**
 * Enlaces firmados de corta duración (D-59): HMAC-SHA256 del recurso y de su vencimiento.
 * <p>
 * La clave se deriva de la del índice ciego con una etiqueta propia, así que una firma no sirve
 * como índice ni un índice como firma. Quien altere el recurso o alargue el vencimiento invalida
 * la firma; pasado el vencimiento, el enlace deja de abrir aunque la firma sea correcta.
 */
public final class SignedLinks {

    private static final String ALGORITHM = "HmacSHA256";
    private static final String DERIVATION_LABEL = "wamma.enlaces-firmados.v1";

    private final SecretKeySpec key;

    public SignedLinks(byte[] indexKey) {
        if (indexKey == null || indexKey.length != 32) {
            throw new IllegalArgumentException("La clave de los enlaces firmados debe tener 32 bytes");
        }
        this.key = new SecretKeySpec(hmac(new SecretKeySpec(indexKey.clone(), ALGORITHM),
                DERIVATION_LABEL.getBytes(StandardCharsets.UTF_8)), ALGORITHM);
    }

    /** Firma hexadecimal del recurso válida hasta {@code expiresAt} (segundos desde la época). */
    public String sign(String resource, long expiresAt) {
        byte[] message = (resource + "\n" + expiresAt).getBytes(StandardCharsets.UTF_8);
        return HexFormat.of().formatHex(hmac(key, message));
    }

    /** Verdadero si la firma corresponde al recurso y al vencimiento, y el enlace no ha vencido. */
    public boolean verify(String resource, long expiresAt, String signature, Instant now) {
        if (resource == null || signature == null || now.getEpochSecond() > expiresAt) {
            return false;
        }
        byte[] expected = sign(resource, expiresAt).getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(expected, signature.getBytes(StandardCharsets.US_ASCII));
    }

    private static byte[] hmac(SecretKeySpec key, byte[] message) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            return mac.doFinal(message);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("No se pudo firmar el enlace", e);
        }
    }
}
