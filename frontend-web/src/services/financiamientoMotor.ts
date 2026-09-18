/**
 * Motor Unificado de Cálculo de Financiamiento WAMMA.
 *
 * Módulo puro, agnóstico de React y de la interfaz de usuario.
 * Aplica el sistema de amortización francés según las políticas comerciales
 * aprobadas para el MVP:
 *  - Tasa: 4% mensual (48% anual simple), cuotas fijas.
 *  - Plazo fijo: 24 meses.
 *  - Opciones de inicial: 20%, 30%, 40% (mínima 20%).
 *  - Relación cuota / ingreso máxima: 30% del ingreso mensual.
 *
 * Principio V de la Constitución: cálculos internos con precisión matemática completa;
 * el redondeo se efectúa únicamente en la capa de presentación.
 */

export interface ParametrosFinanciamiento {
  /** Tasa mensual en tanto por uno (ej: 0.04 para 4.0%). */
  tasaMensual: number;
  /** Plazo fijo en meses (ej: 24). */
  plazoMeses: number;
  /** Ratio máximo de cuota sobre ingreso mensual (ej: 0.30 para 30%). */
  ratioCuotaIngreso: number;
  /** Opciones de inicial permitidas en tanto por uno (ej: [0.20, 0.30, 0.40]). */
  opcionesInicial: number[];
  /** Inicial mínima exigida (ej: 0.20). */
  inicialMinima: number;
}

/**
 * Parámetros oficiales aprobados por la dirección de WAMMA (política MVP vigente).
 */
export const PARAMETROS_APROBADOS: ParametrosFinanciamiento = {
  tasaMensual: 0.04,
  plazoMeses: 24,
  ratioCuotaIngreso: 0.30,
  opcionesInicial: [0.20, 0.30, 0.40],
  inicialMinima: 0.20,
};

/**
 * Nota informativa sobre el bloqueo / apartado temporal del vehículo al agendar cita.
 * Pendiente de validación de plazos y términos por el área legal.
 */
export const NOTA_BLOQUEO_VEHICULO =
  'Al agendar tu cita, el vehículo queda reservado temporalmente mientras se realiza la visita (pendiente de validación de plazos por el área legal).';

export interface OpcionFinanciamiento {
  pctInicial: number;
  montoInicial: number;
  montoFinanciado: number;
  cuota: number;
}

/**
 * Calcula el factor de amortización francés:
 *   factor = i / (1 − (1 + i)^−n)
 *
 * Para i = 0.04 y n = 24: factor ≈ 0.06558683134...
 */
export function calcularFactor(tasaMensual: number, plazoMeses: number): number {
  if (tasaMensual <= 0 || plazoMeses <= 0) return 0;
  return tasaMensual / (1 - Math.pow(1 + tasaMensual, -plazoMeses));
}

/**
 * Calcula la cuota mensual fija para un vehículo dado su precio y porcentaje de inicial:
 *   montoFinanciado = precio · (1 − pctInicial)
 *   cuota = montoFinanciado · factor
 */
export function calcularCuota(
  precio: number,
  pctInicial: number,
  params: ParametrosFinanciamiento = PARAMETROS_APROBADOS,
): number {
  if (!Number.isFinite(precio) || precio <= 0) return 0;
  if (!Number.isFinite(pctInicial) || pctInicial < 0 || pctInicial >= 1) return 0;

  const factor = calcularFactor(params.tasaMensual, params.plazoMeses);
  const montoFinanciado = precio * (1 - pctInicial);
  return montoFinanciado * factor;
}

/**
 * Calcula la cuota mensual máxima permitida según los ingresos del cliente:
 *   cuotaMaxima = ingreso · 0.30
 */
export function calcularCuotaMaxima(
  ingreso: number,
  params: ParametrosFinanciamiento = PARAMETROS_APROBADOS,
): number {
  if (!Number.isFinite(ingreso) || ingreso <= 0) return 0;
  return ingreso * params.ratioCuotaIngreso;
}

/**
 * Calcula el precio máximo de vehículo al que puede aspirar un cliente según su ingreso y su inicial:
 *   cuotaMaxima = ingreso · 0.30
 *   precioMaximo = cuotaMaxima / factor / (1 − pctInicial)
 */
export function calcularPrecioMaximo(
  ingreso: number,
  pctInicial: number,
  params: ParametrosFinanciamiento = PARAMETROS_APROBADOS,
): number {
  if (!Number.isFinite(ingreso) || ingreso <= 0) return 0;
  if (!Number.isFinite(pctInicial) || pctInicial < 0 || pctInicial >= 1) return 0;

  const cuotaMaxima = calcularCuotaMaxima(ingreso, params);
  const factor = calcularFactor(params.tasaMensual, params.plazoMeses);
  if (factor <= 0) return 0;

  return cuotaMaxima / factor / (1 - pctInicial);
}

/**
 * Calcula el ingreso mensual mínimo que debe demostrar el cliente para financiar un vehículo:
 *   cuota = calcularCuota(precio, pctInicial, params)
 *   ingresoMinimo = cuota / 0.30
 */
export function calcularIngresoMinimo(
  precio: number,
  pctInicial: number,
  params: ParametrosFinanciamiento = PARAMETROS_APROBADOS,
): number {
  if (!Number.isFinite(precio) || precio <= 0) return 0;
  if (!Number.isFinite(pctInicial) || pctInicial < 0 || pctInicial >= 1) return 0;

  const cuota = calcularCuota(precio, pctInicial, params);
  if (params.ratioCuotaIngreso <= 0) return 0;
  return cuota / params.ratioCuotaIngreso;
}

/**
 * Genera la simulación para todas las opciones de inicial aprobadas (20%, 30%, 40%).
 */
export function simularOpciones(
  precio: number,
  params: ParametrosFinanciamiento = PARAMETROS_APROBADOS,
): OpcionFinanciamiento[] {
  if (!Number.isFinite(precio) || precio <= 0) return [];

  return params.opcionesInicial.map((pct) => {
    const montoInicial = precio * pct;
    const montoFinanciado = precio - montoInicial;
    const cuota = calcularCuota(precio, pct, params);
    return {
      pctInicial: pct,
      montoInicial,
      montoFinanciado,
      cuota,
    };
  });
}

/**
 * Formateo estándar de montos en USD: sin decimales, redondeo matemático al mostrar.
 */
export function formatoUSD(valor: number): string {
  if (!Number.isFinite(valor)) return '$0';
  const entero = Math.round(valor);
  return '$' + entero.toLocaleString('en-US');
}

/**
 * Formateo estándar de montos en Bolívares: con 2 decimales y formato venezolano.
 */
export function formatoVES(valor: number): string {
  if (!Number.isFinite(valor)) return '0,00 Bs.';
  return (
    new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor) + ' Bs.'
  );
}

/**
 * Formateo estándar de montos en Euros (EUR): sin decimales, redondeo matemático al mostrar.
 */
export function formatoEUR(valor: number): string {
  if (!Number.isFinite(valor)) return '€0';
  const entero = Math.round(valor);
  return '€' + entero.toLocaleString('de-DE');
}

