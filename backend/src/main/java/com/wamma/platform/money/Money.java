package com.wamma.platform.money;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/**
 * Monto con su moneda, en precisión fija de dos decimales (Principio V: nunca coma flotante).
 * <p>
 * Un monto con más de dos decimales se rechaza en lugar de redondearse en silencio: quien lo
 * envía debe saber que no es representable.
 */
public record Money(BigDecimal amount, CurrencyCode currency) {

    public static final int SCALE = 2;

    public Money {
        Objects.requireNonNull(amount, "amount");
        Objects.requireNonNull(currency, "currency");
        if (amount.stripTrailingZeros().scale() > SCALE) {
            throw new IllegalArgumentException("Un monto admite a lo sumo dos decimales: " + amount.toPlainString());
        }
        amount = amount.setScale(SCALE, RoundingMode.UNNECESSARY);
    }

    public static Money of(BigDecimal amount, CurrencyCode currency) {
        return new Money(amount, currency);
    }

    public static Money of(String amount, CurrencyCode currency) {
        return new Money(new BigDecimal(amount), currency);
    }

    public boolean isPositive() {
        return amount.signum() > 0;
    }

    /**
     * Convierte a otra moneda con una tasa expresada en unidades de destino por unidad de
     * origen (por ejemplo, bolívares por euro). El resultado se redondea a dos decimales
     * con {@link RoundingMode#HALF_UP}: es una equivalencia informativa, no un cobro.
     */
    public Money convertTo(CurrencyCode target, BigDecimal ratePerUnit) {
        Objects.requireNonNull(target, "target");
        Objects.requireNonNull(ratePerUnit, "ratePerUnit");
        if (ratePerUnit.signum() <= 0) {
            throw new IllegalArgumentException("La tasa debe ser positiva: " + ratePerUnit.toPlainString());
        }
        if (target == currency) {
            return this;
        }
        return new Money(amount.multiply(ratePerUnit).setScale(SCALE, RoundingMode.HALF_UP), target);
    }

    public Money plus(Money other) {
        requireSameCurrency(other);
        return new Money(amount.add(other.amount), currency);
    }

    private void requireSameCurrency(Money other) {
        if (other.currency != currency) {
            throw new IllegalArgumentException("No se suman montos en monedas distintas: " + currency + " y " + other.currency);
        }
    }

    @Override
    public String toString() {
        return amount.toPlainString() + " " + currency;
    }
}
