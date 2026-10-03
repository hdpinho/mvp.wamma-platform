package com.wamma.risk;

import com.wamma.platform.auth.CurrentUser;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Motor de scoring, «AML» y Score Buró — **fuera de alcance** (D-01, D-63). El código se conserva, pero estos endpoints
 * existen solo si se enciende {@code wamma.riesgo.motor-habilitado} (variable {@code WAMMA_RIESGO_MOTOR}); apagados
 * responden 404. Reactivarlo exige spec, plan y tareas aprobados y resolver P5, D4 y D5 del spec 006: sus pesos,
 * umbrales y listas no están confirmados y no deben presentarse como un análisis real.
 */
@RestController
@RequestMapping("/v1/riesgo")
@ConditionalOnProperty(prefix = "wamma.riesgo", name = "motor-habilitado", havingValue = "true")
public class RiskController {

    private final RiskEvaluationService riskEvaluationService;

    public RiskController(RiskEvaluationService riskEvaluationService) {
        this.riskEvaluationService = riskEvaluationService;
    }

    // Ejecutar el motor escribe en decision_riesgo y alerta_aml: solo el analista (Principio I).
    @PostMapping("/solicitudes/{id}/evaluar-motor")
    @PreAuthorize("hasAuthority('credito.revisar')")
    public ResponseEntity<RiskDtos.RiskEngineEvaluationResponse> evaluateApplicationEngine(@PathVariable UUID id) {
        return ResponseEntity.ok(riskEvaluationService.evaluateApplication(id));
    }

    // Consulta: calcula sin escribir. Sigue siendo del analista porque revela el análisis del motor.
    @GetMapping("/solicitudes/{id}/resumen")
    @PreAuthorize("hasAuthority('credito.revisar')")
    public ResponseEntity<RiskDtos.RiskEngineEvaluationResponse> getApplicationRiskSummary(@PathVariable UUID id) {
        return ResponseEntity.ok(riskEvaluationService.getApplicationRiskSummary(id));
    }

    @GetMapping("/alertas-aml")
    @PreAuthorize("hasAnyAuthority('credito.revisar', 'credito.ver')")
    public ResponseEntity<List<RiskDtos.AmlAlertDto>> listAmlAlerts(
            @RequestParam(required = false) String resolucion) {
        return ResponseEntity.ok(riskEvaluationService.listAmlAlerts(resolucion));
    }

    @PatchMapping("/alertas-aml/{id}/resolucion")
    @PreAuthorize("hasAuthority('credito.revisar')")
    public ResponseEntity<Map<String, String>> resolveAmlAlert(
            @PathVariable UUID id,
            @RequestBody RiskDtos.ResolveAmlAlertRequest request) {
        UUID userId = CurrentUser.id().orElse(null);
        riskEvaluationService.resolveAmlAlert(id, request.resolucion(), request.notas(), userId);
        return ResponseEntity.ok(Map.of("mensaje", "Alerta AML actualizada exitosamente"));
    }
}
