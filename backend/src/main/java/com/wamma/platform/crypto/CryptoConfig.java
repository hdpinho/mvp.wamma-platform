package com.wamma.platform.crypto;

import com.wamma.platform.config.SecurityProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.Base64;

/**
 * Claves de cifrado desde variables de entorno (D-05). Si falta alguna, o si son iguales,
 * el servidor no arranca: es preferible no arrancar a guardar datos sin cifrar.
 */
@Configuration
public class CryptoConfig {

    @Bean
    public FieldCipher fieldCipher(SecurityProperties properties) {
        return new FieldCipher(decodeKey(properties.encryptionKey(), "WAMMA_CLAVE_CIFRADO"));
    }

    @Bean
    public BlindIndex blindIndex(SecurityProperties properties) {
        byte[] indexKey = decodeKey(properties.indexKey(), "WAMMA_CLAVE_INDICE");
        if (Arrays.equals(indexKey, decodeKey(properties.encryptionKey(), "WAMMA_CLAVE_CIFRADO"))) {
            throw new IllegalStateException("WAMMA_CLAVE_INDICE debe ser distinta de WAMMA_CLAVE_CIFRADO");
        }
        return new BlindIndex(indexKey);
    }

    static byte[] decodeKey(String base64, String variable) {
        if (base64 == null || base64.isBlank()) {
            throw new IllegalStateException("Falta la variable " + variable
                    + ": el servidor no arranca sin sus claves de cifrado (plan 001 §7)");
        }
        byte[] key;
        try {
            key = Base64.getDecoder().decode(base64.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(variable + " no es Base64 válido", e);
        }
        if (key.length != 32) {
            throw new IllegalStateException(variable + " debe ser el Base64 de 32 bytes aleatorios");
        }
        return key;
    }
}
