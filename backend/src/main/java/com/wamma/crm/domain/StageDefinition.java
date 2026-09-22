package com.wamma.crm.domain;

/**
 * Una fila de {@code catalogo_etapa} (spec 010 §8.1 y §8.6).
 *
 * @param stalledAfterDays días sin actividad tras los cuales una oportunidad abierta se
 *                         considera estancada; nulo en las etapas terminales
 */
public record StageDefinition(String code, String name, int order, boolean terminal, Integer stalledAfterDays) {
}
