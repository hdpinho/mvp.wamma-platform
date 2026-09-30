package com.wamma.crm;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class InteractionRepository {

    private static final String SELECT_FIELDS = """
            id, persona_id, oportunidad_id, canal, direccion, nota, autor_id, corrige_interaccion_id,
            ocurrido_en, idempotency_key, creado_en
            """;

    private final JdbcClient jdbc;

    public InteractionRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public UUID insert(UUID personId, UUID opportunityId, String channel, String direction,
                       String note, UUID authorId, UUID correctsId, Instant occurredAt, String idempotencyKey) {
        return jdbc.sql("""
                        insert into interaccion (persona_id, oportunidad_id, canal, direccion, nota, autor_id,
                                                 corrige_interaccion_id, ocurrido_en, idempotency_key)
                        values (:personId, :oppId, :channel, :direction, :note, :authorId,
                                :correctsId, :occurredAt, :idempotencyKey)
                        returning id
                        """)
                .param("personId", personId, Types.OTHER)
                .param("oppId", opportunityId, Types.OTHER)
                .param("channel", channel)
                .param("direction", direction)
                .param("note", note)
                .param("authorId", authorId, Types.OTHER)
                .param("correctsId", correctsId, Types.OTHER)
                .param("occurredAt", odt(occurredAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("idempotencyKey", idempotencyKey, Types.VARCHAR)
                .query(UUID.class)
                .single();
    }

    public Optional<InteractionRecord> findByIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            return Optional.empty();
        }
        return jdbc.sql("select " + SELECT_FIELDS + " from interaccion where idempotency_key = :key")
                .param("key", idempotencyKey)
                .query(InteractionRepository::map)
                .optional();
    }

    public List<InteractionRecord> listByPersonId(UUID personId) {
        return jdbc.sql("select " + SELECT_FIELDS + """
                        from interaccion
                        where persona_id = :personId
                        order by ocurrido_en desc
                        """)
                .param("personId", personId, Types.OTHER)
                .query(InteractionRepository::map)
                .list();
    }

    private static InteractionRecord map(ResultSet rs, int rowNum) throws SQLException {
        return new InteractionRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("persona_id", UUID.class),
                rs.getObject("oportunidad_id", UUID.class),
                rs.getString("canal"),
                rs.getString("direccion"),
                rs.getString("nota"),
                rs.getObject("autor_id", UUID.class),
                rs.getObject("corrige_interaccion_id", UUID.class),
                instant(rs, "ocurrido_en"),
                rs.getString("idempotency_key"),
                instant(rs, "creado_en")
        );
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private static OffsetDateTime odt(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
