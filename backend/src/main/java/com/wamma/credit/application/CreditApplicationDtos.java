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

    /**
     * Lo que el enlace ya sabe de la persona, para no volver a pedírselo. El nombre va completo: partirlo en nombre
     * y apellido por espacios acierta solo con dos palabras, y el formulario deja que la persona lo ordene.
     */
    public record ApplicantPrefillDto(
            UUID personId,
            String fullName,
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

    /**
     * Recaudo cargado por el cliente. {@code fileKey} es la clave que devolvió la carga en el
     * contenedor privado; el envío solo admite claves de la propia oportunidad.
     */
    public record DocumentSubmissionDto(
            String documentType,
            String fileKey,
            String fileName,
            Long fileSizeBytes,
            String mimeType
    ) {
    }

    /**
     * Solicitud que el cliente envía con su enlace personal. El vehículo no viaja aquí: lo fija la oportunidad del
     * enlace. Sin OTP (D-57): la aceptación queda registrada con fecha, IP, agente y la versión del texto que el
     * cliente aceptó.
     */
    public record SubmitCreditApplicationRequest(
            String token,
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
            String versionTexto
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
            String vehiculoCodigo,
            String vehiculoDescripcion,
            int totalRecaudos,
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

    /** Sin dirección ni clave: el archivo se abre pidiendo un enlace firmado (D-59). */
    public record DocumentDetailDto(
            UUID id,
            String documentType,
            String fileName,
            Long fileSizeBytes,
            String mimeType,
            String validationStatus,
            String notes,
            Instant createdAt
    ) {
    }

    /** Enlace firmado para abrir un recaudo: ruta relativa a la API y hora de vencimiento. */
    public record DocumentLinkDto(
            String ruta,
            Instant venceEn
    ) {
    }

    public record RiskDecisionDto(
            UUID id,
            Integer internalScore,
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

    /**
     * Dictamen manual del analista (D-17, D-63). Sin puntajes: el scoring está fuera de alcance y un dictamen no se
     * completa con valores por omisión. La justificación es obligatoria y queda con el usuario del analista.
     *
     * @param resultado            {@code aprobado}, {@code condicionado} o {@code rechazado}
     * @param justificacion        sustento de la decisión (al menos {@link #MIN_JUSTIFICATION} caracteres)
     * @param limiteAprobado       solo al aprobar: lo que se aprueba, sin pasar de lo solicitado
     * @param cuotaMaximaPermitida solo al aprobar
     */
    public record EvaluateCreditApplicationRequest(
            String resultado,
            String justificacion,
            BigDecimal limiteAprobado,
            BigDecimal cuotaMaximaPermitida
    ) {
        public static final int MIN_JUSTIFICATION = 10;

        public String normalizedOutcome() {
            return resultado == null ? "" : resultado.trim().toLowerCase();
        }

        public String trimmedJustification() {
            return justificacion == null ? "" : justificacion.trim();
        }
    }
}
