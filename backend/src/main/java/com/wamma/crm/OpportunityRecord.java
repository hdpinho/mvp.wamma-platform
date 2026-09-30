package com.wamma.crm;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record OpportunityRecord(
        UUID id,
        UUID personId,
        UUID vehicleId,
        String paymentMethod,
        BigDecimal estimatedValue,
        String currency,
        BigDecimal bcvRate,
        LocalDate rateDate,
        String stage,
        String lossReason,
        String lossDetail,
        UUID advisorId,
        String nextAction,
        LocalDate nextActionDate,
        UUID creditApplicationId,
        String financingLinkTokenHash,
        Instant financingLinkIssuedAt,
        Instant financingLinkExpiresAt,
        Instant financingLinkUsedAt,
        Instant closedAt,
        int version,
        Instant createdAt,
        Instant updatedAt
) {
}
