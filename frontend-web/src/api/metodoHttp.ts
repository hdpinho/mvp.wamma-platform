/**
 * Método HTTP de una petición. Vive aparte de `cliente.ts` (que lee `import.meta.env`) para poder probarse solo.
 *
 * Mandar un cuerpo sin indicar el método hacía que `fetch` intentara un GET con cuerpo: el navegador lo rechaza
 * antes de enviar nada, la pantalla lo tomaba por «sin conexión» y la solicitud de crédito nunca llegaba al
 * servidor (hallazgo F-01 del informe QA). Ahora, con cuerpo o formulario, el método por omisión es POST, y un
 * método que no admite cuerpo junto con uno es un error de programación que se ve de inmediato.
 */
export interface OpcionesMetodo {
  method?: string;
  cuerpo?: unknown;
  formulario?: FormData;
}

const SIN_CUERPO = new Set(['GET', 'HEAD']);

export function metodoDe({ method, cuerpo, formulario }: OpcionesMetodo): string {
  const conCuerpo = cuerpo !== undefined || formulario !== undefined;
  if (method === undefined || method === '') {
    return conCuerpo ? 'POST' : 'GET';
  }
  const metodo = method.toUpperCase();
  if (conCuerpo && SIN_CUERPO.has(metodo)) {
    throw new Error(`Una petición ${metodo} no admite cuerpo: indica POST, PUT o PATCH.`);
  }
  return metodo;
}
