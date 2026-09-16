package com.wamma.platform.identity;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Acceso a {@code usuario} y a sus roles y permisos, con SQL explícito (plan 001 §2). */
@Repository
public class UserRepository {

    private static final String COLUMNS = """
            id, nombre_usuario, email, nombre, apellido, estado, password_hash, totp_secreto_cifrado,
            totp_activado_en, totp_ultimo_paso, intentos_fallidos, bloqueado_hasta, debe_cambiar_contrasena,
            ultimo_login, creado_en
            """;

    private final JdbcClient jdbc;

    public UserRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long count() {
        return jdbc.sql("select count(*) from usuario").query(Long.class).single();
    }

    public Optional<UserAccount> findByUsername(String username) {
        return jdbc.sql("select " + COLUMNS + " from usuario where nombre_usuario = :username")
                .param("username", username)
                .query(UserRepository::map)
                .optional();
    }

    public Optional<UserAccount> findById(UUID id) {
        return jdbc.sql("select " + COLUMNS + " from usuario where id = :id")
                .param("id", id, Types.OTHER)
                .query(UserRepository::map)
                .optional();
    }

    public List<UserAccount> findAll() {
        return jdbc.sql("select " + COLUMNS + " from usuario order by nombre_usuario")
                .query(UserRepository::map)
                .list();
    }

    public UUID insert(String username, String email, String firstName, String lastName, String passwordHash, Instant now) {
        return jdbc.sql("""
                        insert into usuario (nombre_usuario, email, password_hash, nombre, apellido, estado,
                                             debe_cambiar_contrasena, creado_en, actualizado_en)
                        values (:username, :email, :hash, :firstName, :lastName, 'activo', true, :now, :now)
                        returning id
                        """)
                .param("username", username)
                .param("email", email)
                .param("hash", passwordHash)
                .param("firstName", firstName)
                .param("lastName", lastName)
                .param("now", odt(now), Types.TIMESTAMP_WITH_TIMEZONE)
                .query(UUID.class)
                .single();
    }

    /**
     * Suma un intento fallido. Al llegar al máximo, bloquea hasta {@code lockUntil} y pone el
     * contador a cero. Devuelve si la cuenta quedó bloqueada con este intento.
     */
    public boolean recordFailure(UUID id, int maxAttempts, Instant lockUntil) {
        return jdbc.sql("""
                        update usuario set
                            bloqueado_hasta = case when intentos_fallidos + 1 >= :max then :lockUntil else bloqueado_hasta end,
                            intentos_fallidos = case when intentos_fallidos + 1 >= :max then 0 else intentos_fallidos + 1 end
                        where id = :id
                        returning bloqueado_hasta = :lockUntil
                        """)
                .param("max", maxAttempts, Types.INTEGER)
                .param("lockUntil", odt(lockUntil), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("id", id, Types.OTHER)
                .query(Boolean.class)
                .optional()
                .orElse(false);
    }

    public void clearFailures(UUID id) {
        jdbc.sql("update usuario set intentos_fallidos = 0, bloqueado_hasta = null where id = :id")
                .param("id", id, Types.OTHER)
                .update();
    }

    public void updatePassword(UUID id, String passwordHash, boolean mustChange, Instant now) {
        jdbc.sql("""
                        update usuario set password_hash = :hash, debe_cambiar_contrasena = :mustChange,
                                           contrasena_cambiada_en = :now
                        where id = :id
                        """)
                .param("hash", passwordHash)
                .param("mustChange", mustChange, Types.BOOLEAN)
                .param("now", odt(now), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("id", id, Types.OTHER)
                .update();
    }

    /** Guarda un secreto nuevo, todavía sin activar: la activación queda en curso. */
    public void setPendingTotp(UUID id, byte[] encryptedSecret) {
        jdbc.sql("""
                        update usuario set totp_secreto_cifrado = :secret, totp_activado_en = null, totp_ultimo_paso = null
                        where id = :id
                        """)
                .param("secret", encryptedSecret, Types.BINARY)
                .param("id", id, Types.OTHER)
                .update();
    }

    public void activateTotp(UUID id, long step, Instant now) {
        jdbc.sql("update usuario set totp_activado_en = :now, totp_ultimo_paso = :step where id = :id")
                .param("now", odt(now), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("step", step, Types.BIGINT)
                .param("id", id, Types.OTHER)
                .update();
    }

    /**
     * Avanza el último paso TOTP usado, solo si el nuevo es posterior. Atómico: dos usos
     * simultáneos del mismo código no pueden pasar los dos (CA-001.6).
     */
    public boolean advanceTotpStep(UUID id, long step) {
        return jdbc.sql("""
                        update usuario set totp_ultimo_paso = :step
                        where id = :id and (totp_ultimo_paso is null or totp_ultimo_paso < :step)
                        """)
                .param("step", step, Types.BIGINT)
                .param("id", id, Types.OTHER)
                .update() == 1;
    }

    public void clearTotp(UUID id) {
        jdbc.sql("""
                        update usuario set totp_secreto_cifrado = null, totp_activado_en = null, totp_ultimo_paso = null
                        where id = :id
                        """)
                .param("id", id, Types.OTHER)
                .update();
    }

    public void touchLastLogin(UUID id, Instant now) {
        jdbc.sql("update usuario set ultimo_login = :now where id = :id")
                .param("now", odt(now), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("id", id, Types.OTHER)
                .update();
    }

    public void updateProfile(UUID id, String firstName, String lastName, String email) {
        jdbc.sql("update usuario set nombre = :firstName, apellido = :lastName, email = :email where id = :id")
                .param("firstName", firstName)
                .param("lastName", lastName)
                .param("email", email)
                .param("id", id, Types.OTHER)
                .update();
    }

    public void updateStatus(UUID id, String status) {
        jdbc.sql("update usuario set estado = :status where id = :id")
                .param("status", status)
                .param("id", id, Types.OTHER)
                .update();
    }

    public List<String> rolesOf(UUID id) {
        return jdbc.sql("""
                        select r.codigo from usuario_rol ur join rol r on r.id = ur.rol_id
                        where ur.usuario_id = :id order by r.codigo
                        """)
                .param("id", id, Types.OTHER)
                .query(String.class)
                .list();
    }

    public Set<String> permissionsOf(UUID id) {
        return new LinkedHashSet<>(jdbc.sql("""
                        select distinct p.codigo
                        from usuario_rol ur
                        join rol_permiso rp on rp.rol_id = ur.rol_id
                        join permiso p on p.id = rp.permiso_id
                        where ur.usuario_id = :id
                        order by p.codigo
                        """)
                .param("id", id, Types.OTHER)
                .query(String.class)
                .list());
    }

    /** Sustituye los roles del usuario. Los códigos deben existir en {@code rol}. */
    public void replaceRoles(UUID id, Set<String> roleCodes, UUID assignedBy, Instant now) {
        jdbc.sql("delete from usuario_rol where usuario_id = :id")
                .param("id", id, Types.OTHER)
                .update();
        for (String code : roleCodes) {
            jdbc.sql("""
                            insert into usuario_rol (usuario_id, rol_id, asignado_en, asignado_por)
                            select :id, r.id, :now, :assignedBy from rol r where r.codigo = :code
                            """)
                    .param("id", id, Types.OTHER)
                    .param("now", odt(now), Types.TIMESTAMP_WITH_TIMEZONE)
                    .param("assignedBy", assignedBy, Types.OTHER)
                    .param("code", code)
                    .update();
        }
    }

    public long countActiveAdmins() {
        return jdbc.sql("""
                        select count(distinct u.id)
                        from usuario u
                        join usuario_rol ur on ur.usuario_id = u.id
                        join rol r on r.id = ur.rol_id
                        where r.codigo = 'ADMINISTRADOR' and u.estado = 'activo'
                        """)
                .query(Long.class)
                .single();
    }

    private static UserAccount map(ResultSet rs, int rowNum) throws SQLException {
        return new UserAccount(
                rs.getObject("id", UUID.class),
                rs.getString("nombre_usuario"),
                rs.getString("email"),
                rs.getString("nombre"),
                rs.getString("apellido"),
                rs.getString("estado"),
                rs.getString("password_hash"),
                rs.getBytes("totp_secreto_cifrado"),
                instant(rs, "totp_activado_en"),
                (Long) rs.getObject("totp_ultimo_paso"),
                rs.getInt("intentos_fallidos"),
                instant(rs, "bloqueado_hasta"),
                rs.getBoolean("debe_cambiar_contrasena"),
                instant(rs, "ultimo_login"),
                instant(rs, "creado_en"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private static OffsetDateTime odt(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
