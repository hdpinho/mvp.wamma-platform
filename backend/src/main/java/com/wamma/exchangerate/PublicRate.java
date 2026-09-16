package com.wamma.exchangerate;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Tasa tal como la ve el público: sin quién la registró. */
public record PublicRate(LocalDate fecha, String moneda, BigDecimal tasa, String fuente) {

    public static PublicRate of(BcvRate rate) {
        return new PublicRate(rate.date(), rate.currency().name(), rate.vesPerUnit(), rate.source());
    }
}
