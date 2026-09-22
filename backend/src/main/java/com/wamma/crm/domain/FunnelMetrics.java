package com.wamma.crm.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Métricas del embudo sobre filas ya leídas (spec 010 RF-010.15 a RF-010.17, plan 010 §9).
 * Sin consultas: la base entrega el historial y aquí se calcula, así que cada regla se
 * prueba con datos fijos.
 * <p>
 * Los períodos son semiabiertos, {@code [desde, hasta)}, en instantes.
 */
public final class FunnelMetrics {

    /** Una fila de {@code etapa_historial}. La creación de la oportunidad no tiene etapa anterior. */
    public record StageChange(UUID opportunityId, String fromStage, String toStage, Instant at) {
    }

    /** Un cierre como perdida, con su motivo. */
    public record Closure(String reason, Instant closedAt) {
    }

    /**
     * @param reached          oportunidades de la cohorte que llegaron a esta etapa o a una posterior
     * @param rateFromPrevious {@code reached} sobre las que llegaron a la etapa anterior, con cuatro
     *                         decimales; nulo en la primera etapa o si a la anterior no llegó nadie
     */
    public record StageConversion(String stage, long reached, BigDecimal rateFromPrevious) {
    }

    /**
     * @param cohort  oportunidades creadas en el período
     * @param overall las que llegaron a «Vendido» sobre la cohorte; nulo si la cohorte está vacía
     */
    public record Conversion(long cohort, List<StageConversion> stages, BigDecimal overall) {
    }

    private FunnelMetrics() {
    }

    /**
     * Tiempo medio en cada etapa abierta, para los cambios que entraron a ella en el período.
     * <p>
     * El tiempo va hasta el cambio siguiente de esa oportunidad, esté o no dentro del período.
     * Si no hubo un cambio siguiente, va hasta {@code now}: así una oportunidad parada cuenta
     * el tiempo que lleva parada, y las estancadas, que son las que hay que ver, no quedan
     * fuera del promedio (CA-010.9). Las etapas terminales no tienen tiempo de permanencia.
     *
     * @return etapa → tiempo medio, en el orden del embudo; solo las que tienen datos
     */
    public static Map<String, Duration> averageTimeInStage(StageCatalog stages, List<StageChange> history,
                                                           Instant from, Instant to, Instant now) {
        Map<String, Duration> total = new HashMap<>();
        Map<String, Long> samples = new HashMap<>();
        for (List<StageChange> changes : byOpportunity(history).values()) {
            for (int i = 0; i < changes.size(); i++) {
                StageChange change = changes.get(i);
                Optional<StageDefinition> stage = stages.find(change.toStage());
                if (!within(change.at(), from, to) || stage.isEmpty() || stage.get().terminal()) {
                    continue;
                }
                Instant end = i + 1 < changes.size() ? changes.get(i + 1).at() : now;
                total.merge(stage.get().code(), Duration.between(change.at(), end), Duration::plus);
                samples.merge(stage.get().code(), 1L, Long::sum);
            }
        }
        Map<String, Duration> average = new LinkedHashMap<>();
        for (StageDefinition stage : stages.open()) {
            Long count = samples.get(stage.code());
            if (count != null) {
                average.put(stage.code(), total.get(stage.code()).dividedBy(count));
            }
        }
        return average;
    }

    /**
     * Conversión de la cohorte de oportunidades creadas en el período, entre etapas
     * consecutivas y global.
     * <p>
     * Llegar a una etapa es llegar a ella <b>o a una posterior</b>: quien pasó de «Nuevo» a
     * «Visitó» sin registrar el contacto también cuenta como contactado, porque saltar etapas
     * es legítimo (spec 010 §8.1). «Perdido» no es avance y no cuenta.
     */
    public static Conversion conversion(StageCatalog stages, List<StageChange> history, Instant from, Instant to) {
        List<StageDefinition> funnel = stages.all().stream()
                .filter(stage -> !stage.code().equals(Stages.LOST))
                .toList();
        Map<String, Long> reached = new HashMap<>();
        long cohort = 0;
        for (List<StageChange> changes : byOpportunity(history).values()) {
            Optional<StageChange> creation = changes.stream().filter(change -> change.fromStage() == null).findFirst();
            if (creation.isEmpty() || !within(creation.get().at(), from, to)) {
                continue;
            }
            cohort++;
            int furthest = changes.stream()
                    .map(change -> stages.find(change.toStage()))
                    .flatMap(Optional::stream)
                    .filter(stage -> !stage.code().equals(Stages.LOST))
                    .mapToInt(StageDefinition::order)
                    .max()
                    .orElse(Integer.MIN_VALUE);
            for (StageDefinition stage : funnel) {
                if (furthest >= stage.order()) {
                    reached.merge(stage.code(), 1L, Long::sum);
                }
            }
        }
        List<StageConversion> result = new ArrayList<>();
        long previous = -1;
        for (StageDefinition stage : funnel) {
            long count = reached.getOrDefault(stage.code(), 0L);
            result.add(new StageConversion(stage.code(), count, previous < 0 ? null : ratio(count, previous)));
            previous = count;
        }
        long won = reached.getOrDefault(Stages.WON, 0L);
        return new Conversion(cohort, result, ratio(won, cohort));
    }

    /**
     * Si una oportunidad abierta está estancada: lleva sin actividad más días de los que
     * admite su etapa (spec 010 §8.6). {@code lastActivity} es lo más reciente entre su última
     * interacción y su último cambio de etapa.
     */
    public static boolean isStalled(StageCatalog stages, String stage, Instant lastActivity, Instant now) {
        Optional<StageDefinition> definition = stages.find(stage);
        if (definition.isEmpty() || definition.get().terminal() || definition.get().stalledAfterDays() == null) {
            return false;
        }
        Duration threshold = Duration.ofDays(definition.get().stalledAfterDays());
        return Duration.between(lastActivity, now).compareTo(threshold) > 0;
    }

    /**
     * La próxima acción vence al terminar el día indicado, no a medianoche del anterior. En
     * una oportunidad cerrada no hay nada que vencer. {@code today} es la fecha en Venezuela.
     */
    public static boolean isNextActionOverdue(StageCatalog stages, String stage, LocalDate due, LocalDate today) {
        if (due == null) {
            return false;
        }
        Optional<StageDefinition> definition = stages.find(stage);
        if (definition.isEmpty() || definition.get().terminal()) {
            return false;
        }
        return today.isAfter(due);
    }

    /** Motivos de pérdida de los cierres del período, del más frecuente al menos (RF-010.17). */
    public static Map<String, Long> lossReasons(List<Closure> closures, Instant from, Instant to) {
        Map<String, Long> counts = closures.stream()
                .filter(closure -> within(closure.closedAt(), from, to))
                .collect(Collectors.groupingBy(Closure::reason, Collectors.counting()));
        Map<String, Long> sorted = new LinkedHashMap<>();
        counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed()
                        .thenComparing(Map.Entry.comparingByKey()))
                .forEach(entry -> sorted.put(entry.getKey(), entry.getValue()));
        return sorted;
    }

    /** Historial agrupado por oportunidad, cada grupo en orden cronológico. */
    private static Map<UUID, List<StageChange>> byOpportunity(List<StageChange> history) {
        return history.stream()
                .sorted(Comparator.comparing(StageChange::at))
                .collect(Collectors.groupingBy(StageChange::opportunityId, LinkedHashMap::new, Collectors.toList()));
    }

    private static boolean within(Instant at, Instant from, Instant to) {
        return !at.isBefore(from) && at.isBefore(to);
    }

    /** Cociente con cuatro decimales; nulo si el divisor es cero. */
    private static BigDecimal ratio(long numerator, long denominator) {
        if (denominator == 0) {
            return null;
        }
        return BigDecimal.valueOf(numerator).divide(BigDecimal.valueOf(denominator), 4, RoundingMode.HALF_UP);
    }
}
