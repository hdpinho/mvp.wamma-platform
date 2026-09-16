/**
 * Traducción entre los códigos de la API (los de la base) y las etiquetas que muestra la
 * maqueta. Vive en un solo lugar: las pantallas siguen trabajando con las etiquetas.
 */
import type {
  CarroceriaApi,
  CombustibleApi,
  EtiquetaApi,
  TransmisionApi,
} from '../api/catalogo';
import type { Carroceria, EtiquetaVehiculo, Transmision } from './vehiculo';

const TRANSMISIONES: Record<TransmisionApi, Transmision> = {
  automatica: 'Automático',
  manual: 'Manual',
  secuencial: 'Secuencial',
};

const COMBUSTIBLES: Record<CombustibleApi, string> = {
  gasolina: 'Gasolina',
  diesel: 'Diésel',
  hibrido: 'Híbrido',
  electrico: 'Eléctrico',
  gas: 'Gas',
};

const CARROCERIAS: Record<CarroceriaApi, Carroceria> = {
  sedan: 'Sedán',
  hatchback: 'Hatchback',
  suv: 'SUV',
  camioneta: 'Camioneta',
  pick_up: 'Pick-up',
  coupe: 'Coupé',
};

const ETIQUETAS: Record<EtiquetaApi, EtiquetaVehiculo> = {
  recien_ingresado: 'Recién ingresado',
  dificil_de_conseguir: 'Difícil de conseguir',
  listo_para_entrega: 'Listo para entrega',
};

const invertir = <A extends string, B extends string>(tabla: Record<A, B>): Record<B, A> =>
  Object.fromEntries(Object.entries(tabla).map(([codigo, etiqueta]) => [etiqueta, codigo])) as Record<B, A>;

export const transmisionDesdeApi = (valor: TransmisionApi): Transmision => TRANSMISIONES[valor];
export const transmisionAApi = (valor: string): TransmisionApi => invertir(TRANSMISIONES)[valor as Transmision] ?? 'manual';

export const combustibleDesdeApi = (valor: CombustibleApi): string => COMBUSTIBLES[valor];
export const combustibleAApi = (valor: string): CombustibleApi => invertir(COMBUSTIBLES)[valor] ?? 'gasolina';

export const carroceriaDesdeApi = (valor: CarroceriaApi): Carroceria => CARROCERIAS[valor];
export const carroceriaAApi = (valor: string): CarroceriaApi => invertir(CARROCERIAS)[valor as Carroceria] ?? 'sedan';

export const etiquetaDesdeApi = (valor: EtiquetaApi | null): EtiquetaVehiculo | undefined =>
  valor ? ETIQUETAS[valor] : undefined;
export const etiquetaAApi = (valor: EtiquetaVehiculo | undefined): EtiquetaApi | null =>
  valor ? (invertir(ETIQUETAS)[valor] ?? null) : null;

/** Listas para los desplegables del formulario, en el orden en que se muestran. */
export const OPCIONES_TRANSMISION = Object.values(TRANSMISIONES);
export const OPCIONES_COMBUSTIBLE = Object.values(COMBUSTIBLES);
export const OPCIONES_CARROCERIA = Object.values(CARROCERIAS);
export const OPCIONES_ETIQUETA = Object.values(ETIQUETAS);
