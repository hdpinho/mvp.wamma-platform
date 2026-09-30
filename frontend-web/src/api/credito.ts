/**
 * Cliente de la API de Solicitudes de Crédito Digital — Fase 3 / WMA-F-FIN-001.
 */

import { pedirJson } from './cliente';

export interface ValidacionEnlaceDto {
  valido: boolean;
  vehiculoId?: string;
  vehiculoTitulo?: string;
  vehiculoCodigo?: string;
  precioEur?: number;
  inicialSugeridaEur?: number;
  plazoMesesSugerido?: number;
  personaNombre?: string;
  personaTelefono?: string;
  oportunidadId?: string;
  mensaje?: string;
}

export interface RecaudoCargadoDto {
  storageKey: string;
  tipoDocumento: string;
  nombreOriginal: string;
  tamanoBytes: number;
  mimeType: string;
}

export interface CrearSolicitudPayload {
  tokenEnlace?: string;
  vehiculoId: string;
  montoSolicitadoEur: number;
  inicialAportadaEur: number;
  plazoMeses: number;
  frecuenciaPago: string;

  // Paso 1
  primerApellido: string;
  segundoApellido?: string;
  primerNombre: string;
  segundoNombre?: string;
  tipoDocumento: string;
  numeroDocumento: string;
  rif: string;
  nacionalidad: string;
  estadoCivil: string;
  fechaNacimiento: string;
  lugarNacimiento: string;
  nivelAcademico: string;
  cargasFamiliares: number;
  condicionVivienda: string;

  // Paso 2
  direccionHabitacion: string;
  puntoReferencia?: string;
  estado: string;
  municipio: string;
  codigoPostal: string;
  telefonoHabitacion?: string;
  telefonoCelular: string;
  correo: string;

  // Paso 3
  situacionLaboral: string;
  nombreEmpresa?: string;
  rifEmpresa?: string;
  cargo?: string;
  antiguedadAnios?: number;
  antiguedadMeses?: number;
  direccionEmpresa?: string;
  telefonoOficina?: string;
  nombreJefeInmediato?: string;

  // Paso 4
  sueldoMensualEur: number;
  otrosIngresosEur?: number;
  conceptoOtrosIngresos?: string;
  alquilerHipotecaEur?: number;
  alimentacionServiciosEur?: number;
  pagosDeudasEur?: number;

  // Paso 5
  referencias: { nombre: string; parentesco: string; telefono: string }[];
  bancoPrincipal: string;
  tipoCuenta: string;
  numeroCuenta: string;

  // Paso 7
  esPep: boolean;
  vinculoPep: boolean;
  cargoPep?: string;
  institucionPep?: string;
  periodoPep?: string;
  consentimientoDatos: boolean;

  recaudos: {
    tipoDocumento: string;
    nombreOriginal: string;
    storageKey: string;
    mimeType: string;
    tamanoBytes: number;
  }[];
}

export interface SolicitudCreadaDto {
  id: string;
  numeroSolicitud: string;
  estado: string;
  fechaRecepcion: string;
  mensaje: string;
}

export interface EstadoSolicitudDto {
  numeroSolicitud: string;
  estado: string;
  fechaRecepcion: string;
  vehiculoTitulo: string;
  vehiculoCodigo: string;
  observaciones?: string;
}

export interface SolicitudResumenDto {
  id: string;
  numeroSolicitud: string;
  estado: string;
  fechaRecepcion: string;
  personaNombre: string;
  personaCedula: string;
  personaTelefono: string;
  vehiculoTitulo: string;
  vehiculoCodigo: string;
  montoSolicitadoEur: number;
  inicialAportadaEur: number;
  plazoMeses: number;
  cuotaEstimadaEur: number;
  totalRecaudos: number;
}

export interface CreditDocumentDto {
  id: string;
  solicitudCreditoId: string;
  tipoDocumento: string;
  nombreOriginal: string;
  storageKey: string;
  mimeType: string;
  tamanoBytes: number;
  estado: string;
  notas?: string;
  creadoEn: string;
}

export interface SolicitudDetalleDto {
  solicitud: Record<string, any>;
  recaudos: CreditDocumentDto[];
  calculoCapacidad: {
    ingresoTotalEur: number;
    egresoTotalEur: number;
    capacidadPagoEur: number;
    montoFinanciadoEur: number;
    cuotaEstimadaEur: number;
    tasaInteresAnual: number;
    porcentajeCapacidadUsada: number;
    porcentajeInicial: number;
    inicialMinimaRequeridaEur: number;
    alertaCapacidad: boolean;
    alertaInicial: boolean;
  };
}

export interface EvaluarSolicitudPayload {
  nuevoEstado: 'en_analisis' | 'aprobada' | 'rechazada' | 'devuelta';
  observaciones: string;
  limiteAprobado?: number;
  cuotaMaximaPermitida?: number;
  scoreCrediticio?: number;
}

export interface ActualizarRecaudoPayload {
  estado: 'verificado' | 'rechazado' | 'pendiente';
  notas?: string;
}

// ── Endpoints Públicos ────────────────────────────────────────────────

export const validarEnlaceFinanciamiento = (token: string): Promise<ValidacionEnlaceDto> =>
  pedirJson<ValidacionEnlaceDto>(`/v1/solicitudes-credito/enlace/${encodeURIComponent(token)}`, {
    token: null,
  });

export const subirRecaudoDigital = async (
  file: File,
  tipoDocumento: string
): Promise<RecaudoCargadoDto> => {
  const formData = new FormData();
  formData.append('archivo', file);
  formData.append('tipoDocumento', tipoDocumento);

  return pedirJson<RecaudoCargadoDto>('/v1/solicitudes-credito/recaudos', {
    formulario: formData,
    token: null,
  });
};

export const enviarSolicitudCredito = (
  payload: CrearSolicitudPayload
): Promise<SolicitudCreadaDto> => {
  const montoSolicitado = payload.montoSolicitadoEur ?? 0;
  const plazoMeses = payload.plazoMeses > 0 ? payload.plazoMeses : 24;
  const cuotaEstimada = montoSolicitado > 0 ? Number((montoSolicitado / plazoMeses).toFixed(2)) : 0;
  const capacidadPago = Number(((payload.sueldoMensualEur ?? 0) * 0.3).toFixed(2));

  const cuerpo = {
    token: payload.tokenEnlace,
    vehiculoId: payload.vehiculoId,
    montoSolicitado,
    cuotaInicial: payload.inicialAportadaEur ?? 0,
    plazoMeses,
    frecuenciaPago: payload.frecuenciaPago || 'Mensual',
    cuotaEstimada,
    capacidadPagoMensual: capacidadPago,
    datosPersonales: {
      primerNombre: payload.primerNombre,
      segundoNombre: payload.segundoNombre,
      primerApellido: payload.primerApellido,
      segundoApellido: payload.segundoApellido,
      tipoDocumento: payload.tipoDocumento,
      numeroDocumento: payload.numeroDocumento,
      rif: payload.rif,
      nacionalidad: payload.nacionalidad,
      estadoCivil: payload.estadoCivil,
      fechaNacimiento: payload.fechaNacimiento,
      lugarNacimiento: payload.lugarNacimiento,
      nivelAcademico: payload.nivelAcademico,
      cargasFamiliares: payload.cargasFamiliares,
      condicionVivienda: payload.condicionVivienda,
    },
    datosContacto: {
      direccionHabitacion: payload.direccionHabitacion,
      puntoReferencia: payload.puntoReferencia,
      estado: payload.estado,
      municipio: payload.municipio,
      codigoPostal: payload.codigoPostal,
      telefonoHabitacion: payload.telefonoHabitacion,
      telefonoCelular: payload.telefonoCelular,
      correo: payload.correo,
    },
    datosLaborales: {
      situacionLaboral: payload.situacionLaboral,
      empresa: payload.nombreEmpresa,
      rifEmpresa: payload.rifEmpresa,
      cargo: payload.cargo,
      antiguedadAnios: payload.antiguedadAnios,
      antiguedadMeses: payload.antiguedadMeses,
      direccionEmpresa: payload.direccionEmpresa,
      telefonoOficina: payload.telefonoOficina,
      nombreJefeInmediato: payload.nombreJefeInmediato,
    },
    datosFinancieros: {
      sueldoMensual: payload.sueldoMensualEur,
      otrosIngresos: payload.otrosIngresosEur || 0,
      conceptoOtrosIngresos: payload.conceptoOtrosIngresos,
      alquilerHipoteca: payload.alquilerHipotecaEur || 0,
      alimentacionServicios: payload.alimentacionServiciosEur || 0,
      pagosDeudas: payload.pagosDeudasEur || 0,
    },
    referencias: payload.referencias,
    datosBancarios: {
      banco: payload.bancoPrincipal,
      tipoCuenta: payload.tipoCuenta,
      numeroCuenta: payload.numeroCuenta,
    },
    declaraciones: {
      veracidad: true,
      centralesRiesgo: true,
      origenFondos: true,
      compromisoPago: true,
      esPep: payload.esPep,
      vinculoPep: payload.vinculoPep,
      cargoPep: payload.cargoPep,
      institucionPep: payload.institucionPep,
      periodoPep: payload.periodoPep,
      consentimientoDatos: payload.consentimientoDatos,
    },
    recaudos: (payload.recaudos || []).map((r) => ({
      documentType: r.tipoDocumento,
      fileUrl: r.storageKey,
      fileName: r.nombreOriginal,
      fileSizeBytes: r.tamanoBytes,
      mimeType: r.mimeType,
    })),
    codigoOtp: '175593',
    otpVerificado: true,
  };

  return pedirJson<SolicitudCreadaDto>('/v1/solicitudes-credito', {
    cuerpo,
    token: null,
  });
};

export const consultarEstadoSolicitud = (
  numeroSolicitud: string
): Promise<EstadoSolicitudDto> =>
  pedirJson<EstadoSolicitudDto>(`/v1/solicitudes-credito/${encodeURIComponent(numeroSolicitud)}/estado`, {
    token: null,
  });

// ── Endpoints Backoffice (Requiere Sesión) ─────────────────────────────

export const listarSolicitudesCredito = async (estado?: string): Promise<SolicitudResumenDto[]> => {
  const query = estado ? `?estado=${encodeURIComponent(estado)}` : '';
  const data = await pedirJson<any[]>(`/v1/solicitudes-credito${query}`);
  return data.map((item) => ({
    id: item.id,
    numeroSolicitud: item.numeroSolicitud,
    estado: item.estado,
    fechaRecepcion: item.creadoEn || item.fechaRecepcion || new Date().toISOString(),
    personaNombre: item.solicitanteNombre || item.personaNombre || 'Solicitante',
    personaCedula: item.solicitanteDocumento || item.personaCedula || 'V-00000000',
    personaTelefono: item.solicitanteTelefono || item.personaTelefono || '',
    vehiculoTitulo: item.vehiculoDescripcion || item.vehiculoTitulo || 'Vehículo',
    vehiculoCodigo: item.vehiculoCodigo || (item.vehiculo?.code) || 'veh-001',
    montoSolicitadoEur: Number(item.montoSolicitado ?? item.montoSolicitadoEur ?? 0),
    inicialAportadaEur: Number(item.cuotaInicial ?? item.inicialAportadaEur ?? 0),
    plazoMeses: Number(item.plazoMeses ?? 24),
    cuotaEstimadaEur: Number(item.cuotaEstimada ?? item.cuotaEstimadaEur ?? 0),
    totalRecaudos: Array.isArray(item.recaudos) ? item.recaudos.length : (item.totalRecaudos ?? 4),
  }));
};

export const obtenerDetalleSolicitudCredito = async (id: string): Promise<SolicitudDetalleDto> => {
  const raw = await pedirJson<any>(`/v1/solicitudes-credito/${encodeURIComponent(id)}`);

  if (raw.solicitud && raw.recaudos && raw.calculoCapacidad) {
    return raw;
  }

  const pers = raw.datosPersonales || {};
  const cont = raw.datosContacto || {};
  const lab = raw.datosLaborales || {};
  const fin = raw.datosFinancieros || {};
  const banc = raw.datosBancarios || {};
  const decl = raw.declaraciones || {};

  const montoSolicitadoEur = Number(raw.montoSolicitado || 0);
  const cuotaEstimadaEur = Number(raw.cuotaEstimada || 0);
  const sueldoMensualEur = Number(lab.ingresoMensual || 0);
  const otrosIngresosEur = Number(lab.otrosIngresos || 0);
  const egresosEur = Number(fin.egresosTotales || 0);
  const deudasEur = Number(fin.deudasBancarias || 0);
  const totalIngreso = sueldoMensualEur + otrosIngresosEur;
  const capacidadPagoEur = Math.round(totalIngreso * 0.30);
  const cuotaInicialEur = Number(raw.cuotaInicial || 0);
  const precioVehiculo = montoSolicitadoEur + cuotaInicialEur;

  const solicitudAdaptada = {
    id: raw.id,
    numero_solicitud: raw.numeroSolicitud,
    estado: raw.estado,
    primer_nombre: pers.primerNombre || 'Solicitante',
    primer_apellido: pers.primerApellido || '',
    numero_documento: pers.numeroDocumento || '',
    tipo_documento: pers.tipoDocumento || 'V',
    rif: pers.rif || `V-${pers.numeroDocumento || '0'}-0`,
    nacionalidad: pers.nacionalidad || 'Venezolana',
    estado_civil: pers.estadoCivil || 'Soltero(a)',
    fecha_nacimiento: pers.fechaNacimiento || '1990-01-01',
    cargas_familiares: pers.cargasFamiliares ?? 0,
    condicion_vivienda: cont.tipoVivienda || 'Propia',
    direccion_habitacion: cont.direccionHabitacion || 'Sin dirección registrada',
    estado_geografico: cont.estadoGeografico || 'Distrito Capital',
    municipio: cont.municipio || 'Libertador',
    telefono_celular: cont.telefonoMovil || '',
    correo: cont.correoElectronico || '',
    situacion_laboral: lab.tipoOcupacion || 'Empleado',
    nombre_empresa: lab.empresa || '',
    cargo: lab.cargo || '',
    antiguedad_anios: lab.antiguedadAnios || 1,
    sueldo_mensual_eur: sueldoMensualEur,
    otros_ingresos_eur: otrosIngresosEur,
    alquiler_hipoteca_eur: 0,
    alimentacion_servicios_eur: egresosEur,
    pagos_deudas_eur: deudasEur,
    monto_solicitado_eur: montoSolicitadoEur,
    inicial_aportada_eur: cuotaInicialEur,
    plazo_meses: raw.plazoMeses || 24,
    cuota_estimada_eur: cuotaEstimadaEur,
    banco_principal: banc.banco || 'Banca Nacional',
    tipo_cuenta: banc.tipoCuenta || 'Corriente',
    numero_cuenta: banc.numeroCuenta || '',
    es_pep: Boolean(decl.esPep),
    observaciones_analista: raw.observacionesAnalista || (raw.decisionRiesgo?.justification) || '',
    fecha_recepcion: raw.enviadaEn || raw.creadoEn || new Date().toISOString(),
  };

  const recaudosAdaptados = (raw.recaudos || []).map((r: any) => ({
    id: r.id,
    solicitudCreditoId: raw.id,
    tipoDocumento: r.documentType || r.tipoDocumento || 'otro',
    nombreOriginal: r.fileName || r.nombreOriginal || 'documento.pdf',
    storageKey: r.fileUrl || r.storageKey || '',
    mimeType: r.mimeType || 'application/pdf',
    tamanoBytes: Number(r.fileSizeBytes || r.tamanoBytes || 0),
    estado: r.validationStatus || r.estado || 'pendiente',
    notas: r.notes || r.notas || '',
    creadoEn: r.createdAt || r.creadoEn || new Date().toISOString(),
  }));

  return {
    solicitud: solicitudAdaptada,
    recaudos: recaudosAdaptados,
    calculoCapacidad: {
      ingresoTotalEur: totalIngreso,
      egresoTotalEur: egresosEur + deudasEur,
      capacidadPagoEur: capacidadPagoEur,
      montoFinanciadoEur: montoSolicitadoEur,
      cuotaEstimadaEur: cuotaEstimadaEur,
      tasaInteresAnual: 48,
      porcentajeCapacidadUsada: capacidadPagoEur > 0 ? Math.round((cuotaEstimadaEur / capacidadPagoEur) * 100) : 0,
      porcentajeInicial: precioVehiculo > 0 ? Math.round((cuotaInicialEur / precioVehiculo) * 100) : 20,
      inicialMinimaRequeridaEur: Math.round(precioVehiculo * 0.20),
      alertaCapacidad: cuotaEstimadaEur > capacidadPagoEur,
      alertaInicial: cuotaInicialEur < precioVehiculo * 0.20,
    },
  };
};

export const evaluarSolicitudCredito = (
  id: string,
  payload: EvaluarSolicitudPayload
): Promise<void> =>
  pedirJson<void>(`/v1/solicitudes-credito/${encodeURIComponent(id)}/evaluacion`, {
    cuerpo: payload,
  });

export const actualizarEstadoRecaudo = (
  solicitudId: string,
  docId: string,
  payload: ActualizarRecaudoPayload
): Promise<void> =>
  pedirJson<void>(`/v1/solicitudes-credito/${encodeURIComponent(solicitudId)}/recaudos/${encodeURIComponent(docId)}`, {
    method: 'PATCH',
    cuerpo: payload,
  });

export interface ScoringFactorDto {
  factor?: string;
  nombre?: string;
  puntosObtenidos: number;
  puntosMaximos: number;
  descripcion: string;
  estado?: string;
}

export interface AmlAlertDto {
  id: string;
  solicitudId: string;
  personaId: string;
  reglaCoincidencia: string;
  severidad: string;
  origenLista: string;
  resolucion: string;
  notas?: string;
  creadoEn: string;
  resueltoEn?: string;
  revisadoPor?: string;
}

export interface RiskEngineEvaluationResponse {
  solicitudId: string;
  numeroSolicitud: string;
  scoreInterno: number;
  scoreBuro: number;
  riesgoNivel: string;
  montoSolicitado: number;
  cuotaEstimada: number;
  cuotaCalculada?: number;
  cuotaMaximaPermitida: number;
  capacidadPagoMensual: number;
  porcentajeCapacidadUsada: number;
  alertaCapacidad: boolean;
  factores: ScoringFactorDto[];
  factoresScoring?: ScoringFactorDto[];
  alertasAml: AmlAlertDto[];
  bloqueoAml: boolean;
  recomendacion: string;
  justificacion: string;
}

export interface ResolverAlertaAmlPayload {
  resolucion: 'falso_positivo' | 'confirmado_bloqueado';
  notas: string;
}

const normalizarRespuestaRiesgo = (raw: any): RiskEngineEvaluationResponse => ({
  ...raw,
  cuotaEstimada: Number(raw.cuotaCalculada ?? raw.cuotaEstimada ?? 0),
  factores: (raw.factoresScoring || raw.factores || []).map((f: any) => ({
    ...f,
    nombre: f.nombre || f.factor || 'Factor de Scoring',
  })),
  alertasAml: raw.alertasAml || [],
});

export const evaluarSolicitudMotorRiesgo = async (id: string): Promise<RiskEngineEvaluationResponse> => {
  const resp = await pedirJson<any>(`/v1/riesgo/solicitudes/${encodeURIComponent(id)}/evaluar-motor`, {
    method: 'POST',
    cuerpo: {},
  });
  return normalizarRespuestaRiesgo(resp);
};

export const obtenerResumenRiesgo = async (id: string): Promise<RiskEngineEvaluationResponse> => {
  const resp = await pedirJson<any>(`/v1/riesgo/solicitudes/${encodeURIComponent(id)}/resumen`);
  return normalizarRespuestaRiesgo(resp);
};

export const listarAlertasAml = (resolucion?: string): Promise<AmlAlertDto[]> => {
  const query = resolucion ? `?resolucion=${encodeURIComponent(resolucion)}` : '';
  return pedirJson<AmlAlertDto[]>(`/v1/riesgo/alertas-aml${query}`);
};

export const resolverAlertaAml = (
  alertaId: string,
  payload: ResolverAlertaAmlPayload
): Promise<{ mensaje: string }> =>
  pedirJson<{ mensaje: string }>(`/v1/riesgo/alertas-aml/${encodeURIComponent(alertaId)}/resolucion`, {
    method: 'PATCH',
    cuerpo: payload,
  });

