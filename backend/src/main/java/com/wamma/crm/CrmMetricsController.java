package com.wamma.crm;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

@RestController
public class CrmMetricsController {

    private final FunnelService funnelService;

    public CrmMetricsController(FunnelService funnelService) {
        this.funnelService = funnelService;
    }

    @GetMapping("/v1/crm/catalogos")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<FunnelService.CatalogsResponse> getCatalogs() {
        return ResponseEntity.ok(funnelService.getCatalogs());
    }

    @GetMapping("/v1/crm/metricas/embudo")
    @PreAuthorize("hasAuthority('crm.ver_todas')")
    public ResponseEntity<FunnelService.MetricsResponse> getFunnelMetrics(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        Instant from = desde != null ? desde.atStartOfDay().toInstant(ZoneOffset.UTC) : null;
        Instant to = hasta != null ? hasta.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC) : null;

        return ResponseEntity.ok(funnelService.getMetrics(from, to));
    }
}
