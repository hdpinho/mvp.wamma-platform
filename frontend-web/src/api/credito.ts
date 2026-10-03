/**
 * Cliente de la API de solicitudes de crédito digital — Fase 3 / WMA-F-FIN-001.
 *
 * Los tipos reflejan **tal cual** los DTO del backend (`CreditApplicationDtos.java`), con sus nombres, para que cambiar
 * uno sin el otro se note al compilar y en las pruebas de contrato (`creditoAdaptadores.test.ts`). Nada de valores de
 * relleno: lo que el servidor no dijo, llega vacío y cada pantalla lo muestra como «no informado».
 */

import { pedirJson, urlDeApi } from './cliente';

// ── Expediente: lo que el formulario envía y el analista lee ──────────────────────────────
// Son mapas libres en el servidor (se guardan cifrados); estas son las claves que el formulario C9 escribe.

export interface DatosPersonalesApi {
  primerNombre?: string;
  segundoNombre?: string;
  primerApellido?: string;
  segundoApellido?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  rif?: string;
  nacionalidad?: string;
  estadoCivil?: string;
  fechaNacimiento?: string;
  lugarNacimiento?: string;
  nivelAcademico?: string;
  cargasFamiliares?: number;
  condicionVivienda?: string;
}

export interface DatosContactoApi {
  direccionHabitacion?: string;
  puntoReferencia?: string;
  estado?: string;
  municipio?: string;
  codigoPostal?: string;
  telefonoHabitacion?: string;
  telefonoCelular?: string;
  correo?: string;
}

export interface DatosLaboralesApi {
  situacionLaboral?: string;
  empresa?: string;
  rifEmpresa?: string;
  cargo?: string;
  antiguedadAnios?: number;
  antiguedadMeses?: number;
  direccionEmpresa?: string;
  telefonoOficina?: string;
  nombreJefeInmediato?: string;
}

export interface DatosFinancierosApi {
  sueldoMensual?: number;
  otrosIngresos?: number;
  conceptoOtrosIngresos?: string;
  alquilerHipoteca?: number;
  alimentacionServicios?: number;
  pagosDeudas?: number;
}

export interface ReferenciaApi {
  nombre?: string;
  parentesco?: string;
  telefono?: string;
}

export interface DatosBancariosApi {
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
}

export interface DeclaracionesApi {
  veracidad?: boolean;
  centralesRiesgo?: boolean;
  origenFondos?: boolean;
  compromisoPago?: boolean;
  esPep?: boolean;
  vinculoPep?: boolean;
  cargoPep?: string;
  institucionPep?: string;
  periodoPep?: string;
  consentimientoDatos?: boolean;
}

// ── Enlace personal y carga de recaudos (públicos) ────────────────────────────────────────

/** Vehículo del enlace, tal como lo describe `VehicleDetailDto`. */
export interface VehiculoEnlaceApi {
  id: string;
  code: string;
  brand: string;
  model: string;
  year: number;
  version: string | null;
  priceEur: number;
  priceVes: number | null;
  photoUrl: string | null;
}

export interface SolicitantePrecargadoApi {
  personId: string;
  fullName: string | null;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
}

/** Política vigente que el servidor aplica a la solicitud (`FinancingParamsSummaryDto`). */
export interface PoliticaEnlaceApi {
  defaultAnnualRate: number;
  defaultMonthlyRate: number;
  minDownPaymentPercentage: number;
  defaultTermMonths: number;
  paymentCapacityPercentage: number;
}

/** Resultado de validar un enlace (`CreditLinkDetailsDto`). Con `valid: false` solo trae el motivo. */
export interface EnlaceCreditoApi {
  valid: boolean;
  invalidReason: string | null;
  opportunityId: string | null;
  vehicle: VehiculoEnlaceApi | null;
  applicant: SolicitantePrecargadoApi | null;
  financingParams: PoliticaEnlaceApi | null;
  bcvRate: number | null;
  bcvDate: string | null;
}

/** Recaudo tal como lo devuelve la carga y como se vuelve a enviar con la solicitud (`DocumentSubmissionDto`). */
export interface RecaudoEnvioApi {
  documentType: string;
  fileKey: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}

/** Lo que el cliente envía con su enlace (`SubmitCreditApplicationRequest`). */
export interface SolicitudEnvioApi {
  token: string;
  montoSolicitado: number;
  cuotaInicial: number;
  plazoMeses: number;
  frecuenciaPago: string;
  cuotaEstimada: number;
  capacidadPagoMensual: number;
  datosPersonales: DatosPersonalesApi;
  datosContacto: DatosContactoApi;
  datosLaborales: DatosLaboralesApi;
  datosFinancieros: DatosFinancierosApi;
  referencias: ReferenciaApi[];
  datosBancarios: DatosBancariosApi;
  declaraciones: DeclaracionesApi;
  recaudos: RecaudoEnvioApi[];
  /** Versión del texto de las declaraciones que la persona aceptó: parte de la evidencia de aceptación (D-57). */
  versionTexto: string;
}

/** Acuse de la solicitud enviada (`SubmitCreditApplicationResponse`). */
export interface SolicitudEnviadaApi {
  id: string;
  numeroSolicitud: string;
  estado: string;
  enviadaEn: string;
  mensaje: string;
}

export const validarEnlaceFinanciamiento = (token: string): Promise<EnlaceCreditoApi> =>
  pedirJson<EnlaceCreditoApi>(`/v1/solicitudes-credito/enlace/${encodeURIComponent(token)}`, { token: null });

/**
 * Carga un recaudo al contenedor privado (D-59) con el enlace personal del cliente: sin un
 * enlace vigente el servidor no acepta el archivo. Solo PDF, JPG o PNG, reconocidos por su
 * contenido.
 */
export const subirRecaudoDigital = (file: File, tipoDocumento: string, tokenEnlace: string): Promise<RecaudoEnvioApi> => {
  const formData = new FormData();
  formData.append('token', tokenEnlace);
  formData.append('tipoDocumento', tipoDocumento);
  formData.append('archivo', file);
  return pedirJson<RecaudoEnvioApi>('/v1/solicitudes-credito/recaudos', {
    method: 'POST',
    formulario: formData,
    token: null,
  });
};

export const enviarSolicitudCredito = (solicitud: SolicitudEnvioApi): Promise<SolicitudEnviadaApi> =>
  pedirJson<SolicitudEnviadaApi>('/v1/solicitudes-credito', { cuerpo: solicitud, token: null });

// ── Bandeja y expediente (requieren sesión con permiso de crédito) ────────────────────────

/** Fila de la bandeja (`CreditApplicationSummaryDto`). */
export interface ResumenSolicitudApi {
  id: string;
  numeroSolicitud: string;
  estado: string;
  vehiculoId: string | null;
  vehiculoCodigo: string | null;
  vehiculoDescripcion: string | null;
  totalRecaudos: number;
  montoSolicitado: number | null;
  cuotaInicial: number | null;
  plazoMeses: number;
  cuotaEstimada: number | null;
  solicitanteNombre: string | null;
  solicitanteDocumento: string | null;
  solicitanteTelefono: string | null;
  solicitanteCorreo: string | null;
  creadoEn: string | null;
}

/** Recaudo del expediente (`DocumentDetailDto`): sin dirección ni clave, el archivo se abre con un enlace firmado (D-59). */
export interface RecaudoExpedienteApi {
  id: string;
  documentType: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  validationStatus: string | null;
  notes: string | null;
  createdAt: string | null;
}

/** Dictamen vigente de la solicitud (`RiskDecisionDto`). Las puntuaciones existen solo si alguna vez se calcularon. */
export interface DictamenApi {
  id: string;
  internalScore: number | null;
  bureauScore: number | null;
  riskLevel: string | null;
  result: string;
  approvedLimit: number | null;
  maxAllowedPayment: number | null;
  justification: string | null;
  evaluatedBy: string | null;
  evaluatedAt: string | null;
}

/** Expediente completo (`CreditApplicationDetailDto`). */
export interface DetalleSolicitudApi {
  id: string;
  numeroSolicitud: string;
  estado: string;
  oportunidadId: string | null;
  personaId: string | null;
  vehiculoId: string | null;
  vehiculo: VehiculoEnlaceApi | null;
  montoSolicitado: number;
  cuotaInicial: number;
  plazoMeses: number;
  moneda: string;
  tasaBcv: number | null;
  fechaTasa: string | null;
  cuotaEstimada: number;
  capacidadPagoMensual: number;
  frecuenciaPago: string | null;
  datosPersonales: DatosPersonalesApi | null;
  datosContacto: DatosContactoApi | null;
  datosLaborales: DatosLaboralesApi | null;
  datosFinancieros: DatosFinancierosApi | null;
  referencias: ReferenciaApi[] | null;
  datosBancarios: DatosBancariosApi | null;
  declaraciones: DeclaracionesApi | null;
  /** Fecha, IP, agente y versión del texto que la persona aceptó (D-57). */
  evidenciaAceptacion: { aceptadoEn?: string; ip?: string; userAgent?: string; versionTexto?: string } | null;
  recaudos: RecaudoExpedienteApi[] | null;
  decisionRiesgo: DictamenApi | null;
  enviadaEn: string | null;
  creadoEn: string | null;
  actualizadoEn: string | null;
}

/** Resultados que admite el dictamen del analista (`EvaluateCreditApplicationRequest.resultado`). */
export type ResultadoDictamen = 'aprobado' | 'rechazado' | 'condicionado';

export interface DictamenEnvioApi {
  resultado: ResultadoDictamen;
  /** Obligatoria: queda con el usuario del analista en la bitácora (D-17, D-63). */
  justificacion: string;
  /** Solo al aprobar. */
  limiteAprobado?: number;
  cuotaMaximaPermitida?: number;
}

/** Estados de validación de un recaudo (`solicitud_recaudo`). */
export type EstadoRecaudo = 'pendiente' | 'conforme' | 'ilegible' | 'rechazado';

export const listarSolicitudesCredito = (estado?: string): Promise<ResumenSolicitudApi[]> =>
  pedirJson<ResumenSolicitudApi[]>(`/v1/solicitudes-credito${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`);

export const obtenerDetalleSolicitudCredito = (id: string): Promise<DetalleSolicitudApi> =>
  pedirJson<DetalleSolicitudApi>(`/v1/solicitudes-credito/${encodeURIComponent(id)}`);

export const evaluarSolicitudCredito = (id: string, dictamen: DictamenEnvioApi): Promise<void> =>
  pedirJson<void>(`/v1/solicitudes-credito/${encodeURIComponent(id)}/evaluacion`, { cuerpo: dictamen });

/** Enlace firmado tal como lo envía el servidor (`DocumentLinkDto`). */
interface EnlaceRecaudoServidor {
  ruta: string;
  venceEn: string;
}

/**
 * Dirección firmada para abrir un recaudo del contenedor privado (D-59). Vence en minutos: se
 * pide cada vez que se abre el archivo y no se guarda. Queda en la bitácora quién la pidió.
 */
export const obtenerEnlaceRecaudo = async (solicitudId: string, docId: string): Promise<string> => {
  const enlace = await pedirJson<EnlaceRecaudoServidor>(
    `/v1/solicitudes-credito/${encodeURIComponent(solicitudId)}/recaudos/${encodeURIComponent(docId)}/enlace`,
  );
  return urlDeApi(enlace.ruta);
};

export const actualizarEstadoRecaudo = (
  solicitudId: string,
  docId: string,
  estado: EstadoRecaudo,
  observaciones?: string,
): Promise<void> =>
  pedirJson<void>(`/v1/solicitudes-credito/${encodeURIComponent(solicitudId)}/recaudos/${encodeURIComponent(docId)}`, {
    method: 'PATCH',
    cuerpo: { estado, observaciones },
  });
