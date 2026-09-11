/** Utilidades de presentación del backoffice comercial (módulo 010). */

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const formatoUSD = (valor: number) => usd.format(valor);

export const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "hace un momento", "hace 5 h", "hace 3 días". */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const horas = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 3_600_000);
  if (horas < 1) return 'hace un momento';
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

/**
 * Fecha de una próxima acción (AAAA-MM-DD). Se ancla al mediodía para que la
 * zona horaria no la corra al día anterior al mostrarla.
 */
export const fechaDeAccion = (aaaammdd: string) =>
  new Date(`${aaaammdd}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'short', day: '2-digit', month: 'short' });

export const CANALES: Record<string, string> = {
  whatsapp: 'WhatsApp',
  llamada: 'Llamada',
  correo: 'Correo',
  presencial: 'En sede',
};
