package com.wamma.crm;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Una cita lista para la bandeja: con el nombre de la persona y el resumen del vehículo ya resueltos.
 * No trae teléfono ni correo: la pantalla los toma de la persona, que es quien los tiene.
 */
public record AppointmentView(
        UUID id,
        UUID personId,
        String personName,
        UUID opportunityId,
        UUID vehicleId,
        String vehicleCode,
        String vehicleBrand,
        String vehicleModel,
        int vehicleYear,
        LocalDate preferredDate,
        String slot,
        String status,
        String notes,
        Instant reservationExpiresAt,
        Instant createdAt
) {
}
