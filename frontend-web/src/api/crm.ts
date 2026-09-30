/**
 * Cliente de la API de CRM y Citas — specs/010-crm-comercial/.
 */

import { pedirJson } from './cliente';
import type {
  CanalInteraccion,
  DireccionInteraccion,
  Etapa,
  MotivoPerdida,
} from '../types/crm';

export interface SolicitudCitaPublica {
  nombreApellido: string;
  telefonoWhatsApp: string;
  correo?: string;
  modalidadPago: 'contado' | 'financiamiento';
  vehiculoId?: string;
  vehiculoCodigo?: string;
  diaPreferencia: string;
  franjaHoraria: string;
}

export interface RespuestaCitaPublica {
  id: string;
  preferredDate: string;
  slot: string;
  status: string;
}

export interface CitaBackendDto {
  id: string;
  personaId: string;
  oportunidadId: string;
  vehiculoId: string;
  sedeId: string | null;
  diaPreferido: string;
  franja: string;
  estado: string;
  notas: string | null;
  reservaVenceEn: string | null;
  creadoEn: string;
  actualizadoEn: string;
  personaNombre?: string;
  personaTelefono?: string;
  vehiculoTitulo?: string;
  vehiculoCodigo?: string;
}

export interface OportunidadBackendDto {
  id: string;
  personaId: string;
  personaNombre: string;
  personaTelefono: string | null;
  vehiculoId: string;
  vehiculoCodigo: string | null;
  vehiculoTitulo: string | null;
  vehiculoFotoKey: string | null;
  modalidadPago: string;
  valorEstimado: number;
  moneda: string;
  tasaBcv: number;
  fechaTasa: string;
  etapa: Etapa;
  motivoPerdida: MotivoPerdida | null;
  detallePerdida: string | null;
  asesorId: string | null;
  proximaAccion: string | null;
  proximaAccionFecha: string | null;
  solicitudCreditoId: string | null;
  tieneEnlaceFinanciamiento: boolean;
  cerradoEn: string | null;
  version: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface DetallePersonaBackendDto {
  id: string;
  nombreApellido: string;
  cedula: string | null;
  telefonos: string[];
  correo: string | null;
  criterioResolucion: string;
  fusionadaConId: string | null;
  creadoEn: string;
  actualizadoEn: string;
  oportunidades: OportunidadBackendDto[];
  citas: CitaBackendDto[];
  interacciones: InteraccionBackendDto[];
}

export interface InteraccionBackendDto {
  id: string;
  personId: string;
  opportunityId: string | null;
  channel: CanalInteraccion;
  direction: DireccionInteraccion;
  note: string;
  authorId: string | null;
  correctsInteractionId: string | null;
  occurredAt: string;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface ValidacionEnlaceFinanciamiento {
  valid: boolean;
  invalidReason: string | null;
  vehicle: {
    id: string;
    code: string;
    brand: string;
    model: string;
    year: number;
    version: string;
    price: number;
    photoKey: string | null;
  } | null;
  paymentMethod: string;
  estimatedValue: number;
  opportunityId: string;
}

export const crmApi = {
  // ── Público ───────────────────────────────────────────────────────────────
  agendarCitaPublica(datos: SolicitudCitaPublica): Promise<RespuestaCitaPublica> {
    return pedirJson<RespuestaCitaPublica>('/v1/citas', {
      method: 'POST',
      cuerpo: datos,
      token: null,
    });
  },

  validarEnlaceFinanciamiento(token: string): Promise<ValidacionEnlaceFinanciamiento> {
    return pedirJson<ValidacionEnlaceFinanciamiento>(`/v1/enlaces-financiamiento/${encodeURIComponent(token)}`, {
      method: 'GET',
      token: null,
    });
  },

  // ── Citas Backoffice ──────────────────────────────────────────────────────
  listarCitas(filtros: { estado?: string; asesorId?: string; todos?: boolean } = {}): Promise<CitaBackendDto[]> {
    const params = new URLSearchParams();
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.asesorId) params.set('asesorId', filtros.asesorId);
    if (filtros.todos) params.set('todos', 'true');
    const qs = params.toString();
    return pedirJson<CitaBackendDto[]>(`/v1/crm/citas${qs ? `?${qs}` : ''}`);
  },

  confirmarCita(
    id: string,
    datos: { cedula?: string; correo?: string; dia?: string; franja?: string }
  ): Promise<{ ok: boolean; clientName: string; clientPhone: string; clientEmail: string; date: string; slot: string }> {
    return pedirJson(`/v1/crm/citas/${id}/confirmacion`, {
      method: 'POST',
      cuerpo: datos,
    });
  },

  descartarCita(id: string, motivoPerdida: string, detallePerdida?: string): Promise<void> {
    return pedirJson<void>(`/v1/crm/citas/${id}/descarte`, {
      method: 'POST',
      cuerpo: { motivoPerdida, detallePerdida },
    });
  },

  registrarAsistenciaCita(id: string): Promise<void> {
    return pedirJson<void>(`/v1/crm/citas/${id}/asistencia`, {
      method: 'POST',
    });
  },

  // ── Oportunidades ─────────────────────────────────────────────────────────
  listarOportunidades(filtros: {
    etapa?: string;
    asesorId?: string;
    sinAsignar?: boolean;
    offset?: number;
    limite?: number;
  } = {}): Promise<OportunidadBackendDto[]> {
    const params = new URLSearchParams();
    if (filtros.etapa) params.set('etapa', filtros.etapa);
    if (filtros.asesorId) params.set('asesorId', filtros.asesorId);
    if (filtros.sinAsignar) params.set('sinAsignar', 'true');
    if (filtros.offset !== undefined) params.set('offset', String(filtros.offset));
    if (filtros.limite !== undefined) params.set('limite', String(filtros.limite));
    const qs = params.toString();
    return pedirJson<OportunidadBackendDto[]>(`/v1/crm/oportunidades${qs ? `?${qs}` : ''}`);
  },

  obtenerOportunidad(id: string): Promise<OportunidadBackendDto> {
    return pedirJson<OportunidadBackendDto>(`/v1/crm/oportunidades/${id}`);
  },

  cambiarEtapa(
    id: string,
    version: number,
    datos: { etapaDestino: Etapa; motivoPerdida?: string; detallePerdida?: string; nota?: string }
  ): Promise<OportunidadBackendDto> {
    return pedirJson<OportunidadBackendDto>(`/v1/crm/oportunidades/${id}/etapa`, {
      method: 'PATCH',
      cabeceras: {
        'If-Match': `"${version}"`,
      },
      cuerpo: datos,
    });
  },

  asignarAsesor(id: string, asesorId: string | null): Promise<void> {
    return pedirJson<void>(`/v1/crm/oportunidades/${id}/asesor`, {
      method: 'PUT',
      cuerpo: { asesorId },
    });
  },

  fijarProximaAccion(id: string, accion: string, fecha: string): Promise<void> {
    return pedirJson<void>(`/v1/crm/oportunidades/${id}/proxima-accion`, {
      method: 'PUT',
      cuerpo: { accion, fecha },
    });
  },

  venderVehiculo(
    id: string,
    modalidad: 'contado' | 'financiamiento'
  ): Promise<{ oportunidad: OportunidadBackendDto; tokenFinanciamiento?: string }> {
    return pedirJson(`/v1/crm/oportunidades/${id}/venta`, {
      method: 'POST',
      cuerpo: { modalidad },
    });
  },

  // ── Personas ──────────────────────────────────────────────────────────────
  buscarPersonas(q?: string, limite = 20): Promise<DetallePersonaBackendDto[]> {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('limite', String(limite));
    return pedirJson<DetallePersonaBackendDto[]>(`/v1/crm/personas?${params.toString()}`);
  },

  obtenerPersona(id: string): Promise<DetallePersonaBackendDto> {
    return pedirJson<DetallePersonaBackendDto>(`/v1/crm/personas/${id}`);
  },

  registrarInteraccion(
    personaId: string,
    datos: { oportunidadId?: string; canal: CanalInteraccion; direccion: DireccionInteraccion; nota: string }
  ): Promise<InteraccionBackendDto> {
    return pedirJson<InteraccionBackendDto>(`/v1/crm/personas/${personaId}/interacciones`, {
      method: 'POST',
      cuerpo: datos,
    });
  },

  // ── Catálogos y Métricas ──────────────────────────────────────────────────
  obtenerCatalogos(): Promise<{ stages: unknown[]; lossReasons: unknown[] }> {
    return pedirJson('/v1/crm/catalogos');
  },

  obtenerMetricasEmbudo(): Promise<unknown> {
    return pedirJson('/v1/crm/metricas/embudo');
  },
};
