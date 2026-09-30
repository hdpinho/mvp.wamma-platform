package com.wamma.crm;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FinancingLinkController {

    private final FinancingLinkService financingLinkService;

    public FinancingLinkController(FinancingLinkService financingLinkService) {
        this.financingLinkService = financingLinkService;
    }

    @GetMapping("/v1/enlaces-financiamiento/{token}")
    public ResponseEntity<FinancingLinkService.LinkDetails> validateLink(@PathVariable String token) {
        return ResponseEntity.ok(financingLinkService.validate(token));
    }
}
