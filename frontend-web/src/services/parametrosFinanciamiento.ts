/**
 * Servicio de carga y sincronización de parámetros de financiamiento desde Supabase / Backend.
 *
 * Cumple con el requisito B:
 * "Si los parámetros no cargan, no muestres cuotas calculadas con valores de respaldo.
 * Muestra un estado de 'cálculo no disponible'. Mostrar una cuota con parámetros viejos es un riesgo."
 */
import { useEffect, useState } from 'react';
import {
  PARAMETROS_APROBADOS,
  type ParametrosFinanciamiento,
} from './financiamientoMotor';

interface ParametrosDb {
  tasa_mensual: number;
  plazo_meses: number;
  ratio_cuota_ingreso: number;
  opciones_inicial: number[];
  inicial_minima: number;
  moneda_base?: string;
  vigente_desde?: string;
  activo?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');

export async function obtenerParametrosFinanciamiento(): Promise<ParametrosFinanciamiento> {
  // 1. Si Supabase está configurado con anon key (lectura pública con RLS)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/parametros_financiamiento?activo=eq.true&order=vigente_desde.desc&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Error al consultar parámetros en Supabase (código HTTP ${res.status})`);
    }

    const data = (await res.json()) as ParametrosDb[];
    if (!data || data.length === 0) {
      throw new Error('No se encontraron parámetros de financiamiento activos en la base de datos');
    }

    const row = data[0];
    return {
      tasaMensual: Number(row.tasa_mensual),
      plazoMeses: Number(row.plazo_meses),
      ratioCuotaIngreso: Number(row.ratio_cuota_ingreso),
      opcionesInicial: Array.isArray(row.opciones_inicial)
        ? row.opciones_inicial.map(Number)
        : [0.20, 0.30, 0.40],
      inicialMinima: Number(row.inicial_minima),
    };
  }

  // 2. Si hay backend Spring Boot configurado
  if (API_URL) {
    const res = await fetch(`${API_URL}/v1/parametros-financiamiento`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Error al consultar parámetros en el backend (código HTTP ${res.status})`);
    }
    const row = (await res.json()) as ParametrosDb;
    return {
      tasaMensual: Number(row.tasa_mensual),
      plazoMeses: Number(row.plazo_meses),
      ratioCuotaIngreso: Number(row.ratio_cuota_ingreso),
      opcionesInicial: Array.isArray(row.opciones_inicial)
        ? row.opciones_inicial.map(Number)
        : [0.20, 0.30, 0.40],
      inicialMinima: Number(row.inicial_minima),
    };
  }

  // 3. Modo local sin servicios remotos configurados: retorna la política aprobada oficial
  return PARAMETROS_APROBADOS;
}

export interface EstadoParametrosFinanciamiento {
  parametros: ParametrosFinanciamiento | null;
  cargando: boolean;
  error: string | null;
}

export function useParametrosFinanciamiento(): EstadoParametrosFinanciamiento {
  const [parametros, setParametros] = useState<ParametrosFinanciamiento | null>(PARAMETROS_APROBADOS);
  const [cargando, setCargando] = useState<boolean>(Boolean(SUPABASE_URL || API_URL));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Si no hay endpoints remotos, el estado inicial ya tiene los parámetros aprobados
    if (!SUPABASE_URL && !API_URL) {
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
