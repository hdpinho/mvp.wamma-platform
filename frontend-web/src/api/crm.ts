/**
 * Cliente de la API de CRM y Citas — specs/010-crm-comercial/.
 *
 * Cada función envía el cuerpo exacto que espera el controlador Java y devuelve el DTO tal cual lo responde; la
 * traducción al modelo de las pantallas vive en `crmAdaptadores.ts`. Nombres de claves y de parámetros: los del
 * backend (`CrmOpportunityController`, `CrmAppointmentController`, `CrmPersonController`).
 */

import { pedirJson } from './cliente';
import type {
  AsesorApi,
  CitaApi,
  InteraccionApi,
  OportunidadApi,
  PersonaDetalleApi,
  PersonaResumenApi,
  RespuestaCitaPublicaApi,
  RespuestaConfirmacionApi,
  RespuestaVentaApi,
} from './crmDtos';
import type { CanalInteraccion, DireccionInteraccion, Etapa } from '../types/crm';

export interface SolicitudCitaPublica {
  nombreApellido: string;
  telefonoWhatsApp: string;
  correo?: string;
  modalidadPago: 'contado' | 'financiamiento';
  /** Uno de los dos: el identificador interno (UUID) o el código del vehículo (`WAM-00012`). */
  vehiculoId?: string;
  vehiculoCodigo?: string;
  diaPreferencia: string;
  franjaHoraria: 'manana' | 'tarde';
}

const qs = (params: Record<string, string | number | boolean | undefined>): string => {
  const p = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '' && valor !== false) p.set(clave, String(valor));
  }
  const texto = p.toString();
  return texto ? `?${texto}` : '';
};

export const crmApi = {
  // ── Público (sin sesión) ──────────────────────────────────────────────────
  agendarCitaPublica(datos: SolicitudCitaPublica): Promise<RespuestaCitaPublicaApi> {
    return pedirJson<RespuestaCitaPublicaApi>('/v1/citas', { method: 'POST', cuerpo: datos, token: null });
  },

  // ── Citas (backoffice) ────────────────────────────────────────────────────
  listarCitas(filtros: { estado?: string } = {}): Promise<CitaApi[]> {
    return pedirJson<CitaApi[]>(`/v1/crm/citas${qs({ estado: filtros.estado })}`);
  },

  confirmarCita(
    id: string,
    datos: { cedula: string; correo?: string; dia?: string; franja?: 'manana' | 'tarde' },
  ): Promise<RespuestaConfirmacionApi> {
    return pedirJson<RespuestaConfirmacionApi>(`/v1/crm/citas/${encodeURIComponent(id)}/confirmacion`, {
      method: 'POST',
      cuerpo: datos,
    });
  },

  descartarCita(id: string, motivo: string, detalle?: string): Promise<void> {
    return pedirJson<void>(`/v1/crm/citas/${encodeURIComponent(id)}/descarte`, {
      method: 'POST',
      cuerpo: { motivo, detalle },
    });
  },

  registrarAsistenciaCita(id: string): Promise<void> {
    return pedirJson<void>(`/v1/crm/citas/${encodeURIComponent(id)}/asistencia`, { method: 'POST' });
  },

  // ── Oportunidades ─────────────────────────────────────────────────────────
  listarOportunidades(
    filtros: { etapa?: string; asesorId?: string; sinAsesor?: boolean; limit?: number } = {},
  ): Promise<OportunidadApi[]> {
    return pedirJson<OportunidadApi[]>(`/v1/crm/oportunidades${qs(filtros)}`);
  },

  /** `version` es la que trajo la lectura: si otra persona la cambió, el servidor responde 409. */
  cambiarEtapa(
    id: string,
    version: number,
    datos: { etapa: Etapa; motivo?: string; detalle?: string; nota?: string },
  ): Promise<OportunidadApi> {
    return pedirJson<OportunidadApi>(`/v1/crm/oportunidades/${encodeURIComponent(id)}/etapa`, {
      method: 'PATCH',
      cabeceras: { 'If-Match': `"${version}"` },
      cuerpo: datos,
    });
  },

  /** Sin `asesorId` el asesor la toma para sí; asignar a otro es del coordinador. */
  asignarAsesor(id: string, asesorId?: string): Promise<OportunidadApi> {
    return pedirJson<OportunidadApi>(`/v1/crm/oportunidades/${encodeURIComponent(id)}/asesor`, {
      method: 'PUT',
      cuerpo: asesorId ? { asesorId } : {},
    });
  },

  fijarProximaAccion(id: string, accion: string, fecha: string): Promise<OportunidadApi> {
    return pedirJson<OportunidadApi>(`/v1/crm/oportunidades/${encodeURIComponent(id)}/proxima-accion`, {
      method: 'PUT',
      cuerpo: { accion, fecha },
    });
  },

  venderVehiculo(id: string, modalidad: 'contado' | 'financiamiento'): Promise<RespuestaVentaApi> {
    return pedirJson<RespuestaVentaApi>(`/v1/crm/oportunidades/${encodeURIComponent(id)}/venta`, {
      method: 'POST',
      cuerpo: { modalidad },
    });
  },

  listarAsesores(): Promise<AsesorApi[]> {
    return pedirJson<AsesorApi[]>('/v1/crm/asesores');
  },

  // ── Personas ──────────────────────────────────────────────────────────────
  buscarPersonas(q?: string, limit = 500): Promise<PersonaResumenApi[]> {
    return pedirJson<PersonaResumenApi[]>(`/v1/crm/personas${qs({ q, limit })}`);
  },

  obtenerPersona(id: string): Promise<PersonaDetalleApi> {
    return pedirJson<PersonaDetalleApi>(`/v1/crm/personas/${encodeURIComponent(id)}`);
  },

  /** La llave de idempotencia evita duplicar la nota si la petición se repite (reintento o doble clic). */
  registrarInteraccion(
    personaId: string,
    datos: { oportunidadId?: string; canal: CanalInteraccion; direccion: DireccionInteraccion; nota: string },
    llaveIdempotencia: string,
  ): Promise<InteraccionApi> {
    return pedirJson<InteraccionApi>(`/v1/crm/personas/${encodeURIComponent(personaId)}/interacciones`, {
      method: 'POST',
      cabeceras: { 'Idempotency-Key': llaveIdempotencia },
      cuerpo: datos,
    });
  },
};
