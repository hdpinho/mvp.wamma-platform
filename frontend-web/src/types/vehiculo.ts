/**
 * Modelo de un vehículo del inventario y de la vitrina.
 *
 * Alineado con `vehiculo`, `publicacion` y `publicacion_foto` del backend (spec 005 Rev. 2).
 * Los precios van en **euros** (D-21) y la equivalencia en bolívares la calcula el servidor
 * con la tasa BCV del euro vigente.
 */

/** Tipos de carrocería usados para explorar el catálogo. */
export const CARROCERIAS = [
  'Sedán',
  'Hatchback',
  'SUV',
  'Camioneta',
  'Pick-up',
  'Coupé',
] as const;

export type Carroceria = (typeof CARROCERIAS)[number];

export type Transmision = 'Automático' | 'Manual' | 'Secuencial';

/** Etiqueta comercial que se pinta sobre la foto en el catálogo (solo las 3 oficiales). */
export type EtiquetaVehiculo = 'Recién ingresado' | 'Reservado para cita' | 'Súper oportunidad';

export type EstadoDisponibilidad = 'disponible' | 'cita_agendada' | 'vendido';

/**
 * Hallazgo cosmético declarado en la inspección.
 *
 * Corresponde a un `inspeccion_punto` estético no conforme (módulo 004). Publicarlas es lo
 * que distingue a WAMMA de un clasificado: el comprador ve el desgaste real antes de ir a
 * la sede.
 */
export interface Imperfeccion {
  id: string;
  zona: 'exterior' | 'interior';
  /** Naturaleza del hallazgo: rayón, abolladura, desgaste… */
  tipo: string;
  descripcion: string;
  severidad: 'leve' | 'moderada';
  /** Parte del vehículo, para el listado y el diagrama. */
  ubicacion: string;
  /**
   * Posición del marcador sobre el diagrama, en porcentaje del área.
   * También fija el punto de acercamiento sobre la fotografía.
   */
  x: number;
  y: number;
}

/** Monedas admitidas para registrar lo que se pagó por el vehículo. */
export type MonedaAdquisicion = 'EUR' | 'USD' | 'VES';

/** Crédito de una foto referencial; las fotos propias de WAMMA no lo llevan (D-22). */
export interface CreditoFoto {
  autor: string;
  licencia: string;
  origen: string | null;
}

export interface FotoVehiculoData {
  id: string;
  url: string;
  urlMiniatura: string;
  ancho: number;
  alto: number;
  credito?: CreditoFoto | null;
}

/** Estado de la publicación en la vitrina (solo con servidor). */
export interface EstadoPublicacion {
  estado: 'borrador' | 'publicado' | 'pausado';
  publicadoEn: string | null;
  /** Tasa con la que se fijó el precio publicado. */
  tasaBcv: number | null;
  fechaTasa: string | null;
}

export interface VehiculoData {
  /** Código de inventario: `veh-001` en los de demostración, `WAM-00017` en los nuevos. */
  id: string;
  vin: string;
  /** Dato interno: no sale a la vitrina (D-12, opcional). */
  placa?: string | null;
  marca: string;
  modelo: string;
  /** Versión o acabado, p. ej. "XEI 1.8 Aut.". */
  version: string;
  anio: number;
  /** Precio en euros (D-21). */
  precio: number;
  /** Equivalencia en bolívares a la tasa vigente; la calcula el servidor. */
  precioVes?: number | null;
  kilometraje: number;
  transmision: Transmision;
  combustible: string;
  carroceria: Carroceria;
  puestos: number;
  traccion: '4x2' | '4x4';
  /** Número o cantidad de dueños previos del vehículo. */
  duenos?: number;
  certificado: boolean;
  etiqueta?: EtiquetaVehiculo;
  /** Galería; la primera es la principal. */
  fotos: FotoVehiculoData[];
  /** Dirección de la foto principal, para los componentes que muestran una sola. */
  foto?: string;
  /** Color de la carrocería; tiñe el marcador cuando no hay foto. */
  color: string;
  sede: string;
  /** Estado de disponibilidad comercial. */
  estadoDisponibilidad?: EstadoDisponibilidad;
  /** Hallazgos declarados. Con servidor llegan con el vehículo; en maqueta viven aparte. */
  imperfecciones?: Imperfeccion[];

  // ── Solo con servidor, para el backoffice ────────────────────────────────
  publicacion?: EstadoPublicacion;
  /** Lo que falta para poder publicarlo; vacío cuando ya se puede. */
  faltaParaPublicar?: string[];
  fotosMinimas?: number;
  esDemostracion?: boolean;
  adquisicion?: { precio: number; moneda: MonedaAdquisicion; tasaBcv: number; fecha: string } | null;
  /** Marca de tiempo de la última modificación, para detectar cambios simultáneos. */
  actualizadoEn?: string;
}

/** Forma de los datos de maqueta: sin galería ni campos del servidor. */
export type VehiculoMaqueta = Omit<VehiculoData, 'fotos'>;

/**
 * La cita y todo el seguimiento comercial se movieron a `types/crm.ts`
 * (módulo 010): una cita es un evento dentro de una oportunidad, no un
 * atributo del inventario. Ver `specs/010-crm-comercial/plan.md` §7.2.
 */
