/**
 * Modelo de un vehículo publicado en la vitrina.
 *
 * Alineado con las entidades `vehiculo` y `publicacion` de
 * `specs/000-overview/data-model.md`. Los campos de presentación
 * (`etiqueta`, `color`) existen solo para la maqueta.
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

/** Etiqueta comercial que se pinta sobre la foto en el catálogo. */
export type EtiquetaVehiculo = 'Recién ingresado' | 'Difícil de conseguir' | 'Listo para entrega';

/**
 * Hallazgo cosmético declarado en la inspección de 240 puntos.
 *
 * Corresponde a un `inspeccion_punto` con resultado no conforme y su
 * `evidencia_url` (ver data-model, módulo 004). Publicarlas es lo que
 * distingue a WAMMA de un clasificado: el comprador ve el desgaste real
 * antes de ir a la sede.
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

export interface VehiculoData {
  id: string;
  vin: string;
  marca: string;
  modelo: string;
  /** Versión o acabado, p. ej. "XEI 1.8 Aut.". */
  version: string;
  anio: number;
  precioUSD: number;
  kilometraje: number;
  transmision: 'Automático' | 'Manual';
  combustible: string;
  carroceria: Carroceria;
  puestos: number;
  traccion: '4x2' | '4x4';
  certificado: boolean;
  /** Cuota mensual de suscripción OCN (rent-to-own). Fase 2. */
  suscripcionMensualUSD?: number;
  etiqueta?: EtiquetaVehiculo;
  /** Ruta de la fotografía en `public/vehiculos/`. Ver `mocks/creditosFotos.ts`. */
  foto?: string;
  /** Color de la carrocería; tiñe el marcador cuando no hay foto. */
  color: string;
  sede: string;
}
