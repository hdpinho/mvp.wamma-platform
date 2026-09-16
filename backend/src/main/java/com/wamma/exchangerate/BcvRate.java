package com.wamma.exchangerate;

import com.wamma.platform.money.CurrencyCode;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Tasa oficial del BCV de un día: bolívares por unidad de la moneda (D-13, plan 005 E2).
 *
 * @param recordedBy  nombre de usuario de quien la registró
 * @param correctedBy nombre de usuario de quien la corrigió por última vez, si alguien lo hizo
 */
public record BcvRate(UUID id, LocalDate date, CurrencyCode currency, BigDecimal vesPerUnit, String source,
                      Instant recordedAt, String recordedBy, Instant correctedAt, String correctedBy) {
}
