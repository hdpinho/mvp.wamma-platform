package com.wamma.financing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record FinancingParameters(
        UUID id,
        BigDecimal monthlyRate,
        int termMonths,
        BigDecimal paymentToIncomeRatio,
        List<BigDecimal> downPaymentOptions,
        BigDecimal minimumDownPayment,
        String baseCurrency,
        Instant effectiveFrom,
        boolean active
) {
}
