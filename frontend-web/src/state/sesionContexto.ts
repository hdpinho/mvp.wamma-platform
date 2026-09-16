import { createContext, useContext } from 'react';
import type { Perfil } from '../api/auth';
import type { Permiso } from '../types/seguridad';

/**
 * - `sin_servidor`: modo maqueta (sin `VITE_API_URL`). No hay ingreso y se ve todo el menú.
 * - `verificando`: hay un token guardado y se está confirmando con el servidor.
 * - `anonima`: hay servidor y no hay sesión; el backoffice lleva al ingreso.
 * - `activa`: sesión completa (contraseña y segundo factor).
 */
export type EstadoSesion = 'sin_servidor' | 'verificando' | 'anonima' | 'activa';

/** Por qué terminó la última sesión, para explicarlo en la pantalla de ingreso. */
export type MotivoSalida = 'voluntaria' | 'vencida' | 'inactividad' | 'sin_conexion' | null;

export interface ContextoSesion {
  estado: EstadoSesion;
  perfil: Perfil | null;
  motivoSalida: MotivoSalida;
  /** Verdadero si el usuario tiene alguno de los permisos. En modo maqueta, siempre. */
  puede: (...permisos: Permiso[]) => boolean;
  iniciar: (token: string, perfil: Perfil) => void;
  cerrar: (motivo?: MotivoSalida) => Promise<void>;
}

export const SesionContexto = createContext<ContextoSesion | null>(null);

export function useSesion(): ContextoSesion {
  const contexto = useContext(SesionContexto);
  if (!contexto) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return contexto;
}
