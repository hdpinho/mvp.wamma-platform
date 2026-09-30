package com.wamma.credit.application;

import com.wamma.platform.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class CreditApplicationBackofficeController {

    private final CreditApplicationService creditApplicationService;

    public CreditApplicationBackofficeController(CreditApplicationService creditApplicationService) {
        this.creditApplicationService = creditApplicationService;
    }

    @GetMapping("/v1/solicitudes-credito")
    @PreAuthorize("hasAnyAuthority('credito.evaluar', 'crm.ver_todas', 'crm.ver_propias', 'inventario.ver')")
    public ResponseEntity<List<CreditApplicationDtos.CreditApplicationSummaryDto>> listApplications(
            @RequestParam(required = false) String estado,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "50") int tamano) {
        return ResponseEntity.ok(creditApplicationService.listApplications(estado, pagina, tamano));
    }

    @GetMapping("/v1/solicitudes-credito/{id}")
    @PreAuthorize("hasAnyAuthority('credito.evaluar', 'crm.ver_todas', 'crm.ver_propias', 'inventario.ver')")
    public ResponseEntity<CreditApplicationDtos.CreditApplicationDetailDto> getApplication(@PathVariable UUID id) {
        return ResponseEntity.ok(creditApplicationService.getApplication(id));
    }

    @PostMapping("/v1/solicitudes-credito/{id}/evaluacion")
    @PreAuthorize("hasAnyAuthority('credito.evaluar', 'usuarios.gestionar')")
    public ResponseEntity<Map<String, String>> evaluateApplication(
            @PathVariable UUID id,
            @RequestBody CreditApplicationDtos.EvaluateCreditApplicationRequest request) {
        UUID userId = CurrentUser.id().orElse(null);
        creditApplicationService.evaluateApplication(id, request, userId);
        return ResponseEntity.ok(Map.of("mensaje", "Evaluación registrada exitosamente"));
    }

    @PatchMapping("/v1/solicitudes-credito/{id}/recaudos/{docId}")
    @PreAuthorize("hasAnyAuthority('credito.evaluar', 'usuarios.gestionar')")
    public ResponseEntity<Map<String, String>> validateDocument(
            @PathVariable UUID id,
            @PathVariable UUID docId,
            @RequestBody Map<String, String> body) {
        String status = body.getOrDefault("estado", "conforme");
        String notes = body.get("observaciones");
        creditApplicationService.validateDocument(id, docId, status, notes);
        return ResponseEntity.ok(Map.of("mensaje", "Recaudo validado exitosamente"));
    }
}
