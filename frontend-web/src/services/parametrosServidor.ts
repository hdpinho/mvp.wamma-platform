/**
 * La política de financiamiento tal como la entrega el servidor, y su conversión al modelo del motor de cálculo.
 * Módulo puro (sin red ni `import.meta.env`): lo prueba `parametrosServidor.test.ts` con el archivo de contrato del
 * backend.
 */
import type { ParametrosFinanciamiento } from './financiamientoMotor.ts';

/** Forma en que el servidor entrega la política (nombres de columna, en minúsculas y con guion bajo). */
export interface ParametrosDb {
  id?: string;
  tasa_mensual: number;
  plazo_meses: number;
  ratio_cuota_ingreso: number;
  opciones_inicial: number[];
  inicial_minima: number;
  moneda_base?: string;
  vigente_desde?: string;
  activo?: boolean;
}

export interface ParametrosFinanciamientoCompletos extends ParametrosFinanciamiento {
  monedaBase?: string;
  vigenteDesde?: string;
  activo?: boolean;
}

export interface ActualizarParametrosPayload {
  tasa_mensual: number;
  plazo_meses: number;
  ratio_cuota_ingreso: number;
  opciones_inicial: number[];
  inicial_minima: number;
  moneda_base?: string;
}

/** Convierte lo que dice el servidor al modelo del motor de cálculo. Un campo ausente o inválido es un error, no un 0. */
export function parametrosDesdeApi(fila: ParametrosDb): ParametrosFinanciamientoCompletos {
  const parametros: ParametrosFinanciamientoCompletos = {
    tasaMensual: Number(fila.tasa_mensual),
    plazoMeses: Number(fila.plazo_meses),
    ratioCuotaIngreso: Number(fila.ratio_cuota_ingreso),
    opcionesInicial: Array.isArray(fila.opciones_inicial) ? fila.opciones_inicial.map(Number) : [],
    inicialMinima: Number(fila.inicial_minima),
    monedaBase: fila.moneda_base,
    vigenteDesde: fila.vigente_desde,
    activo: fila.activo,
  };
  const validos =
    Number.isFinite(parametros.tasaMensual) &&
    parametros.tasaMensual > 0 &&
    Number.isInteger(parametros.plazoMeses) &&
    parametros.plazoMeses > 0 &&
    Number.isFinite(parametros.ratioCuotaIngreso) &&
    parametros.ratioCuotaIngreso > 0 &&
    Number.isFinite(parametros.inicialMinima) &&
    parametros.opcionesInicial.length > 0 &&
    parametros.opcionesInicial.every((p) => Number.isFinite(p) && p >= 0 && p < 1);
  if (!validos) {
    throw new Error('El servidor devolvió parámetros de financiamiento incompletos.');
  }
  return parametros;
}
