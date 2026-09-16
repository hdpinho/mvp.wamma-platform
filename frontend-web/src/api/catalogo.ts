/**
 * Vitrina pública (módulo 005, plan §6). No necesita sesión: es lo que ve cualquier visitante.
 */
import { pedirJson } from './cliente';

export type Disponibilidad = 'disponible' | 'cita_agendada' | 'vendido';
export type TransmisionApi = 'automatica' | 'manual' | 'secuencial';
export type CombustibleApi = 'gasolina' | 'diesel' | 'hibrido' | 'electrico' | 'gas';
export type CarroceriaApi = 'sedan' | 'hatchback' | 'suv' | 'camioneta' | 'pick_up' | 'coupe';
export type EtiquetaApi = 'recien_ingresado' | 'dificil_de_conseguir' | 'listo_para_entrega';

export interface CreditoFotoApi {
  autor: string;
  licencia: string;
  origen: string | null;
}

export interface FotoApi {
  id: string;
  url: string;
  urlMiniatura: string;
  ancho: number;
  alto: number;
  orden: number;
  /** Solo en las fotos referenciales; las propias de WAMMA no llevan crédito. */
  credito: CreditoFotoApi | null;
}

export interface ImperfeccionApi {
  id: string;
  zona: 'exterior' | 'interior';
  tipo: string;
  descripcion: string | null;
  severidad: 'leve' | 'moderada';
  ubicacion: string | null;
  x: number;
  y: number;
}

export interface VehiculoVitrina {
  codigo: string;
  vin: string;
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
  /** Equivalencia en bolívares a la tasa vigente; nula si todavía no hay tasa registrada. */
  precioVes: number | null;
  etiqueta: EtiquetaApi | null;
  fotos: FotoApi[];
  imperfecciones: ImperfeccionApi[];
}

export interface TasaBcv {
  fecha: string;
  moneda: string;
  tasa: number;
  fuente: string;
}

export interface PaginaCatalogo {
  tasa: TasaBcv | null;
  vehiculos: VehiculoVitrina[];
}

/** La primera carga puede estar despertando al servidor (plan gratuito de Render). */
export const consultarCatalogo = () =>
  pedirJson<PaginaCatalogo>('/v1/catalogo', { token: null, tiempoLimiteMs: 90_000 });

export const consultarVehiculoPublicado = (codigo: string) =>
  pedirJson<VehiculoVitrina>(`/v1/catalogo/${encodeURIComponent(codigo)}`, { token: null });

export const consultarTasaVigente = () =>
  pedirJson<{ tasa: TasaBcv | null }>('/v1/tasa-bcv/vigente', { token: null });
