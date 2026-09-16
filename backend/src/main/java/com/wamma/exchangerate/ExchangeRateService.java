package com.wamma.exchangerate;

import com.wamma.platform.audit.AuditDetail;
import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.money.CurrencyCode;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Tasa BCV del euro (D-13, D-21, plan 005 E2). Se registra a mano cada día desde el
 * backoffice; automatizarla queda para después.
 */
@Service
public class ExchangeRateService {

    /** Los días se cuentan en la hora de Venezuela. */
    public static final ZoneId VENEZUELA = ZoneId.of("America/Caracas");
    private static final CurrencyCode SHOWCASE_CURRENCY = CurrencyCode.EUR;

    public record Registration(BcvRate rate, boolean corrected) {
    }

    private final ExchangeRateRepository rates;
    private final AuditLog audit;
    private final Clock clock;

    public ExchangeRateService(ExchangeRateRepository rates, AuditLog audit, Clock clock) {
        this.rates = rates;
        this.audit = audit;
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock.withZone(VENEZUELA));
    }

    /** La tasa del euro vigente: la de fecha más reciente hasta hoy. */
    @Transactional(readOnly = true)
    public Optional<BcvRate> currentEuroRate() {
        return rates.latest(SHOWCASE_CURRENCY, today());
    }

    @Transactional(readOnly = true)
    public List<BcvRate> history(int limit) {
        return rates.history(SHOWCASE_CURRENCY, Math.clamp(limit, 1, 365));
    }

    /** Registra la tasa de un día o corrige la que ya tenía; ambas cosas quedan en la bitácora. */
    @Transactional
    public Registration register(LocalDate date, BigDecimal rate, String source) {
        if (date.isAfter(today())) {
            throw ApiException.badRequest("Fecha no válida", "No se puede registrar la tasa de un día que no ha llegado.");
        }
        if (rate.signum() <= 0) {
            throw ApiException.badRequest("Tasa no válida", "La tasa debe ser mayor que cero.");
        }
        BigDecimal normalized = rate.stripTrailingZeros();
        if (normalized.scale() > 8) {
            throw ApiException.badRequest("Tasa no válida", "La tasa admite hasta 8 decimales.");
        }
        if (normalized.precision() - normalized.scale() > 10) {
            throw ApiException.badRequest("Tasa no válida", "La tasa es demasiado grande.");
        }
        String cleanSource = source.trim();
        UUID user = CurrentUser.id().orElseThrow(() -> new IllegalStateException("Registro de tasa sin usuario"));

        Optional<BcvRate> existing = rates.find(date, SHOWCASE_CURRENCY);
        if (existing.isEmpty()) {
            UUID id = rates.insert(date, SHOWCASE_CURRENCY, normalized, cleanSource, user, clock.instant());
            audit.record("tasa_bcv.registrada", "tasa_bcv", id, null,
                    AuditDetail.of("fecha", date.toString(), "moneda", SHOWCASE_CURRENCY.name(),
                            "tasa", normalized.toPlainString(), "fuente", cleanSource));
            return new Registration(rates.find(date, SHOWCASE_CURRENCY).orElseThrow(), false);
        }
        BcvRate previous = existing.get();
        if (previous.vesPerUnit().compareTo(normalized) == 0 && previous.source().equals(cleanSource)) {
            return new Registration(previous, false);
        }
        rates.correct(previous.id(), normalized, cleanSource, user, clock.instant());
        audit.record("tasa_bcv.corregida", "tasa_bcv", previous.id(),
                AuditDetail.of("fecha", date.toString(), "tasa", previous.vesPerUnit().toPlainString(), "fuente", previous.source()),
                AuditDetail.of("fecha", date.toString(), "tasa", normalized.toPlainString(), "fuente", cleanSource));
        return new Registration(rates.find(date, SHOWCASE_CURRENCY).orElseThrow(), true);
    }
}
