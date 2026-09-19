/**
 * Parámetros de financiamiento, servidos por el backend de WAMMA.
 *
 * Antes esto hablaba directamente con la API de datos de Supabase usando la anon key. Se
 * quitó (spec 011 §6.2): ataba el simulador de cuotas —camino crítico del negocio— a un
 * proveedor concreto, contra el Principio II, y obligaba a exponer una clave y una política
 * de lectura pública sobre la tabla. Ahora la única puerta a la base es el backend.
 *
 * Requisito B.5: si los parámetros no cargan, no se muestran cuotas calculadas con valores
 * de respaldo, sino un estado de «cálculo no disponible». Una cuota con parámetros viejos
 * es peor que ninguna cuota.
 */
import { useEffect, useState } from 'react';
import {
  PARAMETROS_APROBADOS,
  type ParametrosFinanciamiento,
} from './financiamientoMotor';

/** Lo que devuelve GET /v1/parametros-financiamiento. */
interface ParametrosApi {
  tasaMensual: number;
  plazoMeses: number;
  ratioCuotaIngreso: number;
  opcionesInicial: number[];
  inicialMinima: number;
  monedaBase?: string;
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');

export async function obtenerParametrosFinanciamiento(): Promise<ParametrosFinanciamiento> {
  // Sin servidor configurado es el modo maqueta del desarrollo local: se usan los
  // parámetros aprobados que vienen en el código. No es un respaldo ante un fallo —eso
  // lo prohíbe el requisito B.5—, sino el modo de trabajar sin backend levantado.
  if (!API_URL) {
    return PARAMETROS_APROBADOS;
  }

  const res = await fetch(`${API_URL}/v1/parametros-financiamiento`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Error al consultar parámetros en el backend (código HTTP ${res.status})`);
  }

  const row = (await res.json()) as ParametrosApi;
  return {
    tasaMensual: Number(row.tasaMensual),
    plazoMeses: Number(row.plazoMeses),
    ratioCuotaIngreso: Number(row.ratioCuotaIngreso),
    opcionesInicial: Array.isArray(row.opcionesInicial)
      ? row.opcionesInicial.map(Number)
      : [0.20, 0.30, 0.40],
    inicialMinima: Number(row.inicialMinima),
  };
}

export interface EstadoParametrosFinanciamiento {
  parametros: ParametrosFinanciamiento | null;
  cargando: boolean;
  error: string | null;
}

export function useParametrosFinanciamiento(): EstadoParametrosFinanciamiento {
  const [parametros, setParametros] = useState<ParametrosFinanciamiento | null>(PARAMETROS_APROBADOS);
  const [cargando, setCargando] = useState<boolean>(Boolean(API_URL));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sin servidor, el estado inicial ya trae los parámetros aprobados: no hay nada que pedir
    if (!API_URL) {
      return;
    }

    let cancelado = false;

    obtenerParametrosFinanciamiento()
      .then((params) => {
        if (!cancelado) {
          setParametros(params);
          setCargando(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          // Requisito B.5: Si los parámetros no cargan, NO mostrar valores de respaldo
          setParametros(null);
          setError(err instanceof Error ? err.message : 'Error desconocido al cargar parámetros');
          setCargando(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return { parametros, cargando, error };
}
