/** Consulta de la bitácora (módulo 001, plan §8). Exige `auditoria.ver`. */
import { pedirJson } from './cliente';

export interface EventoBitacora {
  id: string;
  fecha: string;
  /** Nombre de usuario de quien actuó; nulo en eventos del sistema o de ingresos anónimos. */
  usuario: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  ip: string | null;
}

export interface PaginaBitacora {
  eventos: EventoBitacora[];
  siguienteCursor: string | null;
}

/** Fechas en formato AAAA-MM-DD; el servidor las interpreta en la hora de Venezuela. */
export interface FiltrosBitacora {
  desde?: string;
  hasta?: string;
  usuario?: string;
  entidad?: string;
  accion?: string;
}

export function consultarBitacora(filtros: FiltrosBitacora, cursor?: string | null, limite = 50) {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (typeof valor === 'string' && valor.trim()) parametros.set(clave, valor.trim());
  }
  if (cursor) parametros.set('cursor', cursor);
  parametros.set('limite', String(limite));
  return pedirJson<PaginaBitacora>(`/v1/auditoria?${parametros.toString()}`);
}
