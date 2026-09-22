package com.wamma.crm.domain;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.wamma.crm.domain.FunnelMetrics.Closure;
import com.wamma.crm.domain.FunnelMetrics.Conversion;
import com.wamma.crm.domain.FunnelMetrics.StageChange;
import com.wamma.crm.domain.FunnelMetrics.StageConversion;
import org.junit.jupiter.api.Test;

import static com.wamma.crm.domain.SeededCatalogs.STAGES;
import static org.assertj.core.api.Assertions.assertThat;

/** Métricas del embudo sobre datos fijos (spec 010 RF-010.15 a RF-010.17, CA-010.9). */
class FunnelMetricsTest {

    private static final Instant D0 = Instant.parse("2026-09-01T00:00:00Z");
    private static final Instant FROM = D0;
    private static final Instant TO = day(10);
    private static final Instant NOW = day(20);

    private static final UUID A = UUID.randomUUID();
    private static final UUID B = UUID.randomUUID();
    private static final UUID C = UUID.randomUUID();
    private static final UUID D = UUID.randomUUID();
    private static final UUID E = UUID.randomUUID();
    private static final UUID F = UUID.randomUUID();
    private static final UUID G = UUID.randomUUID();

    private static Instant day(int n) {
        return D0.plus(Duration.ofDays(n));
    }

    private static StageChange change(UUID opportunity, String from, String to, int day) {
        return new StageChange(opportunity, from, to, day(day));
    }

    /**
     * A: vendida; sale de «Contactado» el día 12, después del período.
     * B: sigue en «Contactado» desde el día 4.
     * C: creada antes del período; se pierde dentro de él.
     * D: pasa a una etapa que el catálogo ya no tiene.
     * E: contactada y perdida dentro del período.
     * F: creada en una etapa desconocida.
     * G: sin fila de creación: su historial empieza en un cambio.
     */
    private static List<StageChange> history() {
        List<StageChange> history = new ArrayList<>(List.of(
                change(A, null, "nuevo", 1), change(A, "nuevo", "contactado", 3),
                change(A, "contactado", "visito", 12), change(A, "visito", "cerrado_ganado", 13),
                change(B, null, "nuevo", 2), change(B, "nuevo", "contactado", 4),
                change(C, null, "nuevo", -5), change(C, "nuevo", "cerrado_perdido", 5),
                change(D, null, "nuevo", 5), change(D, "nuevo", "inventada", 6),
                change(E, null, "nuevo", 7), change(E, "nuevo", "contactado", 8), change(E, "contactado", "cerrado_perdido", 9),
                change(F, null, "inventada", 3),
                change(G, "nuevo", "contactado", 4)));
        // El orden de llegada no importa: el cálculo ordena por fecha.
        Collections.shuffle(history);
        return history;
    }

    @Test
    void timeInStageRunsToTheNextChangeEvenAfterThePeriodOrUntilNow() {
        Map<String, Duration> average = FunnelMetrics.averageTimeInStage(STAGES, history(), FROM, TO, NOW);

        // Nuevo: A 2 d, B 2 d, D 1 d, E 1 d. La de C empezó antes del período.
        // Contactado: A 9 d (hasta el día 12, fuera del período), B 16 d y G 16 d (siguen ahí:
        // cuentan hasta ahora, CA-010.9), E 1 d.
        // Sin muestras de «Cita confirmada» ni posteriores; los cierres no tienen permanencia.
        assertThat(average).containsExactly(
                Map.entry("nuevo", Duration.ofHours(36)),
                Map.entry("contactado", Duration.ofHours(252)));
    }

    @Test
    void conversionFollowsTheCohortCreatedInThePeriod() {
        Conversion conversion = FunnelMetrics.conversion(STAGES, history(), FROM, TO);

        // Cohorte: A, B, D, E y F. Fuera: C (antes del período) y G (sin creación).
        assertThat(conversion.cohort()).isEqualTo(5);
        // Llegar a una etapa es llegar a ella o a una posterior: A saltó «Cita confirmada» y
        // cuenta en ella. La pérdida de E no es avance. F no llegó a ninguna etapa conocida.
        assertThat(conversion.stages()).containsExactly(
                new StageConversion("nuevo", 4, null),
                new StageConversion("contactado", 3, new BigDecimal("0.7500")),
                new StageConversion("cita_confirmada", 1, new BigDecimal("0.3333")),
                new StageConversion("visito", 1, new BigDecimal("1.0000")),
                new StageConversion("negociacion", 1, new BigDecimal("1.0000")),
                new StageConversion("cerrado_ganado", 1, new BigDecimal("1.0000")));
        assertThat(conversion.overall()).isEqualTo(new BigDecimal("0.2000"));
    }

    @Test
    void anEmptyPeriodHasNoRates() {
        Conversion conversion = FunnelMetrics.conversion(STAGES, List.of(), FROM, TO);

        assertThat(conversion.cohort()).isZero();
        assertThat(conversion.overall()).isNull();
        assertThat(conversion.stages()).allSatisfy(stage -> {
            assertThat(stage.reached()).isZero();
            assertThat(stage.rateFromPrevious()).isNull();
        });
        assertThat(FunnelMetrics.averageTimeInStage(STAGES, List.of(), FROM, TO, NOW)).isEmpty();
    }

    @Test
    void anOpportunityIsStalledOnlyPastTheThresholdOfItsStage() {
        Instant last = day(0);
        // «Nuevo» admite 2 días: justo en el umbral no está estancada; un segundo después, sí.
        assertThat(FunnelMetrics.isStalled(STAGES, "nuevo", last, day(2))).isFalse();
        assertThat(FunnelMetrics.isStalled(STAGES, "nuevo", last, day(2).plusSeconds(1))).isTrue();
        // «En negociación» admite 14: diez días es sano.
        assertThat(FunnelMetrics.isStalled(STAGES, "negociacion", last, day(10))).isFalse();
        // Las cerradas y las desconocidas nunca están estancadas.
        assertThat(FunnelMetrics.isStalled(STAGES, "cerrado_ganado", last, day(100))).isFalse();
        assertThat(FunnelMetrics.isStalled(STAGES, "inventada", last, day(100))).isFalse();

        StageCatalog withoutThreshold = StageCatalog.of(List.of(
                new StageDefinition("nuevo", "Nuevo", 1, false, null),
                new StageDefinition("cerrado_ganado", "Vendido", 2, true, null),
                new StageDefinition("cerrado_perdido", "Perdido", 3, true, null)));
        assertThat(FunnelMetrics.isStalled(withoutThreshold, "nuevo", last, day(100))).isFalse();
    }

    @Test
    void theNextActionIsOverdueTheDayAfterItsDate() {
        LocalDate due = LocalDate.of(2026, 9, 21);
        assertThat(FunnelMetrics.isNextActionOverdue(STAGES, "contactado", due, due)).isFalse();
        assertThat(FunnelMetrics.isNextActionOverdue(STAGES, "contactado", due, due.plusDays(1))).isTrue();
        assertThat(FunnelMetrics.isNextActionOverdue(STAGES, "contactado", null, due.plusDays(9))).isFalse();
        assertThat(FunnelMetrics.isNextActionOverdue(STAGES, "cerrado_perdido", due, due.plusDays(9))).isFalse();
        assertThat(FunnelMetrics.isNextActionOverdue(STAGES, "inventada", due, due.plusDays(9))).isFalse();
    }

    @Test
    void lossReasonsAreCountedInThePeriodMostFrequentFirst() {
        List<Closure> closures = List.of(
                new Closure("otro", day(1)),
                new Closure("dejo_de_responder", day(2)),
                new Closure("compro_en_otra_parte", day(3)),
                new Closure("dejo_de_responder", day(4)),
                new Closure("dejo_de_responder", day(9)),
                new Closure("precio_fuera_de_presupuesto", day(10)),
                new Closure("precio_fuera_de_presupuesto", day(-1)));

        assertThat(FunnelMetrics.lossReasons(closures, FROM, TO)).containsExactly(
                Map.entry("dejo_de_responder", 3L),
                Map.entry("compro_en_otra_parte", 1L),
                Map.entry("otro", 1L));
    }
}
