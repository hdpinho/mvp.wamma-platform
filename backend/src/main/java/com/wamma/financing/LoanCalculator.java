package com.wamma.financing;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

/**
 * Cálculo del crédito en el servidor: la única fuente de la cuota y de la capacidad de pago (hallazgos C-01 y C-02).
 * Lo que el navegador muestra es referencial; lo que se guarda y se dictamina se calcula aquí, con la política vigente.
 * <p>
 * Sistema francés, cuota fija: {@code cuota = P · i / (1 − (1 + i)^−n)}. El cálculo interno conserva toda la precisión
 * y el redondeo ocurre una sola vez, al centavo, al final (Principio V).
 */
public final class LoanCalculator {

    private static final MathContext PRECISION = MathContext.DECIMAL128;

    private LoanCalculator() {
    }

    /** Cuota mensual fija de un préstamo, redondeada al centavo. Cero si no hay nada que financiar. */
    public static BigDecimal monthlyPayment(BigDecimal principal, BigDecimal monthlyRate, int months) {
        if (principal == null || principal.signum() <= 0) {
            return BigDecimal.ZERO.setScale(2);
        }
        if (monthlyRate == null || monthlyRate.signum() <= 0 || months <= 0) {
            throw new IllegalArgumentException("La tasa mensual y el plazo deben ser mayores que cero");
        }
        BigDecimal growth = BigDecimal.ONE.add(monthlyRate).pow(months, PRECISION);
        BigDecimal discount = BigDecimal.ONE.divide(growth, PRECISION);
        BigDecimal denominator = BigDecimal.ONE.subtract(discount, PRECISION);
        return principal.multiply(monthlyRate, PRECISION)
                .divide(denominator, PRECISION)
                .setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Capacidad de pago mensual: el porcentaje vigente del ingreso mensual comprobable (decisión del PO: 30 %).
     * Los egresos se declaran para el analista, pero no restan.
     */
    public static BigDecimal paymentCapacity(BigDecimal monthlyIncome, BigDecimal ratio) {
        if (monthlyIncome == null || monthlyIncome.signum() <= 0 || ratio == null) {
            return BigDecimal.ZERO.setScale(2);
        }
        return monthlyIncome.multiply(ratio).setScale(2, RoundingMode.HALF_UP);
    }

    /** Inicial mínima de un precio: el porcentaje vigente, redondeado al centavo. */
    public static BigDecimal minimumDownPayment(BigDecimal price, BigDecimal ratio) {
        return price.multiply(ratio).setScale(2, RoundingMode.HALF_UP);
    }
}
