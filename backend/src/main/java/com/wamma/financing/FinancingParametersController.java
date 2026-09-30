package com.wamma.financing;

import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
public class FinancingParametersController {

    private final FinancingParametersService service;

    public FinancingParametersController(FinancingParametersService service) {
        this.service = service;
    }

    @GetMapping({"/v1/parametros-financiamiento", "/v1/financiamiento/parametros"})
    public ResponseEntity<FinancingParametersResponse> getActiveParameters() {
        FinancingParameters params = service.getActiveParameters();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(30)).cachePublic())
                .body(FinancingParametersResponse.of(params));
    }

    @PutMapping({"/v1/financiamiento/parametros", "/v1/parametros-financiamiento"})
    @PreAuthorize("hasAuthority('parametros.gestionar') or hasAuthority('cotizador.usar')")
    public ResponseEntity<FinancingParametersResponse> updateParameters(
            @Valid @RequestBody UpdateFinancingParametersRequest request) {
        FinancingParameters updated = service.updateParameters(request);
        return ResponseEntity.ok(FinancingParametersResponse.of(updated));
    }
}
