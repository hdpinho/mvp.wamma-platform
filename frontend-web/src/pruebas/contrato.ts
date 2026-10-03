import { readFileSync } from 'node:fs';

/**
 * Lee un archivo de contrato de `backend/src/test/resources/contratos/`: el mismo que el backend usa para fijar la forma
 * de sus respuestas. Las pruebas de la web lo pasan por sus adaptadores, así que si una clave cambia de un lado, falla
 * una de las dos pruebas (hallazgos F-05, F-06 y F-07 del informe QA).
 */
export function contrato<T>(nombre: string): T {
  const ruta = new URL(`../../../backend/src/test/resources/contratos/${nombre}.json`, import.meta.url);
  return JSON.parse(readFileSync(ruta, 'utf-8')) as T;
}
