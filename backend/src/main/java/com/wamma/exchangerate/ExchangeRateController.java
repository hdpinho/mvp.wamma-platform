package com.wamma.exchangerate;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Tasa BCV del euro (plan 005 §6): consulta pública de la vigente, registro e historial. */
@RestController
public class ExchangeRateController {

    private final ExchangeRateService service;

    public ExchangeRateController(ExchangeRateService service) {
        this.service = service;
    }

    public record RateView(LocalDate fecha, String moneda, BigDecimal tasa, String fuente, Instant registradaEn,
                           String registradaPor, Instant corregidaEn, String corregidaPor) {

        static RateView of(BcvRate rate) {
            return new RateView(rate.date(), rate.currency().name(), rate.vesPerUnit(), rate.source(), rate.recordedAt(),
                    rate.recordedBy(), rate.correctedAt(), rate.correctedBy());
        }
    }

    /** {@code tasa} es nula mientras no se haya registrado ninguna. */
    public record CurrentRateResponse(PublicRate tasa) {
    }

    public record RegisterRequest(
            @NotNull(message = "Indica la fecha") LocalDate fecha,
            @NotNull(message = "Indica la tasa")
            @DecimalMin(value = "0", inclusive = false, message = "La tasa debe ser mayor que cero") BigDecimal tasa,
            @NotBlank(message = "Indica la fuente") @Size(max = 50, message = "La fuente tiene a lo sumo 50 caracteres") String fuente) {
    }

    public record RegisterResponse(RateView tasa, boolean corregida) {
    }

    @GetMapping("/v1/tasa-bcv/vigente")
    public ResponseEntity<CurrentRateResponse> current() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic())
                .body(new CurrentRateResponse(service.currentEuroRate().map(PublicRate::of).orElse(null)));
    }

    @GetMapping("/v1/tasas-bcv")
    @PreAuthorize("hasAuthority('tasa_bcv.registrar')")
    public List<RateView> history(@RequestParam(defaultValue = "60") int limite) {
        return service.history(limite).stream().map(RateView::of).toList();
    }

    @PostMapping("/v1/tasas-bcv")
    @PreAuthorize("hasAuthority('tasa_bcv.registrar')")
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        ExchangeRateService.Registration registration =
                service.register(request.fecha(), request.tasa(), request.fuente());
        return new RegisterResponse(RateView.of(registration.rate()), registration.corrected());
    }
}
