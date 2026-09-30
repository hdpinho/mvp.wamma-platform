package com.wamma.crm;

import com.wamma.crm.domain.FunnelMetrics;
import com.wamma.crm.domain.LossReason;
import com.wamma.crm.domain.LossReasonCatalog;
import com.wamma.crm.domain.StageCatalog;
import com.wamma.crm.domain.StageDefinition;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FunnelService {

    public record CatalogsResponse(List<StageDefinition> stages, List<LossReason> lossReasons) {
    }

    public record MetricsResponse(
            FunnelMetrics.Conversion conversion,
            Map<String, Long> averageTimeInStageHours,
            Map<String, Long> stagnantOpportunities
    ) {
    }

    private final StageHistoryRepository stageHistories;
    private final OpportunityRepository opportunities;
    private final JdbcClient jdbc;
    private final Clock clock;

    public FunnelService(StageHistoryRepository stageHistories, OpportunityRepository opportunities,
                         JdbcClient jdbc, Clock clock) {
        this.stageHistories = stageHistories;
        this.opportunities = opportunities;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public CatalogsResponse getCatalogs() {
        return new CatalogsResponse(loadStageCatalog().all(), loadLossReasonCatalog().all());
    }

    public MetricsResponse getMetrics(Instant from, Instant to) {
        Instant effectiveFrom = from != null ? from : Instant.EPOCH;
        Instant effectiveTo = to != null ? to : clock.instant().plus(Duration.ofDays(365));
        Instant now = clock.instant();

        StageCatalog stages = loadStageCatalog();
        List<StageHistoryRecord> history = stageHistories.listAll();

        List<FunnelMetrics.StageChange> changes = history.stream()
                .map(h -> new FunnelMetrics.StageChange(h.opportunityId(), h.previousStage(), h.newStage(), h.createdAt()))
                .toList();

        FunnelMetrics.Conversion conversion = FunnelMetrics.conversion(stages, changes, effectiveFrom, effectiveTo);
        Map<String, Duration> durations = FunnelMetrics.averageTimeInStage(stages, changes, effectiveFrom, effectiveTo, now);

        Map<String, Long> durationHours = new LinkedHashMap<>();
        durations.forEach((k, v) -> durationHours.put(k, v.toHours()));

        Map<String, Long> stagnantCounts = new LinkedHashMap<>();
        for (StageDefinition stage : stages.open()) {
            if (stage.stalledAfterDays() != null) {
                Instant threshold = now.minus(Duration.ofDays(stage.stalledAfterDays()));
                Long count = jdbc.sql("""
                                select count(*)
                                from oportunidad
                                where etapa = :stage
                                  and actualizado_en <= :threshold
                                """)
                        .param("stage", stage.code())
                        .param("threshold", java.time.OffsetDateTime.ofInstant(threshold, java.time.ZoneOffset.UTC), java.sql.Types.TIMESTAMP_WITH_TIMEZONE)
                        .query(Long.class)
                        .single();
                stagnantCounts.put(stage.code(), count);
            }
        }

        return new MetricsResponse(conversion, durationHours, stagnantCounts);
    }

    public StageCatalog loadStageCatalog() {
        List<StageDefinition> list = jdbc.sql("""
                        select codigo, nombre, orden, es_terminal, umbral_estancada_dias
                        from catalogo_etapa
                        order by orden
                        """)
                .query((rs, rowNum) -> new StageDefinition(
                        rs.getString("codigo"),
                        rs.getString("nombre"),
                        rs.getInt("orden"),
                        rs.getBoolean("es_terminal"),
                        (Integer) rs.getObject("umbral_estancada_dias")
                ))
                .list();

        return StageCatalog.of(list);
    }

    public LossReasonCatalog loadLossReasonCatalog() {
        List<LossReason> list = jdbc.sql("""
                        select codigo, nombre, exige_texto
                        from catalogo_motivo_perdida
                        order by codigo
                        """)
                .query((rs, rowNum) -> new LossReason(
                        rs.getString("codigo"),
                        rs.getString("nombre"),
                        rs.getBoolean("exige_texto")
                ))
                .list();

        return LossReasonCatalog.of(list);
    }
}
