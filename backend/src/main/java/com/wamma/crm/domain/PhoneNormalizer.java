package com.wamma.crm.domain;

import java.util.Optional;
import java.util.Set;

/**
 * Celular venezolano: 10 dígitos nacionales, el primero un 4, y una operadora admitida.
 * Misma regla y mismos mensajes que {@code validarMovil} del frontend
 * ({@code validacion/venezuela.ts}).
 * <p>
 * La forma canónica es E.164 ({@code +584141234567}). {@code 0414…}, {@code 414…},
 * {@code 58414…} y {@code +58 414-…} son el mismo número y dan el mismo índice ciego: si no,
 * la misma persona entraría dos veces (spec 010 RF-010.2).
 */
public final class PhoneNormalizer {

    /** Códigos de operadora móvil admitidos, los mismos que en el frontend. */
    private static final Set<String> MOBILE_OPERATORS = Set.of("12", "14", "16", "24", "26");

    private PhoneNormalizer() {
    }

    /** Por qué el celular no es válido, o vacío si lo es. */
    public static Optional<String> mobileProblem(String raw) {
        String digits = nationalDigits(raw);
        if (digits.isEmpty()) {
            return Optional.of("El teléfono celular es obligatorio");
        }
        if (digits.length() != 10) {
            return Optional.of("Un celular tiene 10 dígitos");
        }
        if (digits.charAt(0) != '4') {
            return Optional.of("Un celular empieza por 4");
        }
        String operator = digits.substring(1, 3);
        if (!MOBILE_OPERATORS.contains(operator)) {
            return Optional.of(operator + " no es un código de operadora válido");
        }
        return Optional.empty();
    }

    /**
     * Forma E.164 de un celular válido.
     *
     * @throws IllegalArgumentException con el motivo, si no es válido
     */
    public static String mobileE164(String raw) {
        mobileProblem(raw).ifPresent(problem -> {
            throw new IllegalArgumentException(problem);
        });
        return "+58" + nationalDigits(raw);
    }

    /** Número para el enlace {@code wa.me}, que no admite el {@code +}. */
    public static String forWhatsApp(String e164) {
        return e164.startsWith("+") ? e164.substring(1) : e164;
    }

    /** Reduce a los 10 dígitos nacionales, quitando el 58 o el 0 inicial si sobran. */
    private static String nationalDigits(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("\\D", "");
        if (digits.startsWith("58") && digits.length() == 12) {
            digits = digits.substring(2);
        }
        if (digits.startsWith("0") && digits.length() == 11) {
            digits = digits.substring(1);
        }
        return digits;
    }
}
