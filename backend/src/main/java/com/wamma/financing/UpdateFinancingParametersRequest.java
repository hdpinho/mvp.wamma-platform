package com.wamma.financing;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record UpdateFinancingParametersRequest(
        @JsonProperty("tasa_mensual")
        @NotNull(message = "La tasa mensual es obligatoria")
        @DecimalMin(value = "0.0001", message = "La tasa mensual debe ser mayor que 0")
        BigDecimal monthlyRate,

        @JsonProperty("plazo_meses")
        @Min(value = 1, message = "El plazo en meses debe ser mayor que 0")
        int termMonths,

        @JsonProperty("ratio_cuota_ingreso")
        @NotNull(message = "El ratio cuota/ingreso es obligatorio")
        @DecimalMin(value = "0.01", message = "El ratio debe ser al menos 0.01")
        @DecimalMax(value = "1.00", message = "El ratio no puede ser mayor a 1.00")
        BigDecimal paymentToIncomeRatio,

        @JsonProperty("opciones_inicial")
        @NotEmpty(message = "Debe incluir opciones de inicial")
        List<BigDecimal> downPaymentOptions,

        @JsonProperty("inicial_minima")
        @NotNull(message = "La inicial mínima es obligatoria")
        @DecimalMin(value = "0.01", message = "La inicial mínima debe ser al menos 0.01")
        @DecimalMax(value = "1.00", message = "La inicial mínima no puede ser mayor a 1.00")
        BigDecimal minimumDownPayment,

        @JsonProperty("moneda_base")
        String baseCurrency
) {
}
