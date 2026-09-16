/**
 * Inventario del backoffice (módulo 005, plan §6). Cada llamada exige su permiso:
 * `inventario.ver` para consultar e `inventario.gestionar` para cambiar.
 */
import { pedirJson } from './cliente';
import type {
  CarroceriaApi,
  CombustibleApi,
  Disponibilidad,
  EtiquetaApi,
  FotoApi,
  ImperfeccionApi,
  TransmisionApi,
} from './catalogo';

export interface PublicacionApi {
  estado: 'borrador' | 'publicado' | 'pausado';
  publicadoEn: string | null;
  tasaBcv: number | null;
  fechaTasa: string | null;
}

export interface AdquisicionApi {
  precio: number;
  moneda: 'EUR' | 'USD' | 'VES';
  tasaBcv: number;
  fecha: string;
}

export interface VehiculoInventario {
  codigo: string;
  vin: string;
  placa: string | null;
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  kilometraje: number;
  transmision: TransmisionApi;
  combustible: CombustibleApi;
  carroceria: CarroceriaApi;
  puestos: number;
  traccion: '4x2' | '4x4';
  color: string;
  sede: string;
  disponibilidad: Disponibilidad;
  certificado: boolean;
  precio: number;
  moneda: string;
  etiqueta: EtiquetaApi | null;
  publicacion: PublicacionApi;
  fotos: FotoApi[];
  imperfecciones: ImperfeccionApi[];
  /** Solo para quien gestiona el inventario. */
  adquisicion: AdquisicionApi | null;
  esDemostracion: boolean;
  fotosMinimas: number;
  /** Vacío cuando ya se puede publicar. */
  faltaParaPublicar: string[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface ImperfeccionEntrada {
  zona: 'exterior' | 'interior';
  tipo: string;
  descripcion: string | null;
  severidad: 'leve' | 'moderada';
  ubicacion: string | null;
  x: number;
  y: number;
}

export interface VehiculoEntrada {
  vin: string;
  placa?: string | null;
  marca: string;
  modelo: string;
  version?: string | null;
  anio: number;
  kilometraje: number;
  transmision: TransmisionApi;
  combustible: CombustibleApi;
  carroceria: CarroceriaApi;
  puestos: number;
  traccion: '4x2' | '4x4';
  color: string;
  precio: number;
  etiqueta?: EtiquetaApi | null;
  certificado: boolean;
  imperfecciones: ImperfeccionEntrada[];
  adquisicion?: AdquisicionApi | null;
  /** Solo en el alta. */
  disponibilidad?: Disponibilidad;
  /** Solo en la edición: la marca de tiempo que se leyó, para detectar cambios simultáneos. */
  actualizadoEn?: string;
}

export interface ResultadoLote {
  publicados: string[];
  pendientes: { codigo: string; motivos: string[] }[];
}

const ruta = (codigo: string) => `/v1/inventario/${encodeURIComponent(codigo)}`;

export const listarInventario = () => pedirJson<VehiculoInventario[]>('/v1/inventario');

export const obtenerVehiculoInventario = (codigo: string) => pedirJson<VehiculoInventario>(ruta(codigo));

export const crearVehiculo = (datos: VehiculoEntrada) =>
  pedirJson<VehiculoInventario>('/v1/inventario', { method: 'POST', cuerpo: datos });

export const actualizarVehiculo = (codigo: string, datos: VehiculoEntrada) =>
  pedirJson<VehiculoInventario>(ruta(codigo), { method: 'PUT', cuerpo: datos });

export const eliminarVehiculo = (codigo: string) => pedirJson<void>(ruta(codigo), { method: 'DELETE' });

export function subirFoto(codigo: string, archivo: File) {
  const formulario = new FormData();
  formulario.append('archivo', archivo);
  // Una foto grande puede tardar en subir y en procesarse.
  return pedirJson<FotoApi>(`${ruta(codigo)}/fotos`, { method: 'POST', formulario, tiempoLimiteMs: 120_000 });
}

export const quitarFoto = (codigo: string, id: string) =>
  pedirJson<void>(`${ruta(codigo)}/fotos/${id}`, { method: 'DELETE' });

export const ordenarFotos = (codigo: string, fotos: string[]) =>
  pedirJson<FotoApi[]>(`${ruta(codigo)}/fotos/orden`, { method: 'PUT', cuerpo: { fotos } });

export const publicarVehiculo = (codigo: string) =>
  pedirJson<VehiculoInventario>(`${ruta(codigo)}/publicacion`, { method: 'POST' });

export const pausarVehiculo = (codigo: string) =>
  pedirJson<VehiculoInventario>(`${ruta(codigo)}/publicacion`, { method: 'DELETE' });

export const publicarListos = () =>
  pedirJson<ResultadoLote>('/v1/inventario/publicacion-en-lote', { method: 'POST' });

export const cambiarDisponibilidad = (codigo: string, disponibilidad: Disponibilidad, motivo?: string) =>
  pedirJson<VehiculoInventario>(`${ruta(codigo)}/disponibilidad`, {
    method: 'PUT',
    cuerpo: { disponibilidad, motivo: motivo ?? null },
  });
