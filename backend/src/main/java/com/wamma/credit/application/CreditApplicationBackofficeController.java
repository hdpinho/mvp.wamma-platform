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

/**
 * Bandeja de crédito del backoffice (D-17).
 * <p>
 * El expediente financiero solo lo ven los roles de crédito: el analista ({@code credito.revisar})
 * y el auditor ({@code credito.ver}, solo lectura). La capa comercial no lo ve (spec 010 §8.3) y
 * el dictamen es del analista: quien administra usuarios no aprueba créditos (Principio I).
 */
@RestController
public class CreditApplicationBackofficeController {

    private final CreditApplicationService creditApplicationService;

    public CreditApplicationBackofficeController(CreditApplicationService creditApplicationService) {
        this.creditApplicationService = creditApplicationService;
    }

    @GetMapping("/v1/solicitudes-credito")
    @PreAuthorize("hasAnyAuthority('credito.revisar', 'credito.ver')")
    public ResponseEntity<List<CreditApplicationDtos.CreditApplicationSummaryDto>> listApplications(
            @RequestParam(required = false) String estado,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "50") int tamano) {
        return ResponseEntity.ok(creditApplicationService.listApplications(estado, pagina, tamano));
    }

    @GetMapping("/v1/solicitudes-credito/{id}")
    @PreAuthorize("hasAnyAuthority('credito.revisar', 'credito.ver')")
    public ResponseEntity<CreditApplicationDtos.CreditApplicationDetailDto> getApplication(@PathVariable UUID id) {
        return ResponseEntity.ok(creditApplicationService.getApplication(id));
    }

    @PostMapping("/v1/solicitudes-credito/{id}/evaluacion")
    @PreAuthorize("hasAuthority('credito.revisar')")
    public ResponseEntity<Map<String, String>> evaluateApplication(
            @PathVariable UUID id,
            @RequestBody CreditApplicationDtos.EvaluateCreditApplicationRequest request) {
        UUID userId = CurrentUser.id().orElse(null);
        creditApplicationService.evaluateApplication(id, request, userId);
        return ResponseEntity.ok(Map.of("mensaje", "Evaluación registrada exitosamente"));
    }

    /** Enlace firmado de corta duración para abrir un recaudo del contenedor privado (D-59). */
    @GetMapping("/v1/solicitudes-credito/{id}/recaudos/{docId}/enlace")
    @PreAuthorize("hasAnyAuthority('credito.revisar', 'credito.ver')")
    public ResponseEntity<CreditApplicationDtos.DocumentLinkDto> documentLink(
            @PathVariable UUID id,
            @PathVariable UUID docId) {
        return ResponseEntity.ok(creditApplicationService.issueDocumentLink(id, docId));
    }

    @PatchMapping("/v1/solicitudes-credito/{id}/recaudos/{docId}")
    @PreAuthorize("hasAuthority('credito.revisar')")
    public ResponseEntity<Map<String, String>> validateDocument(
            @PathVariable UUID id,
            @PathVariable UUID docId,
            @RequestBody Map<String, String> body) {
        // Sin estado no se asume «conforme»: un recaudo no se aprueba por omisión.
        String status = body.get("estado");
        String notes = body.get("observaciones");
        creditApplicationService.validateDocument(id, docId, status, notes);
        return ResponseEntity.ok(Map.of("mensaje", "Recaudo validado exitosamente"));
    }
}
