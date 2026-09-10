/**
 * Modelo del seguimiento comercial de prospectos.
 *
 * Especificación en `specs/010-crm-comercial/`. Las formas de estos tipos son
 * deliberadamente las que tendrán las tablas (`data-model.md` §4): esta maqueta
 * existe para validar etapas y motivos **antes** de escribir una migración
 * (`plan.md` §2.3).
 *
 * Nota sobre montos: `valorEstimadoUSD` es `number` porque toda la maqueta lo es
 * y así está documentado. En el backend será el tipo `Dinero` de
 * `internal/creditapp/calc` (precisión fija), conforme al Principio V.
 */

// ── Embudo ───────────────────────────────────────────────────────────────────

export type Etapa =
  | 'nuevo'
  | 'contactado'
  | 'cita_confirmada'
  | 'visito'
  | 'negociacion'
  | 'cerrado_ganado'
  | 'cerrado_perdido';

export interface DefinicionEtapa {
  codigo: Etapa;
  nombre: string;
  orden: number;
  esTerminal: boolean;
  /**
   * Días sin interacción ni cambio de etapa tras los cuales la oportunidad
   * se considera estancada (`spec.md` §8.6). `null` en etapas terminales.
   *
   * El umbral es por etapa y no único porque un prospecto sin llamar dos días
   * es urgente, mientras una negociación de diez días es sana.
   */
  umbralEstancadaDias: number | null;
}

/** Catálogo cerrado. Cambiar una etapa se hace aquí, no en las pantallas. */
export const ETAPAS: DefinicionEtapa[] = [
  { codigo: 'nuevo', nombre: 'Nuevo', orden: 1, esTerminal: false, umbralEstancadaDias: 2 },
  { codigo: 'contactado', nombre: 'Contactado', orden: 2, esTerminal: false, umbralEstancadaDias: 3 },
  { codigo: 'cita_confirmada', nombre: 'Cita confirmada', orden: 3, esTerminal: false, umbralEstancadaDias: 7 },
  { codigo: 'visito', nombre: 'Visitó la sede', orden: 4, esTerminal: false, umbralEstancadaDias: 7 },
  { codigo: 'negociacion', nombre: 'En negociación', orden: 5, esTerminal: false, umbralEstancadaDias: 14 },
  { codigo: 'cerrado_ganado', nombre: 'Vendido', orden: 6, esTerminal: true, umbralEstancadaDias: null },
  { codigo: 'cerrado_perdido', nombre: 'Perdido', orden: 7, esTerminal: true, umbralEstancadaDias: null },
];

export const definicionEtapa = (etapa: Etapa): DefinicionEtapa =>
  ETAPAS.find((e) => e.codigo === etapa) ?? ETAPAS[0];

/** Etapas abiertas, en orden. Las terminales quedan fuera del tablero activo. */
export const ETAPAS_ABIERTAS = ETAPAS.filter((e) => !e.esTerminal);

// ── Motivos de pérdida ───────────────────────────────────────────────────────

export type MotivoPerdida =
  | 'precio_fuera_de_presupuesto'
  | 'no_califico_financiamiento'
  | 'compro_en_otra_parte'
  | 'dejo_de_responder'
  | 'vehiculo_vendido_a_otro_cliente'
  | 'no_era_el_vehiculo_buscado'
  | 'otro';

/**
 * Catálogo **cerrado** a propósito (`spec.md` §8.2). Un campo libre produce
 * cien redacciones del mismo motivo y ninguna métrica aprovechable.
 */
export const MOTIVOS_PERDIDA: { codigo: MotivoPerdida; nombre: string; exigeTexto: boolean }[] = [
  { codigo: 'precio_fuera_de_presupuesto', nombre: 'Precio fuera de su presupuesto', exigeTexto: false },
  { codigo: 'no_califico_financiamiento', nombre: 'No calificó para financiamiento', exigeTexto: false },
  { codigo: 'compro_en_otra_parte', nombre: 'Compró en otra parte', exigeTexto: false },
  { codigo: 'dejo_de_responder', nombre: 'Dejó de responder', exigeTexto: false },
  { codigo: 'vehiculo_vendido_a_otro_cliente', nombre: 'El vehículo se vendió a otro cliente', exigeTexto: false },
  { codigo: 'no_era_el_vehiculo_buscado', nombre: 'No era el vehículo que buscaba', exigeTexto: false },
  { codigo: 'otro', nombre: 'Otro motivo', exigeTexto: true },
];

// ── Entidades ────────────────────────────────────────────────────────────────

/** Cómo se resolvió la identidad de la persona al capturarla (`plan.md` §5). */
export type CriterioResolucion = 'cedula' | 'telefono' | 'nueva';

export type CanalInteraccion = 'whatsapp' | 'llamada' | 'correo' | 'presencial';
export type DireccionInteraccion = 'entrante' | 'saliente';

/**
 * Raíz del ámbito comercial. Distinta de `usuario` (001) y de `solicitante`
 * (WMA-F-FIN-001): una persona puede no llegar a ser nunca ninguna de las dos.
 */
export interface Persona {
  id: string;
  nombreApellido: string;
  /** Llega en el segundo paso, al confirmar la cita (`spec.md` §8.5). */
  cedula?: string;
  telefonoWhatsApp: string;
  correo?: string;
  canalOrigen: string;
  criterioResolucion: CriterioResolucion;
  fechaCreacion: string;
  /** Ids de personas absorbidas al consolidar por cédula (`plan.md` §5.1). */
  fusionadaDesde?: string[];
}

/** Instantánea del vehículo al momento del interés: el precio de entonces importa. */
export interface ResumenVehiculo {
  marca: string;
  modelo: string;
  version: string;
  anio: number;
  precioUSD: number;
  foto?: string;
}

export interface Oportunidad {
  id: string;
  personaId: string;
  vehiculoId: string;
  vehiculoResumen: ResumenVehiculo;
  etapa: Etapa;
  modalidadPago: 'Contado' | 'Financiamiento';
  valorEstimadoUSD: number;
  /** Nulo mientras no exista el módulo 001: no hay identidad real de asesor. */
  asesorId: string | null;
  proximaAccion?: string;
  proximaAccionFecha?: string;
  motivoPerdida?: MotivoPerdida;
  motivoPerdidaTexto?: string;
  fechaCreacion: string;
  fechaCierre?: string;
}

/** Append-only: corregir es añadir, nunca editar (`spec.md` RF-010.10). */
export interface Interaccion {
  id: string;
  personaId: string;
  oportunidadId?: string;
  canal: CanalInteraccion;
  direccion: DireccionInteraccion;
  nota: string;
  autorId: string | null;
  ocurridoEn: string;
  registradoEn: string;
  corrigeInteraccionId?: string;
}

/** Append-only. Sin esta traza no hay tiempo en etapa ni conversión del embudo. */
export interface EventoEtapa {
  id: string;
  oportunidadId: string;
  etapaAnterior: Etapa | null;
  etapaNueva: Etapa;
  nota?: string;
  actorId: string | null;
  ts: string;
}

/** Una cita es un evento dentro de una oportunidad, no un atributo del inventario. */
export interface Cita {
  id: string;
  personaId: string;
  oportunidadId: string;
  vehiculoId: string;
  diaPreferencia: string;
  franjaHoraria: 'Mañana' | 'Tarde';
  estado: 'pendiente' | 'confirmada' | 'descartada';
  fechaCreacion: string;
  notificadoA: string;
}

// ── Máquina de estados ───────────────────────────────────────────────────────

export interface ResultadoTransicion {
  permitida: boolean;
  /** Cerrar en perdido exige motivo del catálogo (`spec.md` RF-010.6). */
  exigeMotivo: boolean;
  /** Retroceder exige nota: pasa de verdad y prohibirlo solo hace que se mienta. */
  exigeNota: boolean;
  razon?: string;
}

/**
 * Tabla de transiciones de `plan.md` §4. Función pura: es la pieza que se porta
 * a Go con 100 % de cobertura de ramas (tarea N3).
 */
export function evaluarTransicion(desde: Etapa, hacia: Etapa): ResultadoTransicion {
  const origen = definicionEtapa(desde);
  const destino = definicionEtapa(hacia);

  if (origen.esTerminal) {
    return {
      permitida: false,
      exigeMotivo: false,
      exigeNota: false,
      razon: `"${origen.nombre}" es una etapa terminal. Para retomar el contacto se crea una oportunidad nueva.`,
    };
  }

  if (desde === hacia) {
    return { permitida: false, exigeMotivo: false, exigeNota: false, razon: 'La oportunidad ya está en esa etapa.' };
  }

  // Se evalúa antes que el avance: 'cerrado_perdido' es la última en orden y si
  // no, entraría por la rama de avance y perdería la exigencia de motivo.
  if (hacia === 'cerrado_perdido') {
    return { permitida: true, exigeMotivo: true, exigeNota: false };
  }

  if (destino.orden > origen.orden) {
    return { permitida: true, exigeMotivo: false, exigeNota: false };
  }

  return { permitida: true, exigeMotivo: false, exigeNota: true };
}

// ── Normalización (se porta a Go en la tarea N2) ─────────────────────────────

/**
 * Teléfono venezolano a E.164. `0414…`, `414…` y `58414…` son el mismo número
 * y deben deduplicar igual.
 */
export function normalizarTelefono(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.startsWith('58')) return `+${digitos}`;
  if (digitos.startsWith('0')) return `+58${digitos.substring(1)}`;
  return `+58${digitos}`;
}

/** Para el enlace `wa.me`, que no admite el `+`. */
export const telefonoParaWhatsApp = (valor: string): string => normalizarTelefono(valor).replace('+', '');

export function normalizarCedula(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

// ── Estancamiento ────────────────────────────────────────────────────────────

/**
 * Una oportunidad está estancada si supera el umbral de su etapa sin actividad.
 * `ultimaActividad` es el momento más reciente entre su última interacción y su
 * último cambio de etapa.
 */
export function estaEstancada(oportunidad: Oportunidad, ultimaActividad: string, ahora: Date = new Date()): boolean {
  const umbral = definicionEtapa(oportunidad.etapa).umbralEstancadaDias;
  if (umbral === null) return false;

  const dias = (ahora.getTime() - new Date(ultimaActividad).getTime()) / 86_400_000;
  return dias > umbral;
}
