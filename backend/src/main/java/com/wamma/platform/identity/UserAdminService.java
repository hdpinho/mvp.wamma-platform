package com.wamma.platform.identity;

import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.audit.Masking;
import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.auth.RecoveryCodes;
import com.wamma.platform.auth.SessionService;
import com.wamma.platform.web.ApiException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Administración de usuarios (RF-001.1, RF-001.4; plan 001 §4.3). Toda operación deja rastro
 * en la bitácora, y siempre queda al menos un administrador activo.
 */
@Service
public class UserAdminService {

    public static final String USERNAME_PATTERN = "^[a-z0-9._-]{3,50}$";

    public record UserView(UUID id, String usuario, String nombre, String apellido, String correo, String estado,
                           List<String> roles, boolean segundoFactorActivo, Instant bloqueadoHasta,
                           Instant ultimoIngreso, Instant creadoEn) {
    }

    public record CreatedUser(UserView usuario, String contrasenaTemporal) {
    }

    public record Changes(String firstName, String lastName, String email, String status, Set<Role> roles) {
    }

    private final UserRepository users;
    private final SessionService sessions;
    private final RecoveryCodes recoveryCodes;
    private final PasswordEncoder encoder;
    private final PasswordPolicy policy;
    private final AuditLog audit;
    private final Clock clock;

    public UserAdminService(UserRepository users, SessionService sessions, RecoveryCodes recoveryCodes,
                            PasswordEncoder encoder, PasswordPolicy policy, AuditLog audit, Clock clock) {
        this.users = users;
        this.sessions = sessions;
        this.recoveryCodes = recoveryCodes;
        this.encoder = encoder;
        this.policy = policy;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<UserView> list() {
        return users.findAll().stream().map(this::view).toList();
    }

    @Transactional
    public CreatedUser create(String username, String firstName, String lastName, String email, Set<Role> roles) {
        String normalized = username.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches(USERNAME_PATTERN)) {
            throw ApiException.badRequest("Nombre de usuario no válido",
                    "Usa de 3 a 50 caracteres: letras minúsculas, números, punto, guion o guion bajo.");
        }
        if (roles == null || roles.isEmpty()) {
            throw ApiException.badRequest("Faltan roles", "Asigna al menos un rol.");
        }
        String temporary = TemporaryPasswords.generate(policy, normalized);
        Instant now = clock.instant();
        UUID id;
        try {
            id = users.insert(normalized, email.trim(), firstName.trim(), lastName.trim(), encoder.encode(temporary), now);
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("Usuario duplicado", "Ya existe un usuario con ese nombre de usuario o correo.");
        }
        Set<String> codes = codes(roles);
        users.replaceRoles(id, codes, CurrentUser.id().orElse(null), now);

        Map<String, Object> after = new LinkedHashMap<>();
        after.put("usuario", normalized);
        after.put("nombre", firstName.trim() + " " + lastName.trim());
        after.put("correo", Masking.email(email.trim()));
        after.put("roles", codes);
        audit.record("usuario.creado", "usuario", id, null, after);
        codes.forEach(role -> audit.record("rol.asignado", "usuario", id, null, Map.of("rol", role)));
        return new CreatedUser(view(users.findById(id).orElseThrow()), temporary);
    }

    @Transactional
    public UserView update(UUID id, Changes changes) {
        UserAccount user = users.findById(id).orElseThrow(() -> ApiException.notFound("El usuario no existe."));
        Set<String> currentRoles = new TreeSet<>(users.rolesOf(id));
        Set<String> newRoles = changes.roles() == null ? currentRoles : codes(changes.roles());
        String newStatus = changes.status() == null ? user.status() : changes.status();

        if (!newStatus.equals(UserAccount.ACTIVE) && !newStatus.equals(UserAccount.INACTIVE)) {
            throw ApiException.badRequest("Estado no válido", "El estado debe ser activo o inactivo.");
        }
        if (newRoles.isEmpty()) {
            throw ApiException.badRequest("Faltan roles", "Un usuario debe tener al menos un rol.");
        }
        boolean deactivating = user.active() && newStatus.equals(UserAccount.INACTIVE);
        boolean losingAdmin = currentRoles.contains(Role.ADMINISTRADOR.name()) && !newRoles.contains(Role.ADMINISTRADOR.name());
        if (deactivating && CurrentUser.id().map(id::equals).orElse(false)) {
            throw ApiException.conflict("Operación no permitida", "No puedes desactivar tu propia cuenta.");
        }
        if ((deactivating || losingAdmin) && user.active() && currentRoles.contains(Role.ADMINISTRADOR.name())
                && users.countActiveAdmins() <= 1) {
            throw ApiException.conflict("Operación no permitida", "Debe quedar al menos un administrador activo.");
        }

        String firstName = changes.firstName() == null ? user.firstName() : changes.firstName().trim();
        String lastName = changes.lastName() == null ? user.lastName() : changes.lastName().trim();
        String email = changes.email() == null ? user.email() : changes.email().trim();
        if (!firstName.equals(user.firstName()) || !lastName.equals(user.lastName()) || !email.equals(user.email())) {
            try {
                users.updateProfile(id, firstName, lastName, email);
            } catch (DuplicateKeyException e) {
                throw ApiException.conflict("Correo duplicado", "Ya existe un usuario con ese correo.");
            }
            Map<String, Object> before = new LinkedHashMap<>();
            before.put("nombre", user.firstName() + " " + user.lastName());
            before.put("correo", Masking.email(user.email()));
            Map<String, Object> after = new LinkedHashMap<>();
            after.put("nombre", firstName + " " + lastName);
            after.put("correo", Masking.email(email));
            audit.record("usuario.actualizado", "usuario", id, before, after);
        }
        if (!newStatus.equals(user.status())) {
            users.updateStatus(id, newStatus);
            if (deactivating) {
                sessions.revokeAll(id, "desactivacion", null);
            }
            audit.record(deactivating ? "usuario.desactivado" : "usuario.reactivado", "usuario", id,
                    Map.of("estado", user.status()), Map.of("estado", newStatus));
        }
        if (!newRoles.equals(currentRoles)) {
            users.replaceRoles(id, newRoles, CurrentUser.id().orElse(null), clock.instant());
            newRoles.stream().filter(role -> !currentRoles.contains(role))
                    .forEach(role -> audit.record("rol.asignado", "usuario", id, null, Map.of("rol", role)));
            currentRoles.stream().filter(role -> !newRoles.contains(role))
                    .forEach(role -> audit.record("rol.retirado", "usuario", id, Map.of("rol", role), null));
        }
        return view(users.findById(id).orElseThrow());
    }

    /** Contraseña temporal nueva, que se muestra una vez; desbloquea y cierra las sesiones del usuario. */
    @Transactional
    public String resetPassword(UUID id) {
        UserAccount user = users.findById(id).orElseThrow(() -> ApiException.notFound("El usuario no existe."));
        String temporary = TemporaryPasswords.generate(policy, user.username());
        users.updatePassword(id, encoder.encode(temporary), true, clock.instant());
        users.clearFailures(id);
        sessions.revokeAll(id, "restablecimiento", null);
        audit.record("contrasena.restablecida", "usuario", id, null, null);
        return temporary;
    }

    /** Borra el segundo factor y los códigos: el usuario lo reactiva en su siguiente ingreso. */
    @Transactional
    public void resetTotp(UUID id) {
        users.findById(id).orElseThrow(() -> ApiException.notFound("El usuario no existe."));
        users.clearTotp(id);
        recoveryCodes.deleteAll(id);
        sessions.revokeAll(id, "restablecimiento", null);
        audit.record("2fa.restablecido", "usuario", id, null, null);
    }

    private UserView view(UserAccount user) {
        return new UserView(user.id(), user.username(), user.firstName(), user.lastName(), user.email(), user.status(),
                users.rolesOf(user.id()), user.totpActive(), user.lockedAt(clock.instant()) ? user.lockedUntil() : null,
                user.lastLogin(), user.createdAt());
    }

    private static Set<String> codes(Set<Role> roles) {
        return roles.stream().filter(Objects::nonNull).map(Role::name).collect(Collectors.toCollection(TreeSet::new));
    }
}
