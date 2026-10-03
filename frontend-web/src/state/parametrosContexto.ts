import { createContext, useContext } from 'react';
import type { ParametrosFinanciamiento } from '../services/financiamientoMotor';

/**
 * Política de financiamiento vigente, leída una sola vez y compartida por toda la aplicación (vitrina, simuladores,
 * solicitud y backoffice). Vive aparte del proveedor para que el archivo de componentes exporte solo componentes.
 *
 * Con servidor, `parametros` es **nulo** mientras carga o si no se pudo leer: nadie debe mostrar una cuota calculada
 * con valores de respaldo (una cuota con una política vieja es un riesgo). Sin servidor (demostración) rige la
 * política aprobada del motor.
 */
export interface ContextoParametros {
  parametros: ParametrosFinanciamiento | null;
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  /** Política que reemplaza a la vigente tras guardarla en el backoffice, sin releer. */
  fijar: (parametros: ParametrosFinanciamiento) => void;
  /**
   * Cuota mensual «desde» de un vehículo: con la inicial más alta permitida y el plazo vigente. Nula si no hay
   * parámetros o el precio no es válido; la pantalla dice «cuota no disponible» en vez de inventar una cifra.
   */
  cuotaDesde: (precio: number) => number | null;
}

export const ParametrosContext = createContext<ContextoParametros | null>(null);

export function useParametros(): ContextoParametros {
  const ctx = useContext(ParametrosContext);
  if (!ctx) throw new Error('useParametros debe usarse dentro de <ProveedorParametros>');
  return ctx;
}
