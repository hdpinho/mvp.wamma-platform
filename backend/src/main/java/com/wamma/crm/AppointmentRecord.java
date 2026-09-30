package com.wamma.crm;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record AppointmentRecord(
        UUID id,
        UUID personId,
        UUID opportunityId,
        UUID vehicleId,
        UUID siteId,
        LocalDate preferredDate,
        String slot,
        String status,
        String notes,
        Instant reservationExpiresAt,
        Instant createdAt,
        Instant updatedAt
) {
}
