package com.wamma.platform.identity;

import java.security.SecureRandom;

/**
 * Contraseñas temporales para altas y restablecimientos: 16 caracteres aleatorios sin
 * ambigüedades, en grupos de cuatro. Se muestran una sola vez al administrador y el usuario
 * debe cambiarla en su siguiente ingreso.
 */
public final class TemporaryPasswords {

    private static final String ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private TemporaryPasswords() {
    }

    public static String generate(PasswordPolicy policy, String username) {
        while (true) {
            StringBuilder password = new StringBuilder(19);
            for (int i = 0; i < 16; i++) {
                if (i > 0 && i % 4 == 0) {
                    password.append('-');
                }
                password.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            if (policy.violation(password.toString(), username).isEmpty()) {
                return password.toString();
            }
        }
    }
}
