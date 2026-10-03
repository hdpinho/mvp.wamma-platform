/**
 * Cliente del motor de riesgo (scoring de 5 factores, screening AML y Score Buró) — módulo 006.
 *
 * FUERA DE ALCANCE DEL MVP (D-63, D-01): el backoffice no lo usa. El código se conserva para reactivarlo cuando haya
 * convenios con un buró y con proveedores de listas, y se apruebe su spec, plan y tareas. Mientras tanto el analista
 * dictamina a mano (D-17) y el servidor mantiene estos endpoints apagados con una bandera.
 */
import { pedirJson } from './cliente';

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

/**
 * Respuesta tal como la envía el servidor (`RiskDtos.RiskEngineEvaluationResponse`): la cuota
 * llega como `cuotaCalculada` y los factores como `factoresScoring`.
 */
type RespuestaRiesgoServidor = Omit<RiskEngineEvaluationResponse, 'cuotaEstimada' | 'factores' | 'alertasAml'> & {
  cuotaEstimada?: number;
  factores?: ScoringFactorDto[];
  alertasAml?: AmlAlertDto[];
};

const normalizarRespuestaRiesgo = (raw: RespuestaRiesgoServidor): RiskEngineEvaluationResponse => ({
  ...raw,
  cuotaEstimada: Number(raw.cuotaCalculada ?? raw.cuotaEstimada ?? 0),
  factores: (raw.factoresScoring || raw.factores || []).map((f) => ({
    ...f,
    nombre: f.nombre || f.factor || 'Factor de Scoring',
  })),
  alertasAml: raw.alertasAml || [],
});

export const evaluarSolicitudMotorRiesgo = async (id: string): Promise<RiskEngineEvaluationResponse> => {
  const resp = await pedirJson<RespuestaRiesgoServidor>(`/v1/riesgo/solicitudes/${encodeURIComponent(id)}/evaluar-motor`, {
    method: 'POST',
    cuerpo: {},
  });
  return normalizarRespuestaRiesgo(resp);
};

export const obtenerResumenRiesgo = async (id: string): Promise<RiskEngineEvaluationResponse> => {
  const resp = await pedirJson<RespuestaRiesgoServidor>(`/v1/riesgo/solicitudes/${encodeURIComponent(id)}/resumen`);
  return normalizarRespuestaRiesgo(resp);
};

export const listarAlertasAml = (resolucion?: string): Promise<AmlAlertDto[]> => {
  const query = resolucion ? `?resolucion=${encodeURIComponent(resolucion)}` : '';
  return pedirJson<AmlAlertDto[]>(`/v1/riesgo/alertas-aml${query}`);
};

export const resolverAlertaAml = (
  alertaId: string,
  payload: ResolverAlertaAmlPayload,
): Promise<{ mensaje: string }> =>
  pedirJson<{ mensaje: string }>(`/v1/riesgo/alertas-aml/${encodeURIComponent(alertaId)}/resolucion`, {
    method: 'PATCH',
    cuerpo: payload,
  });
