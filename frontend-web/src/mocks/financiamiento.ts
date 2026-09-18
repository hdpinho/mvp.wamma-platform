/**
 * Parámetros y adaptadores de financiamiento para compatibilidad hacia atrás.
 *
 * Todas las fórmulas matemáticas han sido unificadas en `services/financiamientoMotor.ts`.
 * Este archivo delega estrictamente en dicho motor para evitar divergencia de cálculos.
 */

import {
  PARAMETROS_APROBADOS,
  calcularFactor,
  calcularCuota as motorCalcularCuota,
  calcularCuotaMaxima,
  calcularPrecioMaximo,
  calcularIngresoMinimo,
  simularOpciones,
  formatoUSD,
  formatoVES,
  NOTA_BLOQUEO_VEHICULO,
} from '../services/financiamientoMotor';

export {
  PARAMETROS_APROBADOS,
  calcularFactor,
  calcularCuotaMaxima,
  calcularPrecioMaximo,
  calcularIngresoMinimo,
  simularOpciones,
  formatoUSD,
  formatoVES,
  NOTA_BLOQUEO_VEHICULO,
};

export const PARAMETROS_FINANCIAMIENTO = {
  tasaMensual: PARAMETROS_APROBADOS.tasaMensual,
  tasaAnual: PARAMETROS_APROBADOS.tasaMensual * 12,
  plazosMeses: [24],
  plazoPorDefecto: PARAMETROS_APROBADOS.plazoMeses,
  /** Inicial mínima aprobada: 20% */
  inicialPorcentaje: PARAMETROS_APROBADOS.inicialMinima,
  /** Opciones de inicial aprobadas: 20%, 30%, 40% */
  inicialesDisponibles: PARAMETROS_APROBADOS.opcionesInicial,
  /** Capacidad de pago máxima aprobada: 30% del ingreso mensual */
  porcentajeCapacidadPago: PARAMETROS_APROBADOS.ratioCuotaIngreso,
} as const;

/** Nota legal que acompaña toda cuota mostrada en la interfaz. */
export const NOTA_CUOTA =
  'Cuota fija en euros bajo sistema francés. Sujeto a evaluación crediticia.';

/**
 * Cuota fija mensual delegada en el motor unificado de financiamiento.
 * Conserva la firma (montoFinanciado, plazo, tasa) para componentes internos del backoffice.
 */
export function calcularCuota(
  montoFinanciado: number,
  plazoMeses: number = PARAMETROS_APROBADOS.plazoMeses,
  tasaMensual: number = PARAMETROS_APROBADOS.tasaMensual,
): number {
  if (montoFinanciado <= 0 || plazoMeses <= 0 || tasaMensual <= 0) return 0;
  const factor = calcularFactor(tasaMensual, plazoMeses);
  return montoFinanciado * factor;
}

/**
 * Cuota "desde" que se muestra en las tarjetas del catálogo:
 * Calculada con la opción de inicial máxima (40%) y el plazo fijo de 24 meses.
 */
export function cuotaDesde(precio: number): number {
  return motorCalcularCuota(precio, 0.40, PARAMETROS_APROBADOS);
}

/** Genera la tabla de amortización con el factor francés del motor unificado. */
export function generarAmortizacion(
  montoFinanciado: number,
  plazoMeses: number = PARAMETROS_APROBADOS.plazoMeses,
  tasaMensual: number = PARAMETROS_APROBADOS.tasaMensual,
) {
  const factor = calcularFactor(tasaMensual, plazoMeses);
  const cuota = montoFinanciado * factor;
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
