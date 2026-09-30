package com.wamma.risk;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CreditScoringEngineTest {

    private CreditScoringEngine engine;

    @BeforeEach
    void setUp() {
        engine = new CreditScoringEngine();
    }

    @Test
    @DisplayName("Solicitante óptimo obtiene Score >= 750 (Riesgo Bajo) con regla 30% holgada")
    void optimalApplicantGetsHighScoreAndLowRisk() {
        BigDecimal montoSolicitado = new BigDecimal("12000.00");
        BigDecimal cuotaInicial = new BigDecimal("8000.00"); // 40% inicial
        BigDecimal cuotaEstimada = new BigDecimal("350.00");
        BigDecimal capacidadPago = new BigDecimal("2000.00"); // 350 / 2000 = 17.5% (< 20%)

        Map<String, Object> personal = Map.of("cargasFamiliares", 1);
        Map<String, Object> contact = Map.of("tipoVivienda", "PROPIA");
        Map<String, Object> employment = Map.of("antiguedadAnios", 6, "tipoOcupacion", "EMPLEADO_PRIVADO");
        Map<String, Object> financial = Map.of("ingresoMensual", 2000.00);
        List<Map<String, Object>> references = List.of(
                Map.of("nombre", "Ref 1", "telefono", "0412"),
                Map.of("nombre", "Ref 2", "telefono", "0414")
        );
        Map<String, Object> banking = Map.of("banco", "Banesco", "tipoCuenta", "CORRIENTE");

        CreditScoringEngine.EngineResult result = engine.evaluate(
                montoSolicitado, cuotaInicial, cuotaEstimada, capacidadPago,
                personal, contact, employment, financial, references, banking
        );

        assertThat(result.scoreInterno()).isGreaterThanOrEqualTo(800);
        assertThat(result.riesgoNivel()).isEqualTo("bajo");
        assertThat(result.alertaCapacidad()).isFalse();
        assertThat(result.scoreBuro()).isGreaterThanOrEqualTo(650);
        assertThat(result.factores()).hasSize(5);
    }

    @Test
    @DisplayName("Solicitante con cuota superior al 30% activa alerta de capacidad y penaliza score")
    void overCapacityTriggersAlertAndPenalizesScore() {
        BigDecimal montoSolicitado = new BigDecimal("15000.00");
        BigDecimal cuotaInicial = new BigDecimal("3750.00"); // 20% inicial
        BigDecimal cuotaEstimada = new BigDecimal("550.00");
        BigDecimal capacidadPago = new BigDecimal("1500.00"); // 550 / 1500 = 36.6% (> 30%)

        Map<String, Object> personal = Map.of("cargasFamiliares", 3);
        Map<String, Object> contact = Map.of("tipoVivienda", "ALQUILADA");
        Map<String, Object> employment = Map.of("antiguedadAnios", 1);
        Map<String, Object> financial = Map.of("ingresoMensual", 1500.00);
        List<Map<String, Object>> references = List.of(Map.of("nombre", "Ref 1"));
        Map<String, Object> banking = Map.of("banco", "Mercantil", "tipoCuenta", "AHORRO");

        CreditScoringEngine.EngineResult result = engine.evaluate(
                montoSolicitado, cuotaInicial, cuotaEstimada, capacidadPago,
                personal, contact, employment, financial, references, banking
        );

        assertThat(result.alertaCapacidad()).isTrue();
        assertThat(result.porcentajeCapacidadUsada()).isGreaterThan(new BigDecimal("30"));
        assertThat(result.scoreInterno()).isLessThan(650);
    }

    @Test
    @DisplayName("Solicitante con capacidad nula o negativa obtiene Score < 450 (No Asegurable)")
    void zeroCapacityResultsInNoAsegurable() {
        BigDecimal montoSolicitado = new BigDecimal("10000.00");
        BigDecimal cuotaInicial = new BigDecimal("1000.00"); // 9% inicial (incumple)
        BigDecimal cuotaEstimada = new BigDecimal("450.00");
        BigDecimal capacidadPago = BigDecimal.ZERO;

        CreditScoringEngine.EngineResult result = engine.evaluate(
                montoSolicitado, cuotaInicial, cuotaEstimada, capacidadPago,
                Map.of(), Map.of(), Map.of(), Map.of(), List.of(), Map.of()
        );

        assertThat(result.scoreInterno()).isLessThan(450);
        assertThat(result.riesgoNivel()).isEqualTo("no_asegurable");
        assertThat(result.alertaCapacidad()).isTrue();
    }
}
