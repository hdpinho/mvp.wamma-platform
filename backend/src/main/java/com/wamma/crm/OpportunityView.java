package com.wamma.crm;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Una oportunidad lista para mostrarse: sus datos, el nombre de la persona y del asesor, el
 * resumen del vehículo y dos momentos que la pantalla necesita para el embudo (la última actividad
 * y cuándo entró a su etapa). Se arma en una sola consulta: armarla registro por registro eran
 * cuatro consultas por oportunidad.
 * <p>
 * De la solicitud de crédito vinculada solo trae su número y su estado (spec 010 CA-010.7): la capa
 * comercial sabe si el crédito se aprobó, no qué ingresos declaró el cliente.
 */
public record OpportunityView(
        UUID id,
        UUID personId,
        String personName,
        UUID vehicleId,
        String vehicleCode,
        String vehicleBrand,
        String vehicleModel,
        String vehicleVersion,
        int vehicleYear,
        String vehiclePhotoKey,
        String paymentMethod,
        BigDecimal estimatedValue,
        String currency,
        BigDecimal bcvRate,
        LocalDate rateDate,
        String stage,
        String lossReason,
        String lossDetail,
        UUID advisorId,
        String advisorName,
        String nextAction,
        LocalDate nextActionDate,
        UUID creditApplicationId,
        String creditApplicationNumber,
        String creditStatus,
        boolean hasFinancingLink,
        Instant financingLinkIssuedAt,
        Instant financingLinkExpiresAt,
        Instant financingLinkUsedAt,
        Instant closedAt,
        int version,
        Instant createdAt,
        Instant updatedAt,
        Instant lastActivityAt,
        Instant enteredStageAt
) {
}
