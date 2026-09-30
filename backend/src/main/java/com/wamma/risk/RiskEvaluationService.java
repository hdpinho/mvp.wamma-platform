package com.wamma.risk;

import com.wamma.credit.application.CreditApplicationRecord;
import com.wamma.credit.application.CreditApplicationRepository;
import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RiskEvaluationService {

    private final CreditApplicationRepository creditApplications;
    private final AmlAlertRepository amlAlerts;
    private final CreditScoringEngine scoringEngine;
    private final AmlScreeningEngine amlScreeningEngine;
    private final AuditLog audit;
    private final Clock clock;
    private final ObjectMapper json;

    public RiskEvaluationService(
            CreditApplicationRepository creditApplications,
            AmlAlertRepository amlAlerts,
            CreditScoringEngine scoringEngine,
            AmlScreeningEngine amlScreeningEngine,
            AuditLog audit,
            Clock clock,
            ObjectMapper json
    ) {
        this.creditApplications = creditApplications;
        this.amlAlerts = amlAlerts;
        this.scoringEngine = scoringEngine;
        this.amlScreeningEngine = amlScreeningEngine;
        this.audit = audit;
        this.clock = clock;
        this.json = json;
    }

    @Transactional
    public RiskDtos.RiskEngineEvaluationResponse evaluateApplication(UUID applicationId) {
        CreditApplicationRecord app = creditApplications.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada", "No existe la solicitud " + applicationId));

        Map<String, Object> personal = parseJson(app.personalDataJson());
        Map<String, Object> contact = parseJson(app.contactDataJson());
        Map<String, Object> employment = parseJson(app.employmentDataJson());
        Map<String, Object> financial = parseJson(app.financialDataJson());
        List<Map<String, Object>> references = parseListJson(app.referencesJson());
        Map<String, Object> banking = parseJson(app.bankingDataJson());
        Map<String, Object> declarations = parseJson(app.declarationsJson());

        String fullName = (personal.get("primerNombre") != null ? personal.get("primerNombre") + " " : "")
                + (personal.get("primerApellido") != null ? personal.get("primerApellido") : "");
        String nationalId = personal.get("numeroDocumento") != null ? String.valueOf(personal.get("numeroDocumento")) : "";

        // 1. Ejecutar Screening AML
        amlAlerts.deletePendingByApplicationId(applicationId);
        List<AmlAlertRecord> detectedAlerts = amlScreeningEngine.screenApplicant(
                applicationId,
                app.personId(),
                fullName,
                nationalId,
                personal,
                employment,
                declarations
        );

        for (AmlAlertRecord alert : detectedAlerts) {
            amlAlerts.insert(alert);
        }

        // Obtener todas las alertas AML registradas para esta solicitud
        List<AmlAlertRecord> allAppAlerts = amlAlerts.findByApplicationId(applicationId);
        boolean hasBlockingAlert = allAppAlerts.stream()
                .anyMatch(a -> "bloqueante".equalsIgnoreCase(a.severity()) && "pendiente".equalsIgnoreCase(a.resolution()));

        // 2. Ejecutar Motor de Scoring
        CreditScoringEngine.EngineResult scoringResult = scoringEngine.evaluate(
                app.requestedAmount(),
                app.downPayment(),
                app.estimatedPayment(),
                app.monthlyCapacity(),
                personal,
                contact,
                employment,
                financial,
                references,
                banking
        );

        // 3. Recomendación Automatizada de Riesgo
        String recomendacion;
        String justificacion;

        if (hasBlockingAlert) {
            recomendacion = "RECHAZAR";
            justificacion = "Coincidencia crítica detectada en Lista OFAC / Sanciones Internacionales. La normativa UNIF prohíbe la aprobación sin descargo de cumplimiento.";
        } else if (scoringResult.scoreInterno() < 450 || "no_asegurable".equals(scoringResult.riesgoNivel())) {
            recomendacion = "RECHAZAR";
            justificacion = "Puntuación de crédito insuficiente (" + scoringResult.scoreInterno() + " pts) o capacidad de pago neta negativa.";
        } else if (scoringResult.alertaCapacidad() || "alto".equals(scoringResult.riesgoNivel())) {
            recomendacion = "CONDICIONAR";
            justificacion = "Capacidad ajustada: la cuota mensual calculada (" + app.estimatedPayment() + " " + app.currency()
                    + ") supera la cuota máxima prudencial recomendada de " + scoringResult.cuotaMaximaPermitida() + " " + app.currency()
                    + " (regla del 30%). Se sugiere elevar la cuota inicial o extender el plazo.";
        } else {
            recomendacion = "APROBAR";
            justificacion = "Capacidad de pago demostrada conforme a la regla del 30% (" + scoringResult.porcentajeCapacidadUsada()
                    + "% comprometido). Score crediticio favorable (" + scoringResult.scoreInterno() + " pts) y screening AML limpio.";
        }

        // 4. Actualizar o Registrar Pre-dictamen en decision_riesgo
        Instant now = clock.instant();
        String resultadoDb = switch (recomendacion.toUpperCase()) {
            case "APROBAR" -> "aprobado";
            case "CONDICIONAR" -> "condicionado";
            default -> "rechazado";
        };

        CreditApplicationRepository.RiskDecisionRecord decisionRecord = new CreditApplicationRepository.RiskDecisionRecord(
                UUID.randomUUID(),
                applicationId,
                scoringResult.scoreInterno(),
                scoringResult.scoreBuro(),
                scoringResult.riesgoNivel(),
                resultadoDb,
                scoringResult.alertaCapacidad() ? app.requestedAmount().multiply(new BigDecimal("0.85")) : app.requestedAmount(),
                scoringResult.cuotaMaximaPermitida(),
                justificacion,
                null,
                now,
                app.currency() != null ? app.currency() : "EUR",
                app.bcvRate() != null ? app.bcvRate() : new BigDecimal("54.25000000"),
                app.bcvRateDate() != null ? app.bcvRateDate() : LocalDate.now()
        );
        creditApplications.insertRiskDecision(decisionRecord);

        // 5. Auditoría
        audit.record("riesgo.evaluacion_motor", "solicitud_credito", applicationId, Map.of(
                "score_interno", scoringResult.scoreInterno(),
                "riesgo_nivel", scoringResult.riesgoNivel(),
                "recomendacion", recomendacion,
                "bloqueo_aml", hasBlockingAlert
        ));

        // Mapear alertas DTO
        List<RiskDtos.AmlAlertDto> alertDtos = allAppAlerts.stream()
                .map(this::toAlertDto)
                .toList();

        return new RiskDtos.RiskEngineEvaluationResponse(
                applicationId,
                app.applicationNumber(),
                scoringResult.scoreInterno(),
                scoringResult.scoreBuro(),
                scoringResult.riesgoNivel(),
                app.requestedAmount(),
                app.estimatedPayment(),
                scoringResult.cuotaMaximaPermitida(),
                app.monthlyCapacity(),
                scoringResult.porcentajeCapacidadUsada(),
                scoringResult.alertaCapacidad(),
                scoringResult.factores(),
                alertDtos,
                hasBlockingAlert,
                recomendacion,
                justificacion
        );
    }

    @Transactional
    public RiskDtos.RiskEngineEvaluationResponse getApplicationRiskSummary(UUID applicationId) {
        return evaluateApplication(applicationId);
    }

    @Transactional(readOnly = true)
    public List<RiskDtos.AmlAlertDto> listAmlAlerts(String resolucion) {
        return amlAlerts.listAll(resolucion).stream()
                .map(this::toAlertDto)
                .toList();
    }

    @Transactional
    public void resolveAmlAlert(UUID alertId, String resolucion, String notas, UUID userId) {
        if (!"falso_positivo".equalsIgnoreCase(resolucion) && !"confirmado_bloqueado".equalsIgnoreCase(resolucion)) {
            throw ApiException.badRequest("Resolución inválida", "La resolución debe ser 'falso_positivo' o 'confirmado_bloqueado'.");
        }

        AmlAlertRecord alert = amlAlerts.findById(alertId)
                .orElseThrow(() -> ApiException.notFound("Alerta no encontrada", "No existe alerta AML con ID " + alertId));

        Instant now = clock.instant();
        amlAlerts.resolve(alertId, resolucion.toLowerCase(), notas, userId, now);

        audit.record("aml.alerta_resuelta", "alerta_aml", alertId, Map.of(
                "resolucion", resolucion,
                "solicitud_id", alert.applicationId().toString(),
                "persona_id", alert.personId().toString()
        ));
    }

    private RiskDtos.AmlAlertDto toAlertDto(AmlAlertRecord r) {
        return new RiskDtos.AmlAlertDto(
                r.id(),
                r.applicationId(),
                r.personId(),
                r.matchRule(),
                r.severity(),
                r.listOrigin(),
                r.resolution(),
                r.notes(),
                r.createdAt(),
                r.resolvedAt(),
                r.reviewedBy()
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseJson(String jsonStr) {
        if (jsonStr == null || jsonStr.isBlank()) return Collections.emptyMap();
        try {
            return (Map<String, Object>) json.readValue(jsonStr, Map.class);
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseListJson(String jsonStr) {
        if (jsonStr == null || jsonStr.isBlank()) return Collections.emptyList();
        try {
            return (List<Map<String, Object>>) json.readValue(jsonStr, List.class);
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
