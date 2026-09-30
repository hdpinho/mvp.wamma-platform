package com.wamma.risk;

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
public class AmlAlertRepository {

    private final JdbcClient jdbc;

    public AmlAlertRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(AmlAlertRecord r) {
        jdbc.sql("""
                INSERT INTO alerta_aml (
                    id, solicitud_id, persona_id, regla_coincidencia, severidad,
                    origen_lista, revisado_por, resolucion, notas, resuelto_en, creado_en
                ) VALUES (
                    :id, :solId, :personId, :regla, :severidad,
                    :origen, :revisadoPor, :resolucion, :notas, :resueltoEn, :creadoEn
                )
                """)
                .param("id", r.id())
                .param("solId", r.applicationId())
                .param("personId", r.personId())
                .param("regla", r.matchRule())
                .param("severidad", r.severity())
                .param("origen", r.listOrigin())
                .param("revisadoPor", r.reviewedBy(), Types.OTHER)
                .param("resolucion", r.resolution() != null ? r.resolution() : "pendiente")
                .param("notas", r.notes())
                .param("resueltoEn", toOffsetDateTime(r.resolvedAt()), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("creadoEn", toOffsetDateTime(r.createdAt()), Types.TIMESTAMP_WITH_TIMEZONE)
                .update();
    }

    public List<AmlAlertRecord> findByApplicationId(UUID applicationId) {
        return jdbc.sql("SELECT * FROM alerta_aml WHERE solicitud_id = :solId ORDER BY creado_en DESC")
                .param("solId", applicationId)
                .query(this::mapRow)
                .list();
    }

    public List<AmlAlertRecord> listAll(String resolutionFilter) {
        if (resolutionFilter != null && !resolutionFilter.isBlank()) {
            return jdbc.sql("SELECT * FROM alerta_aml WHERE resolucion = :res ORDER BY creado_en DESC")
                    .param("res", resolutionFilter.trim().toLowerCase())
                    .query(this::mapRow)
                    .list();
        }
        return jdbc.sql("SELECT * FROM alerta_aml ORDER BY creado_en DESC")
                .query(this::mapRow)
                .list();
    }

    public Optional<AmlAlertRecord> findById(UUID id) {
        return jdbc.sql("SELECT * FROM alerta_aml WHERE id = :id")
                .param("id", id)
                .query(this::mapRow)
                .optional();
    }

    public void resolve(UUID id, String resolution, String notes, UUID reviewedBy, Instant resolvedAt) {
        jdbc.sql("""
                UPDATE alerta_aml
                SET resolucion = :res,
                    notas = :notas,
                    revisado_por = :revBy,
                    resuelto_en = :resAt
                WHERE id = :id
                """)
                .param("res", resolution)
                .param("notas", notes)
                .param("revBy", reviewedBy, Types.OTHER)
                .param("resAt", toOffsetDateTime(resolvedAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("id", id)
                .update();
    }

    public void deletePendingByApplicationId(UUID applicationId) {
        jdbc.sql("DELETE FROM alerta_aml WHERE solicitud_id = :solId AND resolucion = 'pendiente'")
                .param("solId", applicationId)
                .update();
    }

    private AmlAlertRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
        OffsetDateTime resOdt = rs.getObject("resuelto_en", OffsetDateTime.class);
        OffsetDateTime creaOdt = rs.getObject("creado_en", OffsetDateTime.class);
        return new AmlAlertRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("solicitud_id", UUID.class),
                rs.getObject("persona_id", UUID.class),
                rs.getString("regla_coincidencia"),
                rs.getString("severidad"),
                rs.getString("origen_lista"),
                rs.getObject("revisado_por", UUID.class),
                rs.getString("resolucion"),
                rs.getString("notas"),
                resOdt != null ? resOdt.toInstant() : null,
                creaOdt != null ? creaOdt.toInstant() : Instant.now()
        );
    }

    private static OffsetDateTime toOffsetDateTime(Instant instant) {
        return instant != null ? instant.atOffset(ZoneOffset.UTC) : null;
    }
}
