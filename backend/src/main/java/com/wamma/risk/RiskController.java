package com.wamma.risk;

import com.wamma.platform.auth.CurrentUser;
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

@RestController
@RequestMapping("/v1/riesgo")
public class RiskController {

    private final RiskEvaluationService riskEvaluationService;

    public RiskController(RiskEvaluationService riskEvaluationService) {
        this.riskEvaluationService = riskEvaluationService;
    }

    @PostMapping("/solicitudes/{id}/evaluar-motor")
    @PreAuthorize("hasAnyAuthority('credito.revisar', 'credito.ver', 'usuarios.gestionar')")
    public ResponseEntity<RiskDtos.RiskEngineEvaluationResponse> evaluateApplicationEngine(@PathVariable UUID id) {
        return ResponseEntity.ok(riskEvaluationService.evaluateApplication(id));
    }

    @GetMapping("/solicitudes/{id}/resumen")
    @PreAuthorize("hasAnyAuthority('credito.revisar', 'credito.ver', 'usuarios.gestionar')")
    public ResponseEntity<RiskDtos.RiskEngineEvaluationResponse> getApplicationRiskSummary(@PathVariable UUID id) {
        return ResponseEntity.ok(riskEvaluationService.getApplicationRiskSummary(id));
    }

    @GetMapping("/alertas-aml")
    @PreAuthorize("hasAnyAuthority('credito.revisar', 'credito.ver', 'usuarios.gestionar', 'auditoria.ver')")
    public ResponseEntity<List<RiskDtos.AmlAlertDto>> listAmlAlerts(
            @RequestParam(required = false) String resolucion) {
        return ResponseEntity.ok(riskEvaluationService.listAmlAlerts(resolucion));
    }

    @PatchMapping("/alertas-aml/{id}/resolucion")
    @PreAuthorize("hasAnyAuthority('credito.revisar', 'usuarios.gestionar')")
    public ResponseEntity<Map<String, String>> resolveAmlAlert(
            @PathVariable UUID id,
            @RequestBody RiskDtos.ResolveAmlAlertRequest request) {
        UUID userId = CurrentUser.id().orElse(null);
        riskEvaluationService.resolveAmlAlert(id, request.resolucion(), request.notas(), userId);
        return ResponseEntity.ok(Map.of("mensaje", "Alerta AML actualizada exitosamente"));
    }
}
