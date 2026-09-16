package com.wamma.platform.identity;

import java.time.Instant;
import java.util.UUID;

/** Fila de {@code usuario}. El secreto TOTP llega cifrado; solo {@code AuthService} lo descifra. */
public record UserAccount(
        UUID id,
        String username,
        String email,
        String firstName,
        String lastName,
        String status,
        String passwordHash,
        byte[] totpSecretEncrypted,
        Instant totpActivatedAt,
        Long totpLastStep,
        int failedAttempts,
        Instant lockedUntil,
        boolean mustChangePassword,
        Instant lastLogin,
        Instant createdAt) {

    public static final String ACTIVE = "activo";
    public static final String INACTIVE = "inactivo";

    public boolean active() {
        return ACTIVE.equals(status);
    }

    public boolean totpActive() {
        return totpActivatedAt != null;
    }

    public boolean lockedAt(Instant now) {
        return lockedUntil != null && lockedUntil.isAfter(now);
    }
}
