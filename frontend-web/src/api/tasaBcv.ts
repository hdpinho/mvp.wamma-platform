/**
 * Tasa BCV del euro (D-13, D-21). La registra a diario el administrador o el analista de
 * crédito; la vitrina usa la más reciente.
 */
import { pedirJson } from './cliente';

export interface TasaRegistrada {
  fecha: string;
  moneda: string;
  tasa: number;
  fuente: string;
  registradaEn: string;
  registradaPor: string | null;
  corregidaEn: string | null;
  corregidaPor: string | null;
}

export const historialTasas = (limite = 60) => pedirJson<TasaRegistrada[]>(`/v1/tasas-bcv?limite=${limite}`);

export const registrarTasa = (fecha: string, tasa: number, fuente: string) =>
  pedirJson<{ tasa: TasaRegistrada; corregida: boolean }>('/v1/tasas-bcv', {
    method: 'POST',
    cuerpo: { fecha, tasa, fuente },
  });
