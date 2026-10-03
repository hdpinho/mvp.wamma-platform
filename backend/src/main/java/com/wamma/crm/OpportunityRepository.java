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

    /**
     * La oportunidad con todo lo que la pantalla muestra. «Última actividad» es el momento más reciente
     * entre su alta, un cambio de etapa y una nota suya; «entró a la etapa» es el último cambio hacia la
     * etapa actual (spec 010 §8.6).
     */
    private static final String SELECT_VIEW = """
            select o.id, o.persona_id, p.nombre_apellido as persona_nombre,
                   o.vehiculo_id, v.codigo as vehiculo_codigo, v.marca as vehiculo_marca,
                   v.modelo as vehiculo_modelo, v.version as vehiculo_version, v.anio as vehiculo_anio,
                   (select f.clave from publicacion pub
                      join publicacion_foto f on f.publicacion_id = pub.id
                     where pub.vehiculo_id = v.id and f.es_principal limit 1) as foto_clave,
                   o.modalidad_pago, o.valor_estimado, o.moneda, o.tasa_bcv, o.fecha_tasa,
                   o.etapa, o.motivo_perdida, o.detalle_perdida,
                   o.asesor_id, nullif(trim(coalesce(u.nombre, '') || ' ' || coalesce(u.apellido, '')), '') as asesor_nombre,
                   o.proxima_accion, o.proxima_accion_fecha, o.solicitud_credito_id,
                   sc.numero_solicitud as numero_solicitud, sc.estado as estado_credito,
                   (o.enlace_token_hash is not null) as tiene_enlace,
                   o.enlace_emitido_en, o.enlace_expira_en, o.enlace_usado_en,
                   o.cerrado_en, o.version as version_oportunidad, o.creado_en, o.actualizado_en,
                   greatest(
                       o.creado_en,
                       coalesce((select max(h.creado_en) from etapa_historial h
                                  where h.oportunidad_id = o.id and h.etapa_anterior is distinct from h.etapa_nueva), o.creado_en),
                       coalesce((select max(i.ocurrido_en) from interaccion i where i.oportunidad_id = o.id), o.creado_en)
                   ) as ultima_actividad,
                   coalesce((select max(h.creado_en) from etapa_historial h
                              where h.oportunidad_id = o.id and h.etapa_nueva = o.etapa
                                and h.etapa_anterior is distinct from h.etapa_nueva), o.creado_en) as entro_etapa_en
            from oportunidad o
            join persona p on p.id = o.persona_id
            join vehiculo v on v.id = o.vehiculo_id
            left join usuario u on u.id = o.asesor_id
            left join solicitud_credito sc on sc.id = o.solicitud_credito_id
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

    /** Si la persona tiene alguna oportunidad del asesor o sin dueño: lo que ve con crm.ver_propias. */
    public boolean hasOpportunityVisibleTo(UUID personId, UUID advisorId) {
        return jdbc.sql("""
                        select exists (
                            select 1 from oportunidad
                            where persona_id = :personId and (asesor_id = :advisorId or asesor_id is null)
                        )
                        """)
                .param("personId", personId, Types.OTHER)
                .param("advisorId", advisorId, Types.OTHER)
                .query(Boolean.class)
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

    /**
     * Las oportunidades para el embudo, con lo que la pantalla necesita ya resuelto.
     *
     * @param advisorId      solo las de ese asesor (filtro del coordinador)
     * @param unassignedOnly solo las que no tienen dueño
     * @param visibleTo      con {@code crm.ver_propias}: las de ese asesor y las que no tienen dueño; nulo, todas
     */
    public List<OpportunityView> listViews(String stage, UUID advisorId, boolean unassignedOnly, UUID visibleTo,
                                           int limit) {
        StringBuilder where = new StringBuilder(" where 1 = 1 ");
        if (stage != null && !stage.isBlank()) {
            where.append(" and o.etapa = :stage ");
        }
        if (unassignedOnly) {
            where.append(" and o.asesor_id is null ");
        } else if (advisorId != null) {
            where.append(" and o.asesor_id = :advisorId ");
        }
        if (visibleTo != null) {
            where.append(" and (o.asesor_id = :visibleTo or o.asesor_id is null) ");
        }
        JdbcClient.StatementSpec statement = jdbc.sql(SELECT_VIEW + where + " order by o.creado_en desc limit :limit")
                .param("limit", limit);
        if (stage != null && !stage.isBlank()) {
            statement = statement.param("stage", stage);
        }
        if (!unassignedOnly && advisorId != null) {
            statement = statement.param("advisorId", advisorId, Types.OTHER);
        }
        if (visibleTo != null) {
            statement = statement.param("visibleTo", visibleTo, Types.OTHER);
        }
        return statement.query(OpportunityRepository::mapView).list();
    }

    /** Las oportunidades de una persona; con {@code visibleTo}, solo las que ese asesor puede ver. */
    public List<OpportunityView> viewsByPerson(UUID personId, UUID visibleTo) {
        String scope = visibleTo == null ? "" : " and (o.asesor_id = :visibleTo or o.asesor_id is null) ";
        JdbcClient.StatementSpec statement = jdbc
                .sql(SELECT_VIEW + " where o.persona_id = :personId " + scope + " order by o.creado_en desc")
                .param("personId", personId, Types.OTHER);
        if (visibleTo != null) {
            statement = statement.param("visibleTo", visibleTo, Types.OTHER);
        }
        return statement.query(OpportunityRepository::mapView).list();
    }

    public Optional<OpportunityView> viewById(UUID id) {
        return jdbc.sql(SELECT_VIEW + " where o.id = :id")
                .param("id", id, Types.OTHER)
                .query(OpportunityRepository::mapView)
                .optional();
    }

    /** La forma de pago con la que de verdad se cerró la venta puede ser otra que la que pidió el cliente. */
    public void updatePaymentMethod(UUID id, String paymentMethod) {
        jdbc.sql("update oportunidad set modalidad_pago = :method where id = :id")
                .param("method", paymentMethod)
                .param("id", id, Types.OTHER)
                .update();
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

    private static OpportunityView mapView(ResultSet rs, int rowNum) throws SQLException {
        return new OpportunityView(
                rs.getObject("id", UUID.class),
                rs.getObject("persona_id", UUID.class),
                rs.getString("persona_nombre"),
                rs.getObject("vehiculo_id", UUID.class),
                rs.getString("vehiculo_codigo"),
                rs.getString("vehiculo_marca"),
                rs.getString("vehiculo_modelo"),
                rs.getString("vehiculo_version"),
                rs.getInt("vehiculo_anio"),
                rs.getString("foto_clave"),
                rs.getString("modalidad_pago"),
                rs.getBigDecimal("valor_estimado"),
                rs.getString("moneda"),
                rs.getBigDecimal("tasa_bcv"),
                rs.getObject("fecha_tasa", LocalDate.class),
                rs.getString("etapa"),
                rs.getString("motivo_perdida"),
                rs.getString("detalle_perdida"),
                rs.getObject("asesor_id", UUID.class),
                rs.getString("asesor_nombre"),
                rs.getString("proxima_accion"),
                rs.getObject("proxima_accion_fecha", LocalDate.class),
                rs.getObject("solicitud_credito_id", UUID.class),
                rs.getString("numero_solicitud"),
                rs.getString("estado_credito"),
                rs.getBoolean("tiene_enlace"),
                instant(rs, "enlace_emitido_en"),
                instant(rs, "enlace_expira_en"),
                instant(rs, "enlace_usado_en"),
                instant(rs, "cerrado_en"),
                rs.getInt("version_oportunidad"),
                instant(rs, "creado_en"),
                instant(rs, "actualizado_en"),
                instant(rs, "ultima_actividad"),
                instant(rs, "entro_etapa_en")
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
