package com.wamma.credit.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class CreditApplicationDtos {

    private CreditApplicationDtos() {
    }

    public record ApplicantPrefillDto(
            UUID personId,
            String firstName,
            String lastName,
            String nationalId,
            String phone,
            String email
    ) {
    }

    public record VehicleDetailDto(
            UUID id,
            String code,
            String brand,
            String model,
            int year,
            String version,
            BigDecimal priceEur,
            BigDecimal priceVes,
            String photoUrl
    ) {
    }

    public record FinancingParamsSummaryDto(
            BigDecimal defaultAnnualRate,
            BigDecimal defaultMonthlyRate,
            BigDecimal minDownPaymentPercentage,
            int defaultTermMonths,
            BigDecimal paymentCapacityPercentage
    ) {
    }

    public record CreditLinkDetailsDto(
            boolean valid,
            String invalidReason,
            UUID opportunityId,
            VehicleDetailDto vehicle,
            ApplicantPrefillDto applicant,
            FinancingParamsSummaryDto financingParams,
            BigDecimal bcvRate,
            LocalDate bcvDate
    ) {
    }

    public record DocumentSubmissionDto(
            String documentType,
            String fileUrl,
            String fileName,
            Long fileSizeBytes,
            String mimeType
    ) {
    }

    public record SubmitCreditApplicationRequest(
            String token,
            UUID vehiculoId,
            BigDecimal montoSolicitado,
            BigDecimal cuotaInicial,
            int plazoMeses,
            String frecuenciaPago,
            BigDecimal cuotaEstimada,
            BigDecimal capacidadPagoMensual,
            Map<String, Object> datosPersonales,
            Map<String, Object> datosContacto,
            Map<String, Object> datosLaborales,
            Map<String, Object> datosFinancieros,
            List<Map<String, Object>> referencias,
            Map<String, Object> datosBancarios,
            Map<String, Object> declaraciones,
            List<DocumentSubmissionDto> recaudos,
            String codigoOtp,
            boolean otpVerificado
    ) {
    }

    public record SubmitCreditApplicationResponse(
            UUID id,
            String numeroSolicitud,
            String estado,
            Instant enviadaEn,
            String mensaje
    ) {
    }

    public record CreditApplicationSummaryDto(
            UUID id,
            String numeroSolicitud,
            String estado,
            UUID vehiculoId,
            String vehiculoDescripcion,
            BigDecimal montoSolicitado,
            BigDecimal cuotaInicial,
            int plazoMeses,
            BigDecimal cuotaEstimada,
            String solicitanteNombre,
            String solicitanteDocumento,
            String solicitanteTelefono,
            String solicitanteCorreo,
            Instant creadoEn
    ) {
    }

    public record DocumentDetailDto(
            UUID id,
            String documentType,
            String fileUrl,
            String fileName,
            Long fileSizeBytes,
            String mimeType,
            String validationStatus,
            String notes,
            Instant createdAt
    ) {
    }

    public record RiskDecisionDto(
            UUID id,
            int internalScore,
            Integer bureauScore,
            String riskLevel,
            String result,
            BigDecimal approvedLimit,
            BigDecimal maxAllowedPayment,
            String justification,
            UUID evaluatedBy,
            Instant evaluatedAt
    ) {
    }

    public record CreditApplicationDetailDto(
            UUID id,
            String numeroSolicitud,
            String estado,
            UUID oportunidadId,
            UUID personaId,
            UUID vehiculoId,
            VehicleDetailDto vehiculo,
            BigDecimal montoSolicitado,
            BigDecimal cuotaInicial,
            int plazoMeses,
            String moneda,
            BigDecimal tasaBcv,
            LocalDate fechaTasa,
            BigDecimal cuotaEstimada,
            BigDecimal capacidadPagoMensual,
            String frecuenciaPago,
            Map<String, Object> datosPersonales,
            Map<String, Object> datosContacto,
            Map<String, Object> datosLaborales,
            Map<String, Object> datosFinancieros,
            List<Map<String, Object>> referencias,
            Map<String, Object> datosBancarios,
            Map<String, Object> declaraciones,
            Map<String, Object> evidenciaAceptacion,
            List<DocumentDetailDto> recaudos,
            RiskDecisionDto decisionRiesgo,
            Instant enviadaEn,
            Instant creadoEn,
            Instant actualizadoEn
    ) {
    }

    public record EvaluateCreditApplicationRequest(
            String resultado, // 'aprobado', 'rechazado', 'condicionado'
            String nuevoEstado,
            Integer scoreInterno,
            Integer scoreCrediticio,
            Integer scoreBuro,
            String riesgoNivel, // 'bajo', 'medio', 'alto', 'no_asegurable'
            BigDecimal limiteAprobado,
            BigDecimal cuotaMaximaPermitida,
            String justificacion,
            String observaciones
    ) {
        public String effectiveOutcome() {
            if (resultado != null && !resultado.isBlank()) return resultado.trim().toLowerCase();
            if (nuevoEstado != null && !nuevoEstado.isBlank()) return nuevoEstado.trim().toLowerCase();
            return "";
        }

        public String effectiveJustification() {
            if (justificacion != null && !justificacion.isBlank()) return justificacion.trim();
            if (observaciones != null && !observaciones.isBlank()) return observaciones.trim();
            return "Evaluación de analista de crédito";
        }

        public int effectiveScore() {
            if (scoreInterno != null && scoreInterno >= 0 && scoreInterno <= 1000) return scoreInterno;
            if (scoreCrediticio != null && scoreCrediticio >= 0 && scoreCrediticio <= 1000) return scoreCrediticio;
            return 700;
        }

        public String effectiveRiskLevel() {
            if (riesgoNivel != null && !riesgoNivel.isBlank()) {
                String r = riesgoNivel.trim().toLowerCase();
                if (r.contains("bajo")) return "bajo";
                if (r.contains("alto")) return "alto";
                if (r.contains("asegurable")) return "no_asegurable";
                return "medio";
            }
            return "medio";
        }
    }

    public record StatusLookupResponse(
            String numeroSolicitud,
            String estado,
            Instant enviadaEn,
            String vehiculoDescripcion,
            BigDecimal montoSolicitado,
            int plazoMeses,
            BigDecimal cuotaEstimada,
            String mensaje
    ) {
    }
}
