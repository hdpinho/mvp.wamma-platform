package com.wamma.crm.domain;

import java.time.Duration;
import java.time.Instant;

/**
 * Plazos y límites del CRM aprobados por el PO (D-48).
 *
 * @param appointmentHold       cuánto reserva el vehículo una cita sin confirmar (C8: 24 h)
 * @param financingLinkValidity cuánto vale un enlace de financiamiento (C9: 7 días)
 * @param capturesPerIp         citas públicas admitidas por IP en la ventana (5)
 * @param capturesPerPhone      citas públicas admitidas por teléfono en la ventana (2)
 * @param captureWindow         ventana del límite de captación (24 h)
 */
public record CrmPolicy(Duration appointmentHold, Duration financingLinkValidity,
                        int capturesPerIp, int capturesPerPhone, Duration captureWindow) {

    /** Los valores de D-48. */
    public static final CrmPolicy APPROVED =
            new CrmPolicy(Duration.ofHours(24), Duration.ofDays(7), 5, 2, Duration.ofHours(24));

    public CrmPolicy {
        requirePositive(appointmentHold, "El plazo de la reserva");
        requirePositive(financingLinkValidity, "La vigencia del enlace");
        requirePositive(captureWindow, "La ventana del límite de captación");
        if (capturesPerIp < 1 || capturesPerPhone < 1) {
            throw new IllegalArgumentException("Los límites de captación deben admitir al menos una cita");
        }
    }

    private static void requirePositive(Duration duration, String what) {
        if (duration == null || duration.isNegative() || duration.isZero()) {
            throw new IllegalArgumentException(what + " debe ser mayor que cero");
        }
    }

    public Instant holdExpiresAt(Instant scheduledAt) {
        return scheduledAt.plus(appointmentHold);
    }

    /** Si la cita todavía reserva el vehículo. Una reserva sin vencimiento ya no reserva. */
    public boolean holdActive(Instant expiresAt, Instant now) {
        return expiresAt != null && now.isBefore(expiresAt);
    }

    public Instant linkExpiresAt(Instant issuedAt) {
        return issuedAt.plus(financingLinkValidity);
    }

    /** Si el enlace todavía sirve: emitido, sin usar y sin vencer. */
    public boolean linkUsable(Instant expiresAt, Instant usedAt, Instant now) {
        return usedAt == null && expiresAt != null && now.isBefore(expiresAt);
    }
}
