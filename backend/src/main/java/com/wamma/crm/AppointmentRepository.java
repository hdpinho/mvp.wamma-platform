package com.wamma.crm;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

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
public class AppointmentRepository {

    private static final String SELECT_COLS = """
            c.id, c.persona_id, c.oportunidad_id, c.vehiculo_id, c.sede_id, c.dia_preferido, c.franja,
            c.estado, c.notas, c.reserva_vence_en, c.creado_en, c.actualizado_en
            """;

    private final JdbcClient jdbc;

    public AppointmentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public UUID insert(UUID personId, UUID opportunityId, UUID vehicleId, UUID siteId,
                       LocalDate preferredDate, String slot, Instant reservationExpiresAt, String notes) {
        return jdbc.sql("""
                        insert into cita_inspeccion (persona_id, oportunidad_id, vehiculo_id, sede_id,
                                                     dia_preferido, franja, reserva_vence_en, notas, estado)
                        values (:personId, :opportunityId, :vehicleId, :siteId,
                                :preferredDate, :slot, :reservationExpiresAt, :notes, 'pendiente')
                        returning id
                        """)
                .param("personId", personId, Types.OTHER)
                .param("opportunityId", opportunityId, Types.OTHER)
                .param("vehicleId", vehicleId, Types.OTHER)
                .param("siteId", siteId, Types.OTHER)
                .param("preferredDate", preferredDate, Types.DATE)
                .param("slot", slot)
                .param("reservationExpiresAt", odt(reservationExpiresAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("notes", notes, Types.VARCHAR)
                .query(UUID.class)
                .single();
    }

    public Optional<AppointmentRecord> findById(UUID id) {
        return jdbc.sql("select " + SELECT_COLS + " from cita_inspeccion c where c.id = :id")
                .param("id", id, Types.OTHER)
                .query(AppointmentRepository::map)
                .optional();
    }

    public Optional<AppointmentRecord> findLatestByOpportunityId(UUID opportunityId) {
        return jdbc.sql("select " + SELECT_COLS + """
                        from cita_inspeccion c
                        where c.oportunidad_id = :oppId
                        order by c.creado_en desc
                        limit 1
                        """)
                .param("oppId", opportunityId, Types.OTHER)
                .query(AppointmentRepository::map)
                .optional();
    }

    private static final String SELECT_VIEW = """
            select c.id, c.persona_id, p.nombre_apellido as persona_nombre, c.oportunidad_id, c.vehiculo_id,
                   v.codigo as vehiculo_codigo, v.marca as vehiculo_marca, v.modelo as vehiculo_modelo,
                   v.anio as vehiculo_anio, c.dia_preferido, c.franja, c.estado, c.notas,
                   c.reserva_vence_en, c.creado_en
            from cita_inspeccion c
            join persona p on p.id = c.persona_id
            join vehiculo v on v.id = c.vehiculo_id
            join oportunidad o on o.id = c.oportunidad_id
            """;

    /**
     * La bandeja de citas. Con {@code visibleTo} (crm.ver_propias) solo las de oportunidades de ese asesor o sin
     * dueño; nulo, todas.
     */
    public List<AppointmentView> listViews(String status, UUID visibleTo) {
        return jdbc.sql(SELECT_VIEW + """
                        where (cast(:status as varchar) is null or c.estado = cast(:status as varchar))
                          and (cast(:visibleTo as uuid) is null
                               or o.asesor_id = cast(:visibleTo as uuid) or o.asesor_id is null)
                        order by c.dia_preferido desc, c.creado_en desc
                        """)
                .param("status", status == null || status.isBlank() ? null : status, Types.VARCHAR)
                .param("visibleTo", visibleTo, Types.OTHER)
                .query(AppointmentRepository::mapView)
                .list();
    }

    /** Las citas de una persona; con {@code visibleTo}, solo las de oportunidades que ese asesor puede ver. */
    public List<AppointmentView> viewsByPerson(UUID personId, UUID visibleTo) {
        return jdbc.sql(SELECT_VIEW + """
                        where c.persona_id = :personId
                          and (cast(:visibleTo as uuid) is null
                               or o.asesor_id = cast(:visibleTo as uuid) or o.asesor_id is null)
                        order by c.creado_en desc
                        """)
                .param("personId", personId, Types.OTHER)
                .param("visibleTo", visibleTo, Types.OTHER)
                .query(AppointmentRepository::mapView)
                .list();
    }

    public void updateStatus(UUID id, String status) {
        jdbc.sql("update cita_inspeccion set estado = :status where id = :id")
                .param("status", status)
                .param("id", id, Types.OTHER)
                .update();
    }

    public void clearReservation(UUID id) {
        jdbc.sql("update cita_inspeccion set reserva_vence_en = null where id = :id")
                .param("id", id, Types.OTHER)
                .update();
    }

    public void updateSchedule(UUID id, LocalDate preferredDate, String slot) {
        jdbc.sql("update cita_inspeccion set dia_preferido = :date, franja = :slot where id = :id")
                .param("date", preferredDate, Types.DATE)
                .param("slot", slot)
                .param("id", id, Types.OTHER)
                .update();
    }

    public List<AppointmentRecord> findExpiredReservations(Instant now) {
        return jdbc.sql("select " + SELECT_COLS + """
                        from cita_inspeccion c
                        where c.reserva_vence_en is not null
                          and c.reserva_vence_en <= :now
                          and c.estado = 'pendiente'
                        """)
                .param("now", odt(now), Types.TIMESTAMP_WITH_TIMEZONE)
                .query(AppointmentRepository::map)
                .list();
    }

    private static AppointmentRecord map(ResultSet rs, int rowNum) throws SQLException {
        return new AppointmentRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("persona_id", UUID.class),
                rs.getObject("oportunidad_id", UUID.class),
                rs.getObject("vehiculo_id", UUID.class),
                rs.getObject("sede_id", UUID.class),
                rs.getObject("dia_preferido", LocalDate.class),
                rs.getString("franja"),
                rs.getString("estado"),
                rs.getString("notas"),
                instant(rs, "reserva_vence_en"),
                instant(rs, "creado_en"),
                instant(rs, "actualizado_en")
        );
    }

    private static AppointmentView mapView(ResultSet rs, int rowNum) throws SQLException {
        return new AppointmentView(
                rs.getObject("id", UUID.class),
                rs.getObject("persona_id", UUID.class),
                rs.getString("persona_nombre"),
                rs.getObject("oportunidad_id", UUID.class),
                rs.getObject("vehiculo_id", UUID.class),
                rs.getString("vehiculo_codigo"),
                rs.getString("vehiculo_marca"),
                rs.getString("vehiculo_modelo"),
                rs.getInt("vehiculo_anio"),
                rs.getObject("dia_preferido", LocalDate.class),
                rs.getString("franja"),
                rs.getString("estado"),
                rs.getString("notas"),
                instant(rs, "reserva_vence_en"),
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
