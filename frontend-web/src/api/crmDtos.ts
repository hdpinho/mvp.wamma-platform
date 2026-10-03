/**
 * Contrato de la API del CRM, tal como responde el servidor (`backend/.../crm/CrmDtos.java`).
 *
 * Es solo tipos: un DTO por concepto, con las mismas claves que el DTO Java. Las pruebas de contrato del
 * backend fijan esas claves con los archivos de `backend/src/test/resources/contratos/`, y las pruebas de la web
 * pasan esos mismos archivos por los adaptadores de `crmAdaptadores.ts`: si una clave cambia de un lado, falla
 * una de las dos pruebas (hallazgos F-05, F-06 y F-07 del informe QA: los contratos se habían separado sin aviso).
 */
import type {
  CanalInteraccion,
  DireccionInteraccion,
  Etapa,
  EstadoSolicitudCredito,
  MotivoPerdida,
} from '../types/crm';

export interface OportunidadApi {
  id: string;
  personaId: string;
  personaNombre: string;
  vehiculoId: string;
  vehiculoCodigo: string;
  vehiculoMarca: string;
  vehiculoModelo: string;
  vehiculoVersion: string | null;
  vehiculoAnio: number;
  vehiculoFotoUrl: string | null;
  modalidadPago: 'contado' | 'financiamiento';
  valorEstimado: number;
  moneda: string;
  tasaBcv: number;
  fechaTasa: string;
  etapa: Etapa;
  motivoPerdida: MotivoPerdida | null;
  detallePerdida: string | null;
  asesorId: string | null;
  asesorNombre: string | null;
  proximaAccion: string | null;
  proximaAccionFecha: string | null;
  solicitudCreditoId: string | null;
  solicitudCreditoNumero: string | null;
  solicitudCreditoEstado: EstadoSolicitudCredito | null;
  tieneEnlaceFinanciamiento: boolean;
  enlaceEmitidoEn: string | null;
  enlaceVenceEn: string | null;
  enlaceUsadoEn: string | null;
  cerradoEn: string | null;
  version: number;
  creadoEn: string;
  actualizadoEn: string;
  ultimaActividadEn: string;
  entroEtapaEn: string;
}

export interface CitaApi {
  id: string;
  personaId: string;
  personaNombre: string;
  oportunidadId: string;
  vehiculoId: string;
  vehiculoCodigo: string;
  vehiculoTitulo: string;
  diaPreferencia: string;
  franjaHoraria: 'manana' | 'tarde';
  estado: 'pendiente' | 'confirmada' | 'descartada';
  notas: string | null;
  reservaVenceEn: string | null;
  creadoEn: string;
}

export interface InteraccionApi {
  id: string;
  personaId: string;
  oportunidadId: string | null;
  canal: CanalInteraccion;
  direccion: DireccionInteraccion;
  nota: string;
  autorId: string | null;
  ocurridoEn: string;
  registradoEn: string;
  corrigeInteraccionId: string | null;
}

export interface EventoEtapaApi {
  id: string;
  oportunidadId: string;
  etapaAnterior: Etapa | null;
  etapaNueva: Etapa;
  nota: string | null;
  actorId: string | null;
  ts: string;
}

export interface FusionApi {
  id: string;
  nombreApellido: string;
  telefonos: string[];
  correo: string | null;
  fechaCreacion: string | null;
  fusionadaEn: string;
  oportunidadIds: string[];
  citaIds: string[];
  interaccionIds: string[];
}

export interface PersonaResumenApi {
  id: string;
  nombreApellido: string;
  cedula: string | null;
  telefonoPrincipal: string | null;
  telefonos: string[];
  correo: string | null;
  canalOrigen: string;
  estado: string;
  criterioResolucion: string;
  creadoEn: string;
  ultimaActividadEn: string;
}

export interface PersonaDetalleApi {
  id: string;
  nombreApellido: string;
  cedula: string | null;
  correo: string | null;
  canalOrigen: string;
  asesorId: string | null;
  estado: string;
  criterioResolucion: string;
  telefonos: string[];
  oportunidades: OportunidadApi[];
  citas: CitaApi[];
  interacciones: InteraccionApi[];
  historial: EventoEtapaApi[];
  fusiones: FusionApi[];
  /** Si este registro fue absorbido por otro, el de la persona vigente. */
  fusionadaCon: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface AsesorApi {
  id: string;
  nombre: string;
}

/** Lo que recibe el visitante al agendar (`AppointmentService.ScheduleResult`). */
export interface RespuestaCitaPublicaApi {
  id: string;
  diaPreferencia: string;
  franjaHoraria: 'manana' | 'tarde';
  estado: string;
}

/** Lo que recibe el asesor al confirmar (`AppointmentService.ConfirmResult`). */
export interface RespuestaConfirmacionApi {
  ok: boolean;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  dia: string;
  franja: 'manana' | 'tarde';
}

/** El enlace personal solo viaja aquí, al emitirlo: el servidor guarda su huella y no puede volver a mostrarlo. */
export interface RespuestaVentaApi {
  oportunidad: OportunidadApi;
  tokenFinanciamiento: string | null;
}
