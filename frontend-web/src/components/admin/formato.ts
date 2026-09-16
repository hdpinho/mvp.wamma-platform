import { ErrorApi } from '../../api/cliente';

/** Las fechas del backoffice se muestran en la hora de Venezuela, sea cual sea el equipo. */
export function fechaHora(iso: string | null | undefined, conSegundos = false): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-VE', {
    timeZone: 'America/Caracas',
    dateStyle: 'short',
    timeStyle: conSegundos ? 'medium' : 'short',
  });
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-VE', { timeZone: 'America/Caracas', timeStyle: 'short' });
}

/** Texto para el usuario a partir de cualquier error: el detalle en español que manda el servidor. */
export function mensajeDe(e: unknown): string {
  if (e instanceof ErrorApi) return e.detalle || e.titulo;
  return 'Ocurrió un error inesperado.';
}

export function estaBloqueado(hasta: string | null): boolean {
  return hasta !== null && Date.parse(hasta) > Date.now();
}
