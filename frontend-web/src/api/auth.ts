/**
 * Ingreso y cuenta propia (módulo 001, plan §10). Los nombres de los campos son los del
 * contrato del backend.
 */
import { pedirJson } from './cliente';
import type { Permiso, Rol } from '../types/seguridad';

export type SiguientePaso = 'CAMBIAR_CONTRASENA' | 'ACTIVAR_2FA' | 'CODIGO_2FA';

export interface Perfil {
  id: string;
  usuario: string;
  nombre: string;
  apellido: string;
  correo: string;
  roles: Rol[];
  permisos: Permiso[];
}

export interface PasoIngreso {
  tokenTemporal: string;
  siguiente: SiguientePaso;
  expiraEn: string;
}

export interface ActivacionTotp {
  secreto: string;
  uriOtpauth: string;
}

export interface RespuestaSesion {
  token: string | null;
  expiraEn: string | null;
  usuario: Perfil | null;
  codigosRecuperacion: string[] | null;
  /** Solo tras un código de recuperación: `ACTIVAR_2FA`. */
  siguiente: SiguientePaso | null;
}

/** El primer ingreso del día puede despertar al servidor (plan gratuito de Render). */
const ESPERA_INGRESO_MS = 90_000;

export const ingresar = (usuario: string, contrasena: string) =>
  pedirJson<PasoIngreso>('/v1/auth/ingreso', {
    method: 'POST',
    cuerpo: { usuario, contrasena },
    token: null,
    tiempoLimiteMs: ESPERA_INGRESO_MS,
  });

export const cambiarContrasenaInicial = (tokenTemporal: string, nueva: string) =>
  pedirJson<{ siguiente: SiguientePaso }>('/v1/auth/contrasena-inicial', {
    method: 'POST',
    cuerpo: { nueva },
    token: tokenTemporal,
  });

export const iniciarActivacion2fa = (tokenTemporal: string) =>
  pedirJson<ActivacionTotp>('/v1/auth/2fa/activacion', { method: 'POST', cuerpo: {}, token: tokenTemporal });

export const confirmarActivacion2fa = (tokenTemporal: string, codigo: string) =>
  pedirJson<RespuestaSesion>('/v1/auth/2fa/confirmacion', { method: 'POST', cuerpo: { codigo }, token: tokenTemporal });

export const verificarSegundoFactor = (
  tokenTemporal: string,
  credencial: { codigo: string } | { codigoRecuperacion: string },
) => pedirJson<RespuestaSesion>('/v1/auth/2fa', { method: 'POST', cuerpo: credencial, token: tokenTemporal });

/** Con el token explícito: si la sesión ya venció, el 401 no debe tratarse como un vencimiento nuevo. */
export const cerrarSesionServidor = (token: string) =>
  pedirJson<void>('/v1/auth/salida', { method: 'POST', token });

export const consultarPerfil = (tiempoLimiteMs?: number) => pedirJson<Perfil>('/v1/auth/yo', { tiempoLimiteMs });

export const cambiarContrasena = (actual: string, nueva: string) =>
  pedirJson<void>('/v1/auth/contrasena', { method: 'PUT', cuerpo: { actual, nueva } });
