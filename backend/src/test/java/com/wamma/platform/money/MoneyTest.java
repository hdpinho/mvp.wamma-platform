package com.wamma.platform.money;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MoneyTest {

    @Test
    void keepsTwoDecimalsAndRejectsMore() {
        assertThat(Money.of("10", CurrencyCode.EUR).amount().toPlainString()).isEqualTo("10.00");
        assertThat(Money.of("10.500", CurrencyCode.EUR).amount().toPlainString()).isEqualTo("10.50");
        assertThatThrownBy(() -> Money.of("10.001", CurrencyCode.EUR)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void convertsToBolivaresRoundingHalfUp() {
        Money price = Money.of("8900.00", CurrencyCode.EUR);
        // 8900 × 45,12345678 = 401 598,765342 → 401 598,77
        assertThat(price.convertTo(CurrencyCode.VES, new BigDecimal("45.12345678")))
                .isEqualTo(Money.of("401598.77", CurrencyCode.VES));
        // Justo en la mitad: HALF_UP sube (HALF_EVEN bajaría a 0,00).
        assertThat(Money.of("0.01", CurrencyCode.EUR).convertTo(CurrencyCode.VES, new BigDecimal("0.5")))
                .isEqualTo(Money.of("0.01", CurrencyCode.VES));
    }

    @Test
    void conversionNeedsAPositiveRateAndKeepsTheSameCurrency() {
        Money price = Money.of("100", CurrencyCode.EUR);
        assertThat(price.convertTo(CurrencyCode.EUR, new BigDecimal("40"))).isSameAs(price);
        assertThatThrownBy(() -> price.convertTo(CurrencyCode.VES, BigDecimal.ZERO))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void doesNotMixCurrencies() {
        assertThat(Money.of("1.50", CurrencyCode.EUR).plus(Money.of("2.25", CurrencyCode.EUR)))
                .isEqualTo(Money.of("3.75", CurrencyCode.EUR));
        assertThatThrownBy(() -> Money.of("1", CurrencyCode.EUR).plus(Money.of("1", CurrencyCode.VES)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
