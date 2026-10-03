package com.wamma.credit.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Solicitud de crédito con su expediente ya descifrado; en la base, el expediente va cifrado. */
public record CreditApplicationRecord(
        UUID id,
        String applicationNumber,
        UUID opportunityId,
        UUID personId,
        UUID vehicleId,
        BigDecimal requestedAmount,
        BigDecimal downPayment,
        int termMonths,
        String currency,
        BigDecimal bcvRate,
        LocalDate bcvRateDate,
        CreditDossier dossier,
        BigDecimal monthlyCapacity,
        BigDecimal estimatedPayment,
        String paymentFrequency,
        String status,
        Instant submittedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
