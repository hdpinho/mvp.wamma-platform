package com.wamma.risk;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class RiskDtos {

    private RiskDtos() {
    }

    public record ScoringFactorDto(
            String factor,
            int puntosObtenidos,
            int puntosMaximos,
            String descripcion,
            String estado // 'optimo', 'aceptable', 'atencion', 'critico'
    ) {
    }

    public record AmlAlertDto(
            UUID id,
            UUID solicitudId,
            UUID personaId,
            String reglaCoincidencia,
            String severidad, // 'informativa', 'media', 'bloqueante'
            String origenLista, // 'OFAC', 'PEP_NACIONAL', 'INTERPOL', 'INTERNO'
            String resolucion, // 'pendiente', 'falso_positivo', 'confirmado_bloqueado'
            String notas,
            Instant creadoEn,
            Instant resueltoEn,
            UUID revisadoPor
    ) {
    }

    public record RiskEngineEvaluationResponse(
            UUID solicitudId,
            String numeroSolicitud,
            int scoreInterno,
            int scoreBuro,
            String riesgoNivel, // 'bajo', 'medio', 'alto', 'no_asegurable'
            BigDecimal montoSolicitado,
            BigDecimal cuotaCalculada,
            BigDecimal cuotaMaximaPermitida,
            BigDecimal capacidadPagoMensual,
            BigDecimal porcentajeCapacidadUsada,
            boolean alertaCapacidad,
            List<ScoringFactorDto> factoresScoring,
            List<AmlAlertDto> alertasAml,
            boolean bloqueoAml,
            String recomendacion, // 'APROBAR', 'CONDICIONAR', 'RECHAZAR'
            String justificacion
    ) {
    }

    public record ResolveAmlAlertRequest(
            String resolucion, // 'falso_positivo', 'confirmado_bloqueado'
            String notas
    ) {
    }
}
