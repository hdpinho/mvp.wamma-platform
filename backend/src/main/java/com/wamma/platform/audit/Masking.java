package com.wamma.platform.audit;

/** Enmascarado de datos personales antes de que entren en la bitácora (plan 001 §8). */
public final class Masking {

    private Masking() {
    }

    /** {@code pjjulio@gmail.com} → {@code p******@gmail.com}. */
    public static String email(String email) {
        if (email == null || email.isBlank()) {
            return email;
        }
        int at = email.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        return email.charAt(0) + "*".repeat(Math.max(3, at - 1)) + email.substring(at);
    }
}
