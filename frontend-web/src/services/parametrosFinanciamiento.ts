/**
 * Lectura y actualización de los parámetros de financiamiento, que gobierna el servidor (D-14, D-26).
 *
 * Solo hay una fuente: el backend (`/v1/parametros-financiamiento`). El navegador no consulta la base de datos ni
 * conoce a su proveedor: la arquitectura tiene que poder cambiar de proveedor sin tocar la interfaz.
 *
 * Si los parámetros no cargan, no se muestran cuotas calculadas con valores de respaldo: una cuota con una política
 * vieja es un riesgo. Quien los usa muestra «cálculo no disponible» (`state/parametros.tsx`).
 */
import { apiConfigurada, pedirJson } from '../api/cliente';
import { PARAMETROS_APROBADOS } from './financiamientoMotor';
import {
  parametrosDesdeApi,
  type ActualizarParametrosPayload,
  type ParametrosDb,
  type ParametrosFinanciamientoCompletos,
} from './parametrosServidor';

export type { ActualizarParametrosPayload, ParametrosDb, ParametrosFinanciamientoCompletos };
export { parametrosDesdeApi };

const RUTA = '/v1/parametros-financiamiento';

/**
 * La política vigente. Sin servidor (demostración) rige la política aprobada del motor; con servidor, únicamente lo
 * que este responda: si falla, falla (no se sustituye por valores de respaldo).
 */
export async function obtenerParametrosFinanciamiento(): Promise<ParametrosFinanciamientoCompletos> {
  if (!apiConfigurada) return PARAMETROS_APROBADOS;
  // Es de lectura pública: se pide sin credencial, para que una sesión vencida no impida cotizar.
  return parametrosDesdeApi(await pedirJson<ParametrosDb>(RUTA, { token: null }));
}

/** Cambia la política. Solo quien administra parámetros (`parametros.gestionar`); el servidor lo verifica. */
export async function actualizarParametrosFinanciamiento(
  payload: ActualizarParametrosPayload,
): Promise<ParametrosFinanciamientoCompletos> {
  return parametrosDesdeApi(await pedirJson<ParametrosDb>(RUTA, { method: 'PUT', cuerpo: payload }));
}
