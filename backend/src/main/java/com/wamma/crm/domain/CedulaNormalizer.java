package com.wamma.crm.domain;

import java.util.Locale;
import java.util.Optional;

/**
 * Cédula venezolana: prefijo V o E y de 6 a 9 dígitos. Misma regla y mismos mensajes que
 * {@code validarCedula} del frontend ({@code validacion/venezuela.ts}); la validación que
 * manda es esta, la del servidor.
 * <p>
 * La forma canónica ({@code V12345678}) es la que entra al índice ciego: dos grafías de la
 * misma cédula ({@code v-12.345.678}, {@code V 12345678}) tienen que dar el mismo índice, o la
 * deduplicación falla (spec 010 RF-010.2).
 */
public final class CedulaNormalizer {

    private CedulaNormalizer() {
    }

    /** Por qué la cédula no es válida, o vacío si lo es. */
    public static Optional<String> problem(String raw) {
        String clean = clean(raw);
        if (clean.isEmpty()) {
            return Optional.of("La cédula es obligatoria");
        }
        char prefix = clean.charAt(0);
        if (prefix != 'V' && prefix != 'E') {
            return Optional.of("El prefijo debe ser V o E");
        }
        String digits = clean.substring(1);
        if (!digits.matches("\\d+")) {
            return Optional.of("La cédula solo admite dígitos tras el prefijo");
        }
        if (digits.length() < 6 || digits.length() > 9) {
            return Optional.of("La cédula debe tener entre 6 y 9 dígitos");
        }
        return Optional.empty();
    }

    /**
     * Forma canónica de una cédula válida.
     *
     * @throws IllegalArgumentException con el motivo, si no es válida
     */
    public static String canonical(String raw) {
        problem(raw).ifPresent(problem -> {
            throw new IllegalArgumentException(problem);
        });
        return clean(raw);
    }

    private static String clean(String raw) {
        return raw == null ? "" : raw.toUpperCase(Locale.ROOT).replaceAll("[-.\\s]", "");
    }
}
