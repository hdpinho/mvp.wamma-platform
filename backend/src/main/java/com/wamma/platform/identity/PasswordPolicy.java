package com.wamma.platform.identity;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Política de contraseñas (plan 001, S5; D-24): longitud mínima, sin reglas de composición
 * (NIST SP 800-63B), y rechazo de las que contienen el nombre de usuario o son comunes.
 */
public final class PasswordPolicy {

    public static final int MAX_LENGTH = 128;
    private static final String COMMON_LIST = "/seguridad/contrasenas-comunes.txt";

    private final int minLength;
    private final Set<String> common;

    public PasswordPolicy(int minLength, Set<String> common) {
        this.minLength = minLength;
        this.common = common;
    }

    public static PasswordPolicy withBundledList(int minLength) {
        try (InputStream in = PasswordPolicy.class.getResourceAsStream(COMMON_LIST)) {
            if (in == null) {
                throw new IllegalStateException("Falta el recurso " + COMMON_LIST);
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                Set<String> words = reader.lines()
                        .map(String::trim)
                        .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                        .map(line -> line.toLowerCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
                return new PasswordPolicy(minLength, words);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public int minLength() {
        return minLength;
    }

    /** Motivo del rechazo, en español y listo para mostrar; vacío si la contraseña sirve. */
    public Optional<String> violation(String password, String username) {
        int length = password == null ? 0 : password.codePointCount(0, password.length());
        if (length < minLength) {
            return Optional.of("La contraseña debe tener al menos " + minLength + " caracteres.");
        }
        if (length > MAX_LENGTH) {
            return Optional.of("La contraseña no puede superar los " + MAX_LENGTH + " caracteres.");
        }
        String lower = password.toLowerCase(Locale.ROOT);
        if (username != null && username.length() >= 3 && lower.contains(username.toLowerCase(Locale.ROOT))) {
            return Optional.of("La contraseña no puede contener tu nombre de usuario.");
        }
        if (common.contains(lower) || lower.codePoints().distinct().count() == 1) {
            return Optional.of("Esa contraseña es demasiado común. Elige otra.");
        }
        return Optional.empty();
    }
}
