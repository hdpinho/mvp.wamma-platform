package com.wamma.platform.crypto;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;

/**
 * Índice ciego: HMAC-SHA256 con una clave distinta de la de cifrado (plan 001 §7).
 * <p>
 * Permite buscar por igualdad (cédula, teléfono) sin descifrar nada. El contexto separa
 * los campos: el mismo valor en dos columnas produce índices distintos, así que no se
 * pueden cruzar. La normalización del valor la hace cada módulo antes de llamar aquí.
 */
public final class BlindIndex {

    private static final String ALGORITHM = "HmacSHA256";

    private final SecretKeySpec key;

    public BlindIndex(byte[] key) {
        if (key == null || key.length != 32) {
            throw new IllegalArgumentException("La clave del índice ciego debe tener 32 bytes");
        }
        this.key = new SecretKeySpec(key.clone(), ALGORITHM);
    }

    /** Hexadecimal de 64 caracteres, apto para las columnas {@code indice_ciego_*}. */
    public String of(String normalizedValue, String context) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            mac.update(context.getBytes(StandardCharsets.UTF_8));
            mac.update((byte) 0);
            return HexFormat.of().formatHex(mac.doFinal(normalizedValue.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("No se pudo calcular el índice ciego", e);
        }
    }
}
