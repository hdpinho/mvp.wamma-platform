package com.wamma.crm.domain;

/**
 * Una fila de {@code catalogo_motivo_perdida} (spec 010 §8.2). El catálogo es cerrado a
 * propósito: un campo libre produce cien redacciones del mismo motivo y ninguna métrica.
 *
 * @param requiresText si exige un texto que lo explique ({@code otro})
 */
public record LossReason(String code, String name, boolean requiresText) {
}
