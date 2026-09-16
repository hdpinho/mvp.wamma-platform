/** Administración de usuarios (módulo 001, plan §10). Exige `usuarios.gestionar`. */
import { pedirJson } from './cliente';
import type { Permiso, Rol } from '../types/seguridad';

export type EstadoUsuario = 'activo' | 'inactivo';

export interface UsuarioVista {
  id: string;
  usuario: string;
  nombre: string;
  apellido: string;
  correo: string;
  estado: EstadoUsuario;
  roles: Rol[];
  segundoFactorActivo: boolean;
  bloqueadoHasta: string | null;
  ultimoIngreso: string | null;
  creadoEn: string;
}

export interface NuevoUsuario {
  usuario: string;
  nombre: string;
  apellido: string;
  correo: string;
  roles: Rol[];
}

/** Solo viajan los campos que cambian. */
export interface CambiosUsuario {
  nombre?: string;
  apellido?: string;
  correo?: string;
  estado?: EstadoUsuario;
  roles?: Rol[];
}

export interface RolVista {
  codigo: Rol;
  permisos: Permiso[];
}

export const listarUsuarios = () => pedirJson<UsuarioVista[]>('/v1/usuarios');

export const crearUsuario = (datos: NuevoUsuario) =>
  pedirJson<{ usuario: UsuarioVista; contrasenaTemporal: string }>('/v1/usuarios', { method: 'POST', cuerpo: datos });

export const actualizarUsuario = (id: string, cambios: CambiosUsuario) =>
  pedirJson<UsuarioVista>(`/v1/usuarios/${id}`, { method: 'PATCH', cuerpo: cambios });

export const restablecerContrasena = (id: string) =>
  pedirJson<{ contrasenaTemporal: string }>(`/v1/usuarios/${id}/restablecer-contrasena`, { method: 'POST' });

export const restablecer2fa = (id: string) => pedirJson<void>(`/v1/usuarios/${id}/restablecer-2fa`, { method: 'POST' });

export const listarRoles = () => pedirJson<RolVista[]>('/v1/roles');
