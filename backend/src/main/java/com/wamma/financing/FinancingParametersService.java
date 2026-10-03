package com.wamma.financing;

import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

@Service
public class FinancingParametersService {

    private final FinancingParametersRepository repository;
    private final AuditLog auditLog;

    public FinancingParametersService(FinancingParametersRepository repository, AuditLog auditLog) {
        this.repository = repository;
        this.auditLog = auditLog;
    }

    @Transactional(readOnly = true)
    public FinancingParameters getActiveParameters() {
        return repository.findActive()
                .orElseThrow(() -> ApiException.notFound(
                        "Parámetros no encontrados",
                        "No se encontraron parámetros de financiamiento activos en el sistema."
                ));
    }

    /** D-55: el plazo es de 24 meses, como mínimo y como máximo. La política no admite otro. */
    public static final int FIXED_TERM_MONTHS = 24;

    @Transactional
    public FinancingParameters updateParameters(UpdateFinancingParametersRequest req) {
        if (req.termMonths() != FIXED_TERM_MONTHS) {
            throw ApiException.unprocessable("Plazo no admitido",
                    "El financiamiento es a " + FIXED_TERM_MONTHS + " meses, como mínimo y como máximo.");
        }
        // La Constitución v3.0.0 (Principio V) fija el euro como moneda base de la plataforma.
        if (req.baseCurrency() != null && !"EUR".equalsIgnoreCase(req.baseCurrency())) {
            throw ApiException.unprocessable("Moneda no admitida", "La moneda base de la política es el euro (EUR).");
        }
        if (req.minimumDownPayment().compareTo(BigDecimal.ZERO) <= 0 || req.minimumDownPayment().compareTo(BigDecimal.ONE) > 0) {
            throw ApiException.unprocessable("Inicial mínima inválida", "La inicial mínima debe estar entre 0.01 y 1.00");
        }
        if (req.paymentToIncomeRatio().compareTo(BigDecimal.ZERO) <= 0 || req.paymentToIncomeRatio().compareTo(BigDecimal.ONE) > 0) {
            throw ApiException.unprocessable("Ratio cuota/ingreso inválido", "El ratio cuota/ingreso debe estar entre 0.01 y 1.00");
        }
        for (BigDecimal opt : req.downPaymentOptions()) {
            if (opt.compareTo(req.minimumDownPayment()) < 0) {
                throw ApiException.unprocessable("Opción de inicial inválida", "Ninguna opción de inicial puede ser menor que la inicial mínima");
            }
        }

        Optional<FinancingParameters> previousOpt = repository.findActive();
        Map<String, Object> beforeMap = previousOpt.map(p -> Map.<String, Object>of(
                "tasa_mensual", p.monthlyRate().toPlainString(),
                "plazo_meses", p.termMonths(),
                "ratio_cuota_ingreso", p.paymentToIncomeRatio().toPlainString(),
                "inicial_minima", p.minimumDownPayment().toPlainString(),
                "moneda_base", p.baseCurrency()
        )).orElse(null);

        FinancingParameters updated = repository.saveNewActive(
                req.monthlyRate(),
                req.termMonths(),
                req.paymentToIncomeRatio(),
                req.downPaymentOptions(),
                req.minimumDownPayment(),
                req.baseCurrency()
        );

        Map<String, Object> afterMap = Map.of(
                "tasa_mensual", updated.monthlyRate().toPlainString(),
                "plazo_meses", updated.termMonths(),
                "ratio_cuota_ingreso", updated.paymentToIncomeRatio().toPlainString(),
                "inicial_minima", updated.minimumDownPayment().toPlainString(),
                "moneda_base", updated.baseCurrency()
        );

        auditLog.record("parametros_financiamiento.actualizados", "parametros_financiamiento",
                updated.id(), beforeMap, afterMap);

        return updated;
    }
}
