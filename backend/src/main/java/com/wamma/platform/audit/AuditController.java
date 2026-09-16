package com.wamma.platform.audit;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Consulta de la bitácora (RF-001.10) para el auditor y el administrador. Solo lectura: la
 * tabla es append-only y el motor rechaza cualquier modificación.
 */
@RestController
public class AuditController {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 200;
    /** Los filtros por día se interpretan en la hora de Venezuela. */
    private static final ZoneId VENEZUELA = ZoneId.of("America/Caracas");

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public AuditController(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public record AuditEventView(UUID id, Instant fecha, String usuario, String accion, String entidad,
                                 UUID entidadId, Map<String, Object> antes, Map<String, Object> despues, String ip) {
    }

    public record AuditPage(List<AuditEventView> eventos, String siguienteCursor) {
    }

    @GetMapping("/v1/auditoria")
    @PreAuthorize("hasAuthority('auditoria.ver')")
    public AuditPage list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) String usuario,
            @RequestParam(required = false) String entidad,
            @RequestParam(required = false) String accion,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limite) {
        int limit = limite == null ? DEFAULT_LIMIT : Math.clamp(limite, 1, MAX_LIMIT);

        StringBuilder sql = new StringBuilder("""
                select e.id, e.creado_en, u.nombre_usuario, e.accion, e.entidad, e.entidad_id,
                       e.antes::text as antes, e.despues::text as despues, e.ip_origen
                from auditoria_evento e
                left join usuario u on u.id = e.actor_id
                where true
                """);
        List<Object[]> params = new ArrayList<>();
        if (desde != null) {
            sql.append(" and e.creado_en >= :desde");
            params.add(new Object[]{"desde", odt(desde.atStartOfDay(VENEZUELA).toInstant()), Types.TIMESTAMP_WITH_TIMEZONE});
        }
        if (hasta != null) {
            sql.append(" and e.creado_en < :hasta");
            params.add(new Object[]{"hasta", odt(hasta.plusDays(1).atStartOfDay(VENEZUELA).toInstant()), Types.TIMESTAMP_WITH_TIMEZONE});
        }
        if (usuario != null && !usuario.isBlank()) {
            sql.append(" and u.nombre_usuario = :usuario");
            params.add(new Object[]{"usuario", usuario.trim().toLowerCase(), Types.VARCHAR});
        }
        if (entidad != null && !entidad.isBlank()) {
            sql.append(" and e.entidad = :entidad");
            params.add(new Object[]{"entidad", entidad.trim(), Types.VARCHAR});
        }
        if (accion != null && !accion.isBlank()) {
            sql.append(" and e.accion = :accion");
            params.add(new Object[]{"accion", accion.trim(), Types.VARCHAR});
        }
        Cursor after = Cursor.decode(cursor);
        if (after != null) {
            sql.append(" and (e.creado_en, e.id) < (:cursorFecha, :cursorId)");
            params.add(new Object[]{"cursorFecha", odt(after.at()), Types.TIMESTAMP_WITH_TIMEZONE});
            params.add(new Object[]{"cursorId", after.id(), Types.OTHER});
        }
        sql.append(" order by e.creado_en desc, e.id desc limit :limit");
        params.add(new Object[]{"limit", limit + 1, Types.INTEGER});

        JdbcClient.StatementSpec statement = jdbc.sql(sql.toString());
        for (Object[] p : params) {
            statement = statement.param((String) p[0], p[1], (Integer) p[2]);
        }
        List<AuditEventView> rows = statement.query(this::map).list();

        String next = null;
        if (rows.size() > limit) {
            rows = rows.subList(0, limit);
            AuditEventView last = rows.getLast();
            next = new Cursor(last.fecha(), last.id()).encode();
        }
        return new AuditPage(rows, next);
    }

    @SuppressWarnings("unchecked")
    private AuditEventView map(ResultSet rs, int rowNum) throws SQLException {
        String before = rs.getString("antes");
        String after = rs.getString("despues");
        return new AuditEventView(
                rs.getObject("id", UUID.class),
                rs.getObject("creado_en", OffsetDateTime.class).toInstant(),
                rs.getString("nombre_usuario"),
                rs.getString("accion"),
                rs.getString("entidad"),
                rs.getObject("entidad_id", UUID.class),
                before == null ? null : json.readValue(before, Map.class),
                after == null ? null : json.readValue(after, Map.class),
                rs.getString("ip_origen"));
    }

    private static OffsetDateTime odt(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    /** Paginación por cursor: fecha e id del último evento de la página anterior. */
    private record Cursor(Instant at, UUID id) {

        String encode() {
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString((at.toString() + "|" + id).getBytes(StandardCharsets.UTF_8));
        }

        static Cursor decode(String value) {
            if (value == null || value.isBlank()) {
                return null;
            }
            try {
                String[] parts = new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8).split("\\|");
                return new Cursor(Instant.parse(parts[0]), UUID.fromString(parts[1]));
            } catch (RuntimeException e) {
                return null;
            }
        }
    }
}
