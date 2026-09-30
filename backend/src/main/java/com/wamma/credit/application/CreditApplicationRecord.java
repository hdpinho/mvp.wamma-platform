package com.wamma.credit.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

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
        String personalDataJson,
        String contactDataJson,
        String employmentDataJson,
        String financialDataJson,
        String referencesJson,
        String bankingDataJson,
        String declarationsJson,
        String acceptanceEvidenceJson,
        BigDecimal monthlyCapacity,
        BigDecimal estimatedPayment,
        String paymentFrequency,
        String status,
        Instant submittedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
