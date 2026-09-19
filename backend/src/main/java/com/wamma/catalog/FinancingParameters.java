package com.wamma.catalog;

import java.math.BigDecimal;
import java.util.List;

/**
 * Parámetros de financiamiento vigentes (D-26, tabla {@code parametros_financiamiento}).
 * Los nombres de los campos son los que consume la vitrina.
 *
 * @param tasaMensual        interés mensual, en tanto por uno
 * @param plazoMeses         plazo del crédito
 * @param ratioCuotaIngreso  parte del ingreso que puede comprometer la cuota
 * @param opcionesInicial    iniciales ofrecidas, en tanto por uno
 * @param inicialMinima      inicial mínima admitida, en tanto por uno
 * @param monedaBase         moneda en que se expresan los montos
 */
public record FinancingParameters(
        BigDecimal tasaMensual,
        int plazoMeses,
        BigDecimal ratioCuotaIngreso,
        List<BigDecimal> opcionesInicial,
        BigDecimal inicialMinima,
        String monedaBase) {
}
