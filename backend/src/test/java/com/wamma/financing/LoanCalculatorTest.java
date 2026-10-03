package com.wamma.financing;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Pruebas obligatorias del cálculo de cuotas (CLAUDE.md): sistema francés, política vigente, sin flotantes. */
class LoanCalculatorTest {

    private static final BigDecimal RATE = new BigDecimal("0.04");

    @Test
    void theFrenchPaymentOf12320AtFourPercentOver24MonthsIs808_03() {
        assertThat(LoanCalculator.monthlyPayment(new BigDecimal("12320"), RATE, 24)).isEqualByComparingTo("808.03");
    }

    @Test
    void theOtherReferenceCasesOfTheEngineMatchTheWebCalculator() {
        // 15.400 con 20 % de inicial → 12.320 financiados (mismo caso que `financiamientoMotor.test.ts`).
        assertThat(LoanCalculator.monthlyPayment(new BigDecimal("14400"), RATE, 24)).isEqualByComparingTo("944.45");
        assertThat(LoanCalculator.monthlyPayment(new BigDecimal("7120"), RATE, 24)).isEqualByComparingTo("466.98");
    }

    @Test
    void thePaymentIsNotTheNaiveDivisionWithoutInterest() {
        // El error C-01: 12.320 / 24 = 513,33 (sin intereses).
        assertThat(LoanCalculator.monthlyPayment(new BigDecimal("12320"), RATE, 24))
                .isGreaterThan(new BigDecimal("513.33"));
    }

    @Test
    void nothingToFinanceMeansNoPayment() {
        assertThat(LoanCalculator.monthlyPayment(BigDecimal.ZERO, RATE, 24)).isEqualByComparingTo("0");
        assertThat(LoanCalculator.monthlyPayment(new BigDecimal("-5"), RATE, 24)).isEqualByComparingTo("0");
        assertThat(LoanCalculator.monthlyPayment(null, RATE, 24)).isEqualByComparingTo("0");
    }

    @Test
    void aMissingRateOrTermIsAnErrorNotAZero() {
        assertThatThrownBy(() -> LoanCalculator.monthlyPayment(new BigDecimal("1000"), BigDecimal.ZERO, 24))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> LoanCalculator.monthlyPayment(new BigDecimal("1000"), RATE, 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void capacityIsThirtyPercentOfTheIncomeCountedOnce() {
        assertThat(LoanCalculator.paymentCapacity(new BigDecimal("3800"), new BigDecimal("0.30")))
                .isEqualByComparingTo("1140.00");
        // Sin ingresos no hay capacidad.
        assertThat(LoanCalculator.paymentCapacity(BigDecimal.ZERO, new BigDecimal("0.30"))).isEqualByComparingTo("0");
    }

    @Test
    void theMinimumDownPaymentRoundsToTheCent() {
        assertThat(LoanCalculator.minimumDownPayment(new BigDecimal("15400"), new BigDecimal("0.20")))
                .isEqualByComparingTo("3080.00");
        assertThat(LoanCalculator.minimumDownPayment(new BigDecimal("8900"), new BigDecimal("0.20")))
                .isEqualByComparingTo("1780.00");
    }
}
