package com.wamma.platform.crypto;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;

/**
 * Cifrado de campo con AES-256-GCM (plan 001 §7).
 * <p>
 * Formato: {@code [versión de clave: 1 byte][IV: 12 bytes][cifrado + etiqueta de 16 bytes]}.
 * El contexto (tabla.columna) viaja como dato asociado: un cifrado copiado a otra columna
 * no se descifra, y GCM detecta cualquier alteración. El byte de versión permite rotar la
 * clave sin volver ilegible lo ya cifrado.
 */
public final class FieldCipher {

    private static final byte KEY_VERSION = 1;
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public FieldCipher(byte[] key) {
        if (key == null || key.length != 32) {
            throw new IllegalArgumentException("La clave de cifrado debe tener 32 bytes");
        }
        this.key = new SecretKeySpec(key.clone(), "AES");
    }

    public byte[] encrypt(String plaintext, String context) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));
            byte[] sealed = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return ByteBuffer.allocate(1 + IV_BYTES + sealed.length)
                    .put(KEY_VERSION)
                    .put(iv)
                    .put(sealed)
                    .array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("No se pudo cifrar el dato", e);
        }
    }

    public String decrypt(byte[] data, String context) {
        if (data == null || data.length < 1 + IV_BYTES + TAG_BITS / 8 || data[0] != KEY_VERSION) {
            throw new FieldDecryptionException();
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, data, 1, IV_BYTES));
            cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));
            byte[] plain = cipher.doFinal(data, 1 + IV_BYTES, data.length - 1 - IV_BYTES);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new FieldDecryptionException();
        }
    }
}
