package com.wamma.financing;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record FinancingParametersResponse(
        @JsonProperty("id") String id,
        @JsonProperty("tasa_mensual") BigDecimal monthlyRate,
        @JsonProperty("plazo_meses") int termMonths,
        @JsonProperty("ratio_cuota_ingreso") BigDecimal paymentToIncomeRatio,
        @JsonProperty("opciones_inicial") List<BigDecimal> downPaymentOptions,
        @JsonProperty("inicial_minima") BigDecimal minimumDownPayment,
        @JsonProperty("moneda_base") String baseCurrency,
        @JsonProperty("vigente_desde") Instant effectiveFrom,
        @JsonProperty("activo") boolean active
) {
    public static FinancingParametersResponse of(FinancingParameters p) {
        return new FinancingParametersResponse(
                p.id() != null ? p.id().toString() : null,
                p.monthlyRate(),
                p.termMonths(),
                p.paymentToIncomeRatio(),
                p.downPaymentOptions(),
                p.minimumDownPayment(),
                p.baseCurrency(),
                p.effectiveFrom(),
                p.active()
        );
    }
}
