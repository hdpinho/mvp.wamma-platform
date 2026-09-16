package com.wamma.platform.auth;

import com.wamma.platform.config.SecurityProperties;
import com.wamma.platform.web.RequestInfo;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Types;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Sesiones con token opaco (plan 001 §5). El token viaja en la cabecera {@code Authorization}
 * y en la base solo se guarda su hash SHA-256: una copia de la base no permite suplantar a
 * nadie. Revocar es inmediato, que es lo que exige CA-001.8.
 */
@Service
public class SessionService {

    /** Nivel de la sesión: {@code parcial} entre la contraseña y el 2FA, {@code completa} después. */
    public enum Level {
        PARCIAL("parcial"),
        COMPLETA("completa");

        private final String code;

        Level(String code) {
            this.code = code;
        }

        public String code() {
            return code;
        }

        static Level of(String code) {
            return code.equals(PARCIAL.code) ? PARCIAL : COMPLETA;
        }
    }

    public record Issued(String token, UUID sessionId, Instant expiresAt) {
    }

    public record Active(UUID sessionId, UUID userId, String username, Level level) {
    }

    /** Para no escribir en cada petición, la actividad se anota como mucho una vez por minuto. */
    private static final Duration TOUCH_INTERVAL = Duration.ofMinutes(1);
    private static final int TOKEN_BYTES = 32;

    private final JdbcClient jdbc;
    private final SecurityProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public SessionService(JdbcClient jdbc, SecurityProperties properties, Clock clock) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.clock = clock;
    }

    public Issued issue(UUID userId, Level level) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(level == Level.PARCIAL
                ? properties.partialSessionTtl()
                : properties.sessionMaxDuration());
        byte[] raw = new byte[TOKEN_BYTES];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        UUID sessionId = jdbc.sql("""
                        insert into sesion (usuario_id, token_hash, nivel, creada_en, ultimo_uso_en, expira_en, ip_origen, agente_usuario)
                        values (:userId, :hash, :level, :now, :now, :expiresAt, :ip, :userAgent)
                        returning id
                        """)
                .param("userId", userId, Types.OTHER)
                .param("hash", hash(token))
                .param("level", level.code())
                .param("now", odt(now), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("expiresAt", odt(expiresAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("ip", RequestInfo.clientIp(), Types.VARCHAR)
                .param("userAgent", RequestInfo.userAgent(), Types.VARCHAR)
                .query(UUID.class)
                .single();
        return new Issued(token, sessionId, expiresAt);
    }

    /**
     * Resuelve un token a su sesión si sigue valiendo: no revocada ni vencida, sin superar la
     * inactividad permitida (solo las completas) y con el usuario activo.
     */
    public Optional<Active> authenticate(String token) {
        if (token == null || token.isBlank() || token.length() > 100) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        Optional<Row> found = jdbc.sql("""
                        select s.id, s.usuario_id, s.nivel, s.ultimo_uso_en, s.expira_en, s.revocada_en,
                               u.estado, u.nombre_usuario
                        from sesion s
                        join usuario u on u.id = s.usuario_id
                        where s.token_hash = :hash
                        """)
                .param("hash", hash(token))
                .query((rs, n) -> new Row(
                        rs.getObject("id", UUID.class),
                        rs.getObject("usuario_id", UUID.class),
                        Level.of(rs.getString("nivel")),
                        rs.getObject("ultimo_uso_en", OffsetDateTime.class).toInstant(),
                        rs.getObject("expira_en", OffsetDateTime.class).toInstant(),
                        rs.getObject("revocada_en", OffsetDateTime.class),
                        rs.getString("estado"),
                        rs.getString("nombre_usuario")))
                .optional();
        if (found.isEmpty()) {
            return Optional.empty();
        }
        Row row = found.get();
        if (row.revokedAt() != null || !row.expiresAt().isAfter(now) || !"activo".equals(row.status())) {
            return Optional.empty();
        }
        if (row.level() == Level.COMPLETA) {
            if (row.lastUsed().plus(properties.sessionIdleTimeout()).isBefore(now)) {
                return Optional.empty();
            }
            if (row.lastUsed().plus(TOUCH_INTERVAL).isBefore(now)) {
                jdbc.sql("update sesion set ultimo_uso_en = :now where id = :id")
                        .param("now", odt(now), Types.TIMESTAMP_WITH_TIMEZONE)
                        .param("id", row.id(), Types.OTHER)
                        .update();
            }
        }
        return Optional.of(new Active(row.id(), row.userId(), row.username(), row.level()));
    }

    public void revoke(UUID sessionId, String reason) {
        jdbc.sql("""
                        update sesion set revocada_en = :now, motivo_revocacion = :reason
                        where id = :id and revocada_en is null
                        """)
                .param("now", odt(clock.instant()), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("reason", reason)
                .param("id", sessionId, Types.OTHER)
                .update();
    }

    /** Revoca todas las sesiones abiertas de un usuario, salvo la indicada (puede ser nula). */
    public void revokeAll(UUID userId, String reason, UUID exceptSessionId) {
        jdbc.sql("""
                        update sesion set revocada_en = :now, motivo_revocacion = :reason
                        where usuario_id = :userId and revocada_en is null
                          and (cast(:except as uuid) is null or id <> cast(:except as uuid))
                        """)
                .param("now", odt(clock.instant()), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("reason", reason)
                .param("userId", userId, Types.OTHER)
                .param("except", exceptSessionId, Types.OTHER)
                .update();
    }

    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    private static OffsetDateTime odt(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private record Row(UUID id, UUID userId, Level level, Instant lastUsed, Instant expiresAt,
                       OffsetDateTime revokedAt, String status, String username) {
    }
}
