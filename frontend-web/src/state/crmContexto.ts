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
 *
 * Con servidor (`origen: 'servidor'`) la fuente de verdad es el servidor: cada acción se envía, se espera su
 * respuesta y se muestra lo que el servidor dijo, incluidos los rechazos (409, 422). Sin servidor
 * (`origen: 'maqueta'`) es una demostración en el navegador. Las acciones son asíncronas en los dos casos, para que las
 * pantallas no distingan uno del otro.
 */

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

/** Lo que el asesor puede aportar o corregir al confirmar la cita. */
export interface DatosConfirmacion {
  /** Correo para enviarle la confirmación, si no lo dejó al agendar. */
  correo?: string;
  /** Día acordado (AAAA-MM-DD), si difiere del que pidió el cliente. */
  dia?: string;
  franja?: Cita['franjaHoraria'];
}

/** El resultado de cualquier acción: o se hizo, o dice por qué no (con el texto del servidor si lo hubo). */
export interface ResultadoOperacion {
  ok: boolean;
  error?: string;
  /** Código HTTP del rechazo, si el servidor respondió (0 si no hubo respuesta): 404 y 409 no se explican igual. */
  estado?: number;
}

export interface ResultadoAgendamiento extends ResultadoOperacion {
  /** Lo que quedó registrado, tal como lo confirmó el servidor. */
  cita?: { id: string; diaPreferencia: string; franjaHoraria: Cita['franjaHoraria'] };
}

export interface ResultadoConfirmacion extends ResultadoOperacion {
  /** Cierto si la cédula ya existía en otra persona y ambas se fusionaron. */
  fusionada?: boolean;
}

export interface ResultadoVenta extends ResultadoOperacion {
  /** Solo en ventas financiadas: el token del enlace personal emitido. */
  token?: string;
}

/** Un asesor al que el coordinador puede repartir oportunidades. */
export interface Asesor {
  id: string;
  nombre: string;
}

export interface EnlaceEmitido {
  token: string;
  emitidoEn: string;
}

export interface CRMContextValue {
  /** De dónde sale lo que se muestra: el servidor o la demostración en el navegador. */
  origen: 'servidor' | 'maqueta';
  /** Leyendo del servidor por primera vez. */
  cargando: boolean;
  /** Último fallo al leer del servidor; lo ya cargado se conserva. */
  error: string | null;
  recargar: () => Promise<void>;

  personas: Persona[];
  oportunidades: Oportunidad[];
  interacciones: Interaccion[];
  historial: EventoEtapa[];
  citas: Cita[];
  /** Asesores a quienes se puede asignar (solo el coordinador); vacío para el resto y en la maqueta. */
  asesores: Asesor[];

  obtenerPersona: (id: string) => Persona | undefined;
  obtenerOportunidad: (id: string) => Oportunidad | undefined;
  oportunidadesDePersona: (personaId: string) => Oportunidad[];
  interaccionesDePersona: (personaId: string) => Interaccion[];
  historialDeOportunidad: (oportunidadId: string) => EventoEtapa[];
  /** Momento más reciente entre la última interacción y el último cambio de etapa. */
  ultimaActividad: (oportunidadId: string) => string;
  /**
   * Con servidor, trae la ficha completa de la persona (notas, historial y fusiones); en la maqueta ya está.
   * Falla si la persona no existe o es de otro asesor: el servidor no distingue entre las dos.
   */
  cargarFicha: (personaId: string) => Promise<ResultadoOperacion>;
  /** El enlace recién emitido, mientras dure la sesión de esta pestaña: el servidor no puede volver a mostrarlo. */
  enlaceEmitido: (oportunidadId: string) => EnlaceEmitido | undefined;

  agendarCita: (datos: DatosNuevaCita) => Promise<ResultadoAgendamiento>;
  /** Segundo paso de la captura: la cédula llega aquí (`spec.md` §8.5). */
  confirmarCita: (citaId: string, cedula: string, extra?: DatosConfirmacion) => Promise<ResultadoConfirmacion>;
  descartarCita: (citaId: string, motivo: MotivoPerdida, texto?: string) => Promise<ResultadoOperacion>;
  /** «Asistió a la cita»: la oportunidad pasa a «visitó la sede». */
  registrarAsistencia: (citaId: string) => Promise<ResultadoOperacion>;

  cambiarEtapa: (oportunidadId: string, nueva: Etapa, opciones?: OpcionesTransicion) => Promise<ResultadoOperacion>;
  /**
   * «Vender Vehículo» tras la visita (`spec.md` §8.8). De contado cierra la
   * venta; financiado emite el enlace personal y deja el auto reservado.
   */
  venderVehiculo: (oportunidadId: string, modalidad: 'Contado' | 'Financiamiento') => Promise<ResultadoVenta>;
  registrarInteraccion: (datos: DatosInteraccion) => Promise<ResultadoOperacion>;
  /** El asesor toma para sí una oportunidad sin dueño (D-48). */
  tomarOportunidad: (oportunidadId: string) => Promise<ResultadoOperacion>;
  /** El coordinador reparte una oportunidad a un asesor. */
  asignarAsesor: (oportunidadId: string, asesorId: string) => Promise<ResultadoOperacion>;
  fijarProximaAccion: (oportunidadId: string, accion: string, fecha: string) => Promise<ResultadoOperacion>;

  /** Solo en la maqueta: con servidor no hay nada que restablecer en el navegador. */
  restablecerDatosDemo: () => void;
  /**
   * Solo para la demostración: carga prospectos de ejemplo, rotulados como
   * tales, que cubren todas las etapas, casos estancados y acciones vencidas.
   */
  cargarDatosEjemplo: () => void;
}

export const CRMContext = createContext<CRMContextValue | null>(null);

export function useCRM(): CRMContextValue {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error('useCRM debe usarse dentro de <ProveedorCRM>');
  return ctx;
}
