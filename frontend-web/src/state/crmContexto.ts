import { createContext, useContext } from 'react';
import type {
  CanalInteraccion,
  Cita,
  DireccionInteraccion,
  Etapa,
  EventoEtapa,
  Interaccion,
  MotivoPerdida,
  Oportunidad,
  Persona,
} from '../types/crm';
import type { VehiculoData } from '../types/vehiculo';

/**
 * Contexto y hook del seguimiento comercial. Vive aparte del proveedor para que
 * el archivo de componentes exporte solo componentes (requisito de Fast
 * Refresh), igual que `favoritosContexto.ts`.
 *
 * Especificación en `specs/010-crm-comercial/`.
 */

export const CORREO_NOTIFICACIONES_WAMMA = 'pjjulio@gmail.com';

export interface DatosNuevaCita {
  nombreApellido: string;
  telefonoWhatsApp: string;
  correo?: string;
  diaPreferencia: string;
  franjaHoraria: 'Mañana' | 'Tarde';
  modalidadPago: 'Contado' | 'Financiamiento';
  vehiculo: VehiculoData;
}

export interface OpcionesTransicion {
  motivoPerdida?: MotivoPerdida;
  motivoPerdidaTexto?: string;
  nota?: string;
}

export interface DatosInteraccion {
  personaId: string;
  oportunidadId?: string;
  canal: CanalInteraccion;
  direccion: DireccionInteraccion;
  nota: string;
}

export interface ResultadoConfirmacion {
  ok: boolean;
  error?: string;
  /** Cierto si la cédula ya existía en otra persona y ambas se fusionaron. */
  fusionada?: boolean;
}

export interface CRMContextValue {
  personas: Persona[];
  oportunidades: Oportunidad[];
  interacciones: Interaccion[];
  historial: EventoEtapa[];
  citas: Cita[];

  obtenerPersona: (id: string) => Persona | undefined;
  obtenerOportunidad: (id: string) => Oportunidad | undefined;
  oportunidadesDePersona: (personaId: string) => Oportunidad[];
  interaccionesDePersona: (personaId: string) => Interaccion[];
  historialDeOportunidad: (oportunidadId: string) => EventoEtapa[];
  /** Momento más reciente entre la última interacción y el último cambio de etapa. */
  ultimaActividad: (oportunidadId: string) => string;

  agendarCita: (datos: DatosNuevaCita) => { cita: Cita; oportunidad: Oportunidad; persona: Persona };
  /** Segundo paso de la captura: la cédula llega aquí (`spec.md` §8.5). */
  confirmarCita: (citaId: string, cedula: string) => ResultadoConfirmacion;
  descartarCita: (citaId: string, motivo: MotivoPerdida, texto?: string) => void;

  cambiarEtapa: (
    oportunidadId: string,
    nueva: Etapa,
    opciones?: OpcionesTransicion,
  ) => { ok: boolean; error?: string };
  registrarInteraccion: (datos: DatosInteraccion) => Interaccion;
  asignarAsesor: (oportunidadId: string, asesorId: string | null) => void;
  fijarProximaAccion: (oportunidadId: string, accion: string, fecha: string) => void;

  restablecerDatosDemo: () => void;
}

export const CRMContext = createContext<CRMContextValue | null>(null);

export function useCRM(): CRMContextValue {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM debe usarse dentro de <ProveedorCRM>');
  return ctx;
}
