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

    @Transactional
    public FinancingParameters updateParameters(UpdateFinancingParametersRequest req) {
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
