package com.wamma.crm;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class OpportunityRepository {

    private static final String SELECT_FIELDS = """
            id, persona_id, vehiculo_id, modalidad_pago, valor_estimado, moneda, tasa_bcv, fecha_tasa,
            etapa, motivo_perdida, detalle_perdida, asesor_id, proxima_accion, proxima_accion_fecha,
            solicitud_credito_id, enlace_token_hash, enlace_emitido_en, enlace_expira_en, enlace_usado_en,
            cerrado_en, version, creado_en, actualizado_en
            """;

    private final JdbcClient jdbc;

    public OpportunityRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public UUID insert(UUID personId, UUID vehicleId, String paymentMethod, BigDecimal estimatedValue,
                       String currency, BigDecimal bcvRate, LocalDate rateDate, UUID advisorId) {
        return jdbc.sql("""
                        insert into oportunidad (persona_id, vehiculo_id, modalidad_pago, valor_estimado,
                                                 moneda, tasa_bcv, fecha_tasa, etapa, asesor_id, version)
                        values (:personId, :vehicleId, :paymentMethod, :estimatedValue,
                                :currency, :bcvRate, :rateDate, 'nuevo', :advisorId, 0)
                        returning id
                        """)
                .param("personId", personId, Types.OTHER)
                .param("vehicleId", vehicleId, Types.OTHER)
                .param("paymentMethod", paymentMethod)
                .param("estimatedValue", estimatedValue)
                .param("currency", currency != null ? currency : "EUR")
                .param("bcvRate", bcvRate)
                .param("rateDate", rateDate)
                .param("advisorId", advisorId, Types.OTHER)
                .query(UUID.class)
                .single();
    }

    public Optional<OpportunityRecord> findById(UUID id) {
        return jdbc.sql("select " + SELECT_FIELDS + " from oportunidad where id = :id")
                .param("id", id, Types.OTHER)
                .query(OpportunityRepository::map)
                .optional();
    }

    public Optional<OpportunityRecord> findLatestOpenByPersonAndVehicle(UUID personId, UUID vehicleId) {
        return jdbc.sql("select " + SELECT_FIELDS + """
                        from oportunidad
                        where persona_id = :personId and vehiculo_id = :vehicleId
                          and etapa not in ('cerrado_ganado', 'cerrado_perdido')
                        order by creado_en desc
                        limit 1
                        """)
                .param("personId", personId, Types.OTHER)
                .param("vehicleId", vehicleId, Types.OTHER)
                .query(OpportunityRepository::map)
                .optional();
    }

    public Optional<OpportunityRecord> findOpenByVehicleId(UUID vehicleId) {
        return jdbc.sql("select " + SELECT_FIELDS + """
                        from oportunidad
                        where vehiculo_id = :vehicleId
                          and etapa not in ('cerrado_ganado', 'cerrado_perdido')
                        order by creado_en desc
                        limit 1
                        """)
                .param("vehicleId", vehicleId, Types.OTHER)
                .query(OpportunityRepository::map)
                .optional();
    }

    public long countOpenByVehicleIdExcluding(UUID vehicleId, UUID excludeOpportunityId) {
        return jdbc.sql("""
                        select count(*)
                        from oportunidad
                        where vehiculo_id = :vehicleId
                          and id <> :excludeId
                          and etapa not in ('cerrado_ganado', 'cerrado_perdido')
                        """)
                .param("vehicleId", vehicleId, Types.OTHER)
                .param("excludeId", excludeOpportunityId, Types.OTHER)
                .query(Long.class)
                .single();
    }

    public boolean updateStage(UUID id, String newStage, String lossReason, String lossDetail,
                               Instant closedAt, int expectedVersion) {
        int updated = jdbc.sql("""
                        update oportunidad
                        set etapa = :newStage, motivo_perdida = :lossReason, detalle_perdida = :lossDetail,
                            cerrado_en = :closedAt, version = version + 1
                        where id = :id and version = :expectedVersion
                        """)
                .param("newStage", newStage)
                .param("lossReason", lossReason, Types.VARCHAR)
                .param("lossDetail", lossDetail, Types.VARCHAR)
                .param("closedAt", odt(closedAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("id", id, Types.OTHER)
                .param("expectedVersion", expectedVersion)
                .update();

        return updated == 1;
    }

    public void updateAdvisor(UUID id, UUID advisorId) {
        jdbc.sql("update oportunidad set asesor_id = :advisorId where id = :id")
                .param("advisorId", advisorId, Types.OTHER)
                .param("id", id, Types.OTHER)
                .update();
    }

    public void updateNextAction(UUID id, String action, LocalDate date) {
        jdbc.sql("update oportunidad set proxima_accion = :action, proxima_accion_fecha = :date where id = :id")
                .param("action", action, Types.VARCHAR)
                .param("date", date, Types.DATE)
                .param("id", id, Types.OTHER)
                .update();
    }

    public void setFinancingLink(UUID id, String tokenHash, Instant issuedAt, Instant expiresAt) {
        jdbc.sql("""
                        update oportunidad
                        set enlace_token_hash = :hash, enlace_emitido_en = :issuedAt, enlace_expira_en = :expiresAt
                        where id = :id
                        """)
                .param("hash", tokenHash)
                .param("issuedAt", odt(issuedAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("expiresAt", odt(expiresAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("id", id, Types.OTHER)
                .update();
    }

    public void markFinancingLinkUsed(UUID id, UUID creditApplicationId, Instant usedAt) {
        jdbc.sql("""
                        update oportunidad
                        set enlace_usado_en = :usedAt, solicitud_credito_id = :solId
                        where id = :id
                        """)
                .param("usedAt", odt(usedAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("solId", creditApplicationId, Types.OTHER)
                .param("id", id, Types.OTHER)
                .update();
    }

    public Optional<OpportunityRecord> findByFinancingLinkHash(String tokenHash) {
        return jdbc.sql("select " + SELECT_FIELDS + " from oportunidad where enlace_token_hash = :hash")
                .param("hash", tokenHash)
                .query(OpportunityRepository::map)
                .optional();
    }

    public List<OpportunityRecord> list(String stage, UUID advisorId, boolean unassignedOnly,
                                        Integer offset, int limit) {
        StringBuilder sql = new StringBuilder("select ").append(SELECT_FIELDS).append(" from oportunidad where 1=1 ");

        if (stage != null && !stage.isBlank()) {
            sql.append(" and etapa = :stage ");
        }
        if (unassignedOnly) {
            sql.append(" and asesor_id is null ");
        } else if (advisorId != null) {
            sql.append(" and asesor_id = :advisorId ");
        }

        sql.append(" order by creado_en desc limit :limit ");
        if (offset != null && offset > 0) {
            sql.append(" offset :offset ");
        }

        var statement = jdbc.sql(sql.toString())
                .param("limit", limit);

        if (stage != null && !stage.isBlank()) {
            statement = statement.param("stage", stage);
        }
        if (!unassignedOnly && advisorId != null) {
            statement = statement.param("advisorId", advisorId, Types.OTHER);
        }
        if (offset != null && offset > 0) {
            statement = statement.param("offset", offset);
        }

        return statement.query(OpportunityRepository::map).list();
    }

    public List<OpportunityRecord> listAll() {
        return jdbc.sql("select " + SELECT_FIELDS + " from oportunidad order by creado_en")
                .query(OpportunityRepository::map)
                .list();
    }

    public List<OpportunityRecord> listByPersonId(UUID personId) {
        return jdbc.sql("select " + SELECT_FIELDS + " from oportunidad where persona_id = :personId order by creado_en desc")
                .param("personId", personId, Types.OTHER)
                .query(OpportunityRepository::map)
                .list();
    }

    private static OpportunityRecord map(ResultSet rs, int rowNum) throws SQLException {
        return new OpportunityRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("persona_id", UUID.class),
                rs.getObject("vehiculo_id", UUID.class),
                rs.getString("modalidad_pago"),
                rs.getBigDecimal("valor_estimado"),
                rs.getString("moneda"),
                rs.getBigDecimal("tasa_bcv"),
                rs.getObject("fecha_tasa", LocalDate.class),
                rs.getString("etapa"),
                rs.getString("motivo_perdida"),
                rs.getString("detalle_perdida"),
                rs.getObject("asesor_id", UUID.class),
                rs.getString("proxima_accion"),
                rs.getObject("proxima_accion_fecha", LocalDate.class),
                rs.getObject("solicitud_credito_id", UUID.class),
                rs.getString("enlace_token_hash"),
                instant(rs, "enlace_emitido_en"),
                instant(rs, "enlace_expira_en"),
                instant(rs, "enlace_usado_en"),
                instant(rs, "cerrado_en"),
                rs.getInt("version"),
                instant(rs, "creado_en"),
                instant(rs, "actualizado_en")
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
