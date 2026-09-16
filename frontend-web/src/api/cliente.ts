/**
 * Cliente mínimo de la API del backend (Spring Boot).
 *
 * El backend responde todos sus errores en formato Problem Details (RFC 9457) con
 * textos en español. Aquí se convierten en `ErrorApi`, para que las pantallas
 * muestren `titulo` y `detalle` sin interpretar códigos HTTP.
 *
 * La sesión del backoffice viaja en la cabecera `Authorization`. El token se guarda en
 * `sessionStorage`: se borra al cerrar la pestaña y no se comparte entre pestañas
 * (plan 001 §5).
 */

const URL_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

/** Falso cuando el frontend corre sin backend (modo maqueta). */
export const apiConfigurada = URL_BASE !== '';

const CLAVE_TOKEN = 'wamma_sesion';

function leerTokenGuardado(): string | null {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

let tokenSesion: string | null = leerTokenGuardado();
let alRechazarSesion: (() => void) | null = null;

export const tokenDeSesion = (): string | null => tokenSesion;

export function guardarTokenDeSesion(token: string | null): void {
  tokenSesion = token;
  try {
    if (token) sessionStorage.setItem(CLAVE_TOKEN, token);
    else sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Navegador sin almacenamiento: la sesión dura lo que la página abierta.
  }
}

/** Así se entera el proveedor de sesión de que el servidor rechazó el token (vencido o revocado). */
export function registrarRechazoDeSesion(fn: (() => void) | null): void {
  alRechazarSesion = fn;
}

export class ErrorApi extends Error {
  /** Código HTTP; 0 cuando no hubo respuesta del servidor. */
  readonly estado: number;
  readonly titulo: string;
  readonly detalle: string;
  /** Mensaje por campo en los errores de validación. */
  readonly errores: Record<string, string>;

  constructor(estado: number, titulo: string, detalle: string, errores: Record<string, string> = {}) {
    super(detalle || titulo);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.titulo = titulo;
    this.detalle = detalle;
    this.errores = errores;
  }
}

interface OpcionesPeticion extends Omit<RequestInit, 'body' | 'headers' | 'signal'> {
  cuerpo?: unknown;
  /** Para subir archivos. El navegador pone el Content-Type con su separador. */
  formulario?: FormData;
  cabeceras?: Record<string, string>;
  /**
   * Milisegundos antes de abandonar. El plan gratuito de Render apaga el servidor
   * tras 15 minutos sin tráfico y tarda cerca de un minuto en volver.
   */
  tiempoLimiteMs?: number;
  /**
   * Token con el que se firma la petición. Por omisión, el de la sesión activa; `null`
   * para no enviar ninguno. Los pasos del ingreso usan el token temporal.
   */
  token?: string | null;
}

export async function pedirJson<T>(ruta: string, opciones: OpcionesPeticion = {}): Promise<T> {
  if (!apiConfigurada) {
    throw new ErrorApi(0, 'Servidor no configurado', 'Falta la variable VITE_API_URL.');
  }
  const { cuerpo, formulario, cabeceras, tiempoLimiteMs = 30_000, token, ...resto } = opciones;
  const usaSesion = token === undefined;
  const credencial = usaSesion ? tokenSesion : token;
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), tiempoLimiteMs);
  try {
    const respuesta = await fetch(`${URL_BASE}${ruta}`, {
      ...resto,
      headers: {
        Accept: 'application/json',
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(credencial ? { Authorization: `Bearer ${credencial}` } : {}),
        ...cabeceras,
      },
      body: formulario ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
      signal: controlador.signal,
    });
    if (!respuesta.ok) {
      if (respuesta.status === 401 && usaSesion && credencial) {
        guardarTokenDeSesion(null);
        alRechazarSesion?.();
      }
      throw await leerError(respuesta);
    }
    if (respuesta.status === 204) {
      return undefined as T;
    }
    return (await respuesta.json()) as T;
  } catch (e) {
    if (e instanceof ErrorApi) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ErrorApi(0, 'Sin respuesta', 'El servidor tardó demasiado en responder.');
    }
    throw new ErrorApi(0, 'Sin conexión', 'No se pudo contactar al servidor.');
  } finally {
    clearTimeout(temporizador);
  }
}

async function leerError(respuesta: Response): Promise<ErrorApi> {
  try {
    const problema = (await respuesta.json()) as {
      title?: string;
      detail?: string;
      errores?: Record<string, string>;
    };
    return new ErrorApi(respuesta.status, problema.title ?? 'Error', problema.detail ?? '', problema.errores ?? {});
  } catch {
    return new ErrorApi(respuesta.status, 'Error', `El servidor respondió con el código ${respuesta.status}.`);
  }
}

export interface EstadoSalud {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

/** Tiempo límite amplio: la primera consulta puede estar despertando al servidor. */
export const consultarSalud = (tiempoLimiteMs = 90_000) =>
  pedirJson<EstadoSalud>('/api/health', { tiempoLimiteMs, token: null });
