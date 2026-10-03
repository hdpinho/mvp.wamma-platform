package com.wamma.crm.domain;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Optional;

/**
 * Franja horaria de una cita. La base solo admite {@code manana} y {@code tarde} (sin tilde),
 * pero quien escribe «Mañana» o «MAÑANA» quiere decir lo mismo: se normaliza antes de llegar
 * a la base, donde un valor distinto es un error interno en vez de un 422 claro.
 */
public enum AppointmentSlot {

    MORNING("manana"),
    AFTERNOON("tarde");

    private final String code;

    AppointmentSlot(String code) {
        this.code = code;
    }

    /** El valor que se guarda y que devuelve la API. */
    public String code() {
        return code;
    }

    /** Acepta mayúsculas, espacios y la tilde de «mañana». */
    public static Optional<AppointmentSlot> parse(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String plain = Normalizer.normalize(raw.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        for (AppointmentSlot slot : values()) {
            if (slot.code.equals(plain)) {
                return Optional.of(slot);
            }
        }
        return Optional.empty();
    }
}
