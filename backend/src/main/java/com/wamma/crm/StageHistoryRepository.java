package com.wamma.crm;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public class StageHistoryRepository {

    private static final String SELECT_FIELDS = """
            id, oportunidad_id, etapa_anterior, etapa_nueva, nota, actor_id, creado_en
            """;

    private final JdbcClient jdbc;

    public StageHistoryRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public UUID insert(UUID opportunityId, String previousStage, String newStage, String note, UUID actorId) {
        return jdbc.sql("""
                        insert into etapa_historial (oportunidad_id, etapa_anterior, etapa_nueva, nota, actor_id)
                        values (:oppId, :prevStage, :newStage, :note, :actorId)
                        returning id
                        """)
                .param("oppId", opportunityId, Types.OTHER)
                .param("prevStage", previousStage, Types.VARCHAR)
                .param("newStage", newStage)
                .param("note", note, Types.VARCHAR)
                .param("actorId", actorId, Types.OTHER)
                .query(UUID.class)
                .single();
    }

    public List<StageHistoryRecord> listByOpportunityId(UUID opportunityId) {
        return jdbc.sql("select " + SELECT_FIELDS + """
                        from etapa_historial
                        where oportunidad_id = :oppId
                        order by creado_en asc
                        """)
                .param("oppId", opportunityId, Types.OTHER)
                .query(StageHistoryRepository::map)
                .list();
    }

    public List<StageHistoryRecord> listAll() {
        return jdbc.sql("select " + SELECT_FIELDS + " from etapa_historial order by creado_en asc")
                .query(StageHistoryRepository::map)
                .list();
    }

    private static StageHistoryRecord map(ResultSet rs, int rowNum) throws SQLException {
        OffsetDateTime odt = rs.getObject("creado_en", OffsetDateTime.class);
        return new StageHistoryRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("oportunidad_id", UUID.class),
                rs.getString("etapa_anterior"),
                rs.getString("etapa_nueva"),
                rs.getString("nota"),
                rs.getObject("actor_id", UUID.class),
                odt != null ? odt.toInstant() : null
        );
    }
}
