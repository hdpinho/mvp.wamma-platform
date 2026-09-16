import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  apiConfigurada,
  ErrorApi,
  guardarTokenDeSesion,
  registrarRechazoDeSesion,
  tokenDeSesion,
} from '../api/cliente';
import { cerrarSesionServidor, consultarPerfil, type Perfil } from '../api/auth';
import type { Permiso } from '../types/seguridad';
import { SesionContexto, type ContextoSesion, type EstadoSesion, type MotivoSalida } from './sesionContexto';

/** Igual que la inactividad máxima del servidor (D-24). */
const INACTIVIDAD_MAXIMA_MS = 30 * 60_000;
/**
 * Mientras hay actividad, la sesión se confirma con el servidor como mucho cada 5 minutos.
 * Así el servidor no la da por inactiva mientras se trabaja en pantallas que todavía no le
 * hacen peticiones (inventario y CRM siguen en el navegador hasta las etapas 2 y 3), y una
 * desactivación o un restablecimiento se notan en minutos.
 */
const LATIDO_MS = 5 * 60_000;
const REVISION_MS = 30_000;
const EVENTOS_ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
/** La primera consulta puede estar despertando al servidor (plan gratuito de Render). */
const ESPERA_VERIFICACION_MS = 90_000;

export const ProveedorSesion: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [estado, setEstado] = useState<EstadoSesion>(() =>
    !apiConfigurada ? 'sin_servidor' : tokenDeSesion() ? 'verificando' : 'anonima',
  );
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [motivoSalida, setMotivoSalida] = useState<MotivoSalida>(null);
  const ultimaActividad = useRef(0);
  const ultimoLatido = useRef(0);

  const limpiar = useCallback((motivo: MotivoSalida) => {
    guardarTokenDeSesion(null);
    setPerfil(null);
    setMotivoSalida(motivo);
    setEstado((actual) => (actual === 'sin_servidor' ? actual : 'anonima'));
  }, []);

  const iniciar = useCallback((token: string, nuevo: Perfil) => {
    guardarTokenDeSesion(token);
    ultimaActividad.current = Date.now();
    ultimoLatido.current = Date.now();
    setPerfil(nuevo);
    setMotivoSalida(null);
    setEstado('activa');
  }, []);

  const cerrar = useCallback(
    async (motivo: MotivoSalida = 'voluntaria') => {
      const token = tokenDeSesion();
      limpiar(motivo);
      if (token) {
        try {
          await cerrarSesionServidor(token);
        } catch {
          // Si ya había vencido en el servidor, no queda nada que cerrar.
        }
      }
    },
    [limpiar],
  );

  // El cliente avisa cuando el servidor rechaza el token: vencido, cerrado o revocado.
  useEffect(() => {
    if (!apiConfigurada) return;
    registrarRechazoDeSesion(() => limpiar('vencida'));
    return () => registrarRechazoDeSesion(null);
  }, [limpiar]);

  // Al abrir la página con un token guardado, se confirma con el servidor.
  useEffect(() => {
    if (estado !== 'verificando') return;
    let vigente = true;
    consultarPerfil(ESPERA_VERIFICACION_MS)
      .then((confirmado) => {
        if (!vigente) return;
        ultimaActividad.current = Date.now();
        ultimoLatido.current = Date.now();
        setPerfil(confirmado);
        setEstado('activa');
      })
      .catch((e: unknown) => {
        // Un 401 ya cerró la sesión desde el cliente; otro fallo obliga a ingresar de nuevo.
        if (vigente && !(e instanceof ErrorApi && e.estado === 401)) limpiar('sin_conexion');
      });
    return () => {
      vigente = false;
    };
  }, [estado, limpiar]);

  // Inactividad del lado del navegador y latido hacia el servidor.
  useEffect(() => {
    if (estado !== 'activa') return;
    const marcar = () => {
      ultimaActividad.current = Date.now();
    };
    const revisar = () => {
      const ahora = Date.now();
      if (ahora - ultimaActividad.current >= INACTIVIDAD_MAXIMA_MS) {
        void cerrar('inactividad');
      } else if (ultimaActividad.current > ultimoLatido.current && ahora - ultimoLatido.current >= LATIDO_MS) {
        ultimoLatido.current = ahora;
        consultarPerfil()
          .then((vigente) => {
            if (tokenDeSesion()) setPerfil(vigente);
          })
          .catch(() => {
            // Un 401 ya cerró la sesión; un corte de red se reintenta en la próxima revisión.
          });
      }
    };
    EVENTOS_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, marcar, { passive: true }));
    document.addEventListener('visibilitychange', revisar);
    const intervalo = setInterval(revisar, REVISION_MS);
    return () => {
      EVENTOS_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, marcar));
      document.removeEventListener('visibilitychange', revisar);
      clearInterval(intervalo);
    };
  }, [estado, cerrar]);

  const puede = useCallback(
    (...permisos: Permiso[]) =>
      estado === 'sin_servidor' || (perfil !== null && permisos.some((p) => perfil.permisos.includes(p))),
    [estado, perfil],
  );

  const valor = useMemo<ContextoSesion>(
    () => ({ estado, perfil, motivoSalida, puede, iniciar, cerrar }),
    [estado, perfil, motivoSalida, puede, iniciar, cerrar],
  );

  return <SesionContexto.Provider value={valor}>{children}</SesionContexto.Provider>;
};
