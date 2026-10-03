/**
 * Adaptadores entre el contrato del servidor (`crmDtos.ts`) y el modelo de las pantallas (`types/crm.ts`).
 *
 * Son funciones puras, sin red ni `import.meta.env`, para probarlas con los mismos archivos que fijan el contrato
 * en el backend. Ojo con dos diferencias de vocabulario que viven solo aquí:
 * <ul>
 *   <li>en las pantallas el vehículo se identifica por su **código** (`WAM-00012`), no por su identificador interno;</li>
 *   <li>la franja viaja como `manana` / `tarde` y se muestra como «Mañana» / «Tarde».</li>
 * </ul>
 */
import type {
  Cita,
  CriterioResolucion,
  EventoEtapa,
  Interaccion,
  Oportunidad,
  Persona,
  PersonaAbsorbida,
} from '../types/crm';
import type {
  CitaApi,
  EventoEtapaApi,
  FusionApi,
  InteraccionApi,
  OportunidadApi,
  PersonaDetalleApi,
  PersonaResumenApi,
} from './crmDtos';

export type FranjaPantalla = Cita['franjaHoraria'];

export const franjaDesdeApi = (franja: 'manana' | 'tarde'): FranjaPantalla => (franja === 'tarde' ? 'Tarde' : 'Mañana');

/** Lo que el servidor espera: sin tilde y en minúsculas. */
export const franjaParaApi = (franja: FranjaPantalla): 'manana' | 'tarde' => (franja === 'Tarde' ? 'tarde' : 'manana');

export function oportunidadDesdeApi(o: OportunidadApi): Oportunidad {
  return {
    id: o.id,
    personaId: o.personaId,
    vehiculoId: o.vehiculoCodigo,
    vehiculoResumen: {
      marca: o.vehiculoMarca,
      modelo: o.vehiculoModelo,
      version: o.vehiculoVersion ?? '',
      anio: o.vehiculoAnio,
      precioUSD: o.valorEstimado,
      foto: o.vehiculoFotoUrl ?? undefined,
    },
    etapa: o.etapa,
    modalidadPago: o.modalidadPago === 'contado' ? 'Contado' : 'Financiamiento',
    valorEstimadoUSD: o.valorEstimado,
    asesorId: o.asesorId,
    asesorNombre: o.asesorNombre ?? undefined,
    proximaAccion: o.proximaAccion ?? undefined,
    proximaAccionFecha: o.proximaAccionFecha ?? undefined,
    motivoPerdida: o.motivoPerdida ?? undefined,
    motivoPerdidaTexto: o.detallePerdida ?? undefined,
    fechaCreacion: o.creadoEn,
    fechaCierre: o.cerradoEn ?? undefined,
    enlaceFinanciamiento:
      o.tieneEnlaceFinanciamiento && o.enlaceEmitidoEn
        ? {
            emitidoEn: o.enlaceEmitidoEn,
            venceEn: o.enlaceVenceEn ?? undefined,
            usadoEn: o.enlaceUsadoEn ?? undefined,
          }
        : undefined,
    version: o.version,
    ultimaActividadEn: o.ultimaActividadEn,
    entroEtapaEn: o.entroEtapaEn,
    solicitudCredito: o.solicitudCreditoId
      ? { id: o.solicitudCreditoId, numero: o.solicitudCreditoNumero, estado: o.solicitudCreditoEstado }
      : undefined,
  };
}

export function citaDesdeApi(c: CitaApi): Cita {
  return {
    id: c.id,
    personaId: c.personaId,
    oportunidadId: c.oportunidadId,
    vehiculoId: c.vehiculoCodigo,
    diaPreferencia: c.diaPreferencia,
    franjaHoraria: franjaDesdeApi(c.franjaHoraria),
    estado: c.estado,
    fechaCreacion: c.creadoEn,
  };
}

/** El servidor manda todos los teléfonos con el principal primero; en pantalla el principal y «otros». */
function telefonosDePersona(telefonos: string[], principal: string | null): string[] {
  if (telefonos.length > 0) return telefonos;
  return principal ? [principal] : [];
}

export function personaDesdeResumenApi(p: PersonaResumenApi): Persona {
  const telefonos = telefonosDePersona(p.telefonos, p.telefonoPrincipal);
  return {
    id: p.id,
    nombreApellido: p.nombreApellido,
    cedula: p.cedula ?? undefined,
    telefonoWhatsApp: telefonos[0] ?? '',
    telefonosAdicionales: telefonos.length > 1 ? telefonos.slice(1) : undefined,
    correo: p.correo ?? undefined,
    canalOrigen: p.canalOrigen,
    criterioResolucion: p.criterioResolucion as CriterioResolucion,
    fechaCreacion: p.creadoEn,
    ultimaActividadEn: p.ultimaActividadEn,
  };
}

export function interaccionDesdeApi(i: InteraccionApi): Interaccion {
  return {
    id: i.id,
    personaId: i.personaId,
    oportunidadId: i.oportunidadId ?? undefined,
    canal: i.canal,
    direccion: i.direccion,
    nota: i.nota,
    autorId: i.autorId,
    ocurridoEn: i.ocurridoEn,
    registradoEn: i.registradoEn,
    corrigeInteraccionId: i.corrigeInteraccionId ?? undefined,
  };
}

export function eventoDesdeApi(e: EventoEtapaApi): EventoEtapa {
  return {
    id: e.id,
    oportunidadId: e.oportunidadId,
    etapaAnterior: e.etapaAnterior,
    etapaNueva: e.etapaNueva,
    nota: e.nota ?? undefined,
    actorId: e.actorId,
    ts: e.ts,
  };
}

export function fusionDesdeApi(f: FusionApi): PersonaAbsorbida {
  return {
    id: f.id,
    nombreApellido: f.nombreApellido,
    telefonoWhatsApp: f.telefonos[0] ?? '',
    telefonosAdicionales: f.telefonos.length > 1 ? f.telefonos.slice(1) : undefined,
    correo: f.correo ?? undefined,
    fechaCreacion: f.fechaCreacion ?? f.fusionadaEn,
    fusionadaEn: f.fusionadaEn,
    oportunidadIds: f.oportunidadIds,
    citaIds: f.citaIds,
    interaccionIds: f.interaccionIds,
  };
}

/** Lo que trae la ficha 360 de una persona, ya con el modelo de las pantallas. */
export interface Ficha {
  persona: Persona;
  oportunidades: Oportunidad[];
  citas: Cita[];
  interacciones: Interaccion[];
  historial: EventoEtapa[];
}

export function fichaDesdeApi(d: PersonaDetalleApi): Ficha {
  const persona = personaDesdeResumenApi({
    id: d.id,
    nombreApellido: d.nombreApellido,
    cedula: d.cedula,
    telefonoPrincipal: d.telefonos[0] ?? null,
    telefonos: d.telefonos,
    correo: d.correo,
    canalOrigen: d.canalOrigen,
    estado: d.estado,
    criterioResolucion: d.criterioResolucion,
    creadoEn: d.creadoEn,
    ultimaActividadEn: d.actualizadoEn,
  });
  return {
    persona: {
      ...persona,
      fusionadaDesde: d.fusiones.length > 0 ? d.fusiones.map(fusionDesdeApi) : undefined,
      fusionadaCon: d.fusionadaCon ?? undefined,
    },
    oportunidades: d.oportunidades.map(oportunidadDesdeApi),
    citas: d.citas.map(citaDesdeApi),
    interacciones: d.interacciones.map(interaccionDesdeApi),
    historial: d.historial.map(eventoDesdeApi),
  };
}

/** Teléfono E.164 del servidor a como lo escribe un venezolano: `+584141234567` → `04141234567`. */
export const telefonoLocal = (e164: string): string => {
  const digitos = e164.replace(/\D/g, '');
  return digitos.startsWith('58') ? `0${digitos.slice(2)}` : digitos;
};
