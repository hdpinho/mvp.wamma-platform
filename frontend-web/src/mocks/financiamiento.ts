/**
 * Parámetros de financiamiento — DATOS SIMULADOS.
 *
 * Reusa las cifras que ya trae `mocks/credito.ts` (4% mensual / 48% anual / 12 meses)
 * para que la vitrina, la ficha y Mi Panel muestren lo mismo.
 *
 * `[NEEDS CLARIFICATION]` Estas cifras NO están confirmadas como las condiciones
 * reales de WAMMA. Provienen de la generación inicial de la maqueta. Antes de
 * cualquier uso comercial deben validarse contra el módulo 006 (motor de riesgo)
 * y el 007 (pagos y ledger).
 *
 * Principio V de la Constitución: en producción los montos NO se calculan con
 * coma flotante. Aquí se usa `number` únicamente porque es una maqueta visual
 * sin lógica de negocio; el backend en Go usará precisión fija.
 */

export const PARAMETROS_FINANCIAMIENTO = {
  tasaMensual: 0.04,
  tasaAnual: 0.48,
  plazosMeses: [6, 12, 18, 24],
  plazoPorDefecto: 12,
  /** Porcentaje de inicial exigido sobre el precio del vehículo. */
  inicialPorcentaje: 0.3,
  inicialesDisponibles: [0.3, 0.4, 0.5, 0.6],
} as const;

/** Nota legal que acompaña toda cuota mostrada en la interfaz. */
export const NOTA_CUOTA =
  'Cuota estimada con datos simulados, sujeta a aprobación crediticia. No constituye una oferta.';

/**
 * Cuota fija mensual (sistema francés).
 *
 *   cuota = M · i / (1 − (1 + i)^−n)
 *
 * @param montoFinanciado monto a financiar en USD
 * @param plazoMeses      número de cuotas
 * @param tasaMensual     tasa de interés mensual en tanto por uno
 */
export function calcularCuota(
  montoFinanciado: number,
  plazoMeses: number = PARAMETROS_FINANCIAMIENTO.plazoPorDefecto,
  tasaMensual: number = PARAMETROS_FINANCIAMIENTO.tasaMensual,
): number {
  if (montoFinanciado <= 0 || plazoMeses <= 0) return 0;
  if (tasaMensual === 0) return montoFinanciado / plazoMeses;
  return (montoFinanciado * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -plazoMeses));
}

/**
 * Cuota "desde" que se muestra en las tarjetas del catálogo: la más baja posible,
 * es decir con la inicial más alta y el plazo más largo disponibles.
 */
export function cuotaDesde(precioUSD: number): number {
  const inicialMaxima = Math.max(...PARAMETROS_FINANCIAMIENTO.inicialesDisponibles);
  const plazoMaximo = Math.max(...PARAMETROS_FINANCIAMIENTO.plazosMeses);
  return calcularCuota(precioUSD * (1 - inicialMaxima), plazoMaximo);
}

/** Genera la tabla de amortización de un crédito simulado. */
export function generarAmortizacion(
  montoFinanciado: number,
  plazoMeses: number,
  tasaMensual: number = PARAMETROS_FINANCIAMIENTO.tasaMensual,
) {
  const cuota = calcularCuota(montoFinanciado, plazoMeses, tasaMensual);
  let saldo = montoFinanciado;

  return Array.from({ length: plazoMeses }, (_, i) => {
    const interes = saldo * tasaMensual;
    const capital = cuota - interes;
    saldo -= capital;
    return {
      numero: i + 1,
      capital,
      interes,
      monto: cuota,
      saldo: Math.max(saldo, 0),
    };
  });
}
