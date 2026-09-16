import { createContext, useContext } from 'react';
import type { EstadoDisponibilidad, Imperfeccion, VehiculoData } from '../types/vehiculo';

/**
 * Contexto y hook del inventario. Viven aparte del proveedor (`vehiculos.tsx`) para que
 * ese archivo exporte solo componentes (requisito de Fast Refresh), igual que
 * `favoritosContexto.ts` y `crmContexto.ts`.
 *
 * Con servidor, la vitrina se lee de `/v1/catalogo` y, con sesión, el inventario completo
 * de `/v1/inventario`. Sin servidor, sigue con los datos de maqueta en el navegador.
 */

export type { EstadoDisponibilidad };

export type OrigenInventario = 'servidor' | 'maqueta';

export interface TasaVigente {
  valor: number;
  fecha: string;
  fuente: string;
}

export interface ResultadoPublicacionEnLote {
  publicados: string[];
  pendientes: { codigo: string; motivos: string[] }[];
}

export interface VehiculosContextType {
  vehiculos: VehiculoData[];
  origen: OrigenInventario;
  cargando: boolean;
  /** Mensaje del último fallo al leer del servidor; la vitrina sigue con lo que tenga. */
  error: string | null;
  /** Tasa BCV del euro vigente; nula en modo maqueta o si nadie la ha registrado. */
  tasa: TasaVigente | null;
  recargar: () => void;
  obtenerVehiculo: (id: string) => VehiculoData | undefined;
  obtenerImperfecciones: (vehiculoId: string) => Imperfeccion[];
  cambiarEstadoVehiculo: (vehiculoId: string, nuevoEstado: EstadoDisponibilidad) => Promise<void>;
  guardarVehiculo: (vehiculo: VehiculoData, imperfecciones?: Imperfeccion[]) => Promise<VehiculoData>;
  eliminarVehiculo: (vehiculoId: string) => Promise<void>;
  publicarVehiculo: (vehiculoId: string) => Promise<void>;
  pausarVehiculo: (vehiculoId: string) => Promise<void>;
  publicarListos: () => Promise<ResultadoPublicacionEnLote>;
  subirFoto: (vehiculoId: string, archivo: File) => Promise<void>;
  quitarFoto: (vehiculoId: string, fotoId: string) => Promise<void>;
  ordenarFotos: (vehiculoId: string, fotos: string[]) => Promise<void>;
  restablecerDatosDemo: () => void;
}

export const VehiculosContext = createContext<VehiculosContextType | undefined>(undefined);

export const useVehiculos = () => {
  const context = useContext(VehiculosContext);
  if (!context) {
    throw new Error('useVehiculos debe usarse dentro de un ProveedorVehiculos');
  }
  return context;
};
