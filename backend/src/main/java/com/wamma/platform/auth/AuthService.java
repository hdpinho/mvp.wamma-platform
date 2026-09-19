package com.wamma.platform.auth;

import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.config.SecurityProperties;
import com.wamma.platform.crypto.FieldCipher;
import com.wamma.platform.identity.PasswordPolicy;
import com.wamma.platform.identity.UserAccount;
import com.wamma.platform.identity.UserRepository;
import com.wamma.platform.web.ApiException;
import com.wamma.platform.web.RequestInfo;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.Set;
import java.util.UUID;

/**
 * Ingreso al backoffice en dos pasos (plan 001 §4): contraseña y luego segundo factor.
 * <p>
 * Los métodos que pueden fallar confirman igual su transacción ({@code noRollbackFor}): un
 * intento fallido debe quedar contado y registrado aunque la respuesta sea un error.
 */
@Service
public class AuthService {

    /** Qué pide el ingreso a continuación. */
    public enum NextStep { CAMBIAR_CONTRASENA, ACTIVAR_2FA, CODIGO_2FA }

    public record PasswordStep(String temporaryToken, NextStep next, Instant expiresAt) {
    }

    public record TotpSetup(String secret, String otpauthUri) {
    }

    public record Profile(UUID id, String usuario, String nombre, String apellido, String correo,
                          List<String> roles, Set<String> permisos) {
    }

    public record CompletedLogin(String token, Instant expiresAt, Profile usuario, List<String> recoveryCodes) {
    }

    /** Resultado del segundo factor: una sesión completa, o el paso siguiente (tras un código de recuperación). */
    public record SecondFactorOutcome(CompletedLogin login, NextStep next) {
    }

    private static final String TOTP_CONTEXT = "usuario.totp_secreto";
    private static final String ISSUER = "WAMMA";

    private final UserRepository users;
    private final SessionService sessions;
    private final RecoveryCodes recoveryCodes;
    private final PasswordEncoder encoder;
    private final PasswordPolicy policy;
    private final FieldCipher cipher;
    private final AuditLog audit;
    private final LoginRateLimiter rateLimiter;
    private final SecurityProperties properties;
    private final Clock clock;
    /** Hash de referencia: un usuario inexistente tarda lo mismo que una contraseña errónea. */
    private final String referenceHash;

    public AuthService(UserRepository users, SessionService sessions, RecoveryCodes recoveryCodes,
                       PasswordEncoder encoder, PasswordPolicy policy, FieldCipher cipher, AuditLog audit,
                       LoginRateLimiter rateLimiter, SecurityProperties properties, Clock clock) {
        this.users = users;
        this.sessions = sessions;
        this.recoveryCodes = recoveryCodes;
        this.encoder = encoder;
        this.policy = policy;
        this.cipher = cipher;
        this.audit = audit;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
        this.clock = clock;
        this.referenceHash = encoder.encode("referencia-para-usuarios-inexistentes");
    }

    @Transactional(noRollbackFor = ApiException.class)
    public PasswordStep login(String username, String password) {
        String normalized = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        String ip = RequestInfo.clientIp();
        rateLimiter.check(ip, normalized);
        Instant now = clock.instant();
        Optional<UserAccount> found = users.findByUsername(normalized);

        if (found.isEmpty()) {
            encoder.matches(password == null ? "" : password, referenceHash);
            audit.recordAs(null, "sesion.fallida", "sesion", null, null,
                    detail("motivo", "credenciales", "usuario", truncate(normalized, 50)));
            rateLimiter.recordFailure(ip, normalized);
            throw invalidCredentials();
        }
        UserAccount user = found.get();
        if (!user.active()) {
            audit.recordAs(null, "sesion.fallida", "usuario", user.id(), null, detail("motivo", "usuario_inactivo"));
            rateLimiter.recordFailure(ip, normalized);
            throw invalidCredentials();
        }
        if (user.lockedAt(now)) {
            audit.recordAs(null, "sesion.fallida", "usuario", user.id(), null, detail("motivo", "cuenta_bloqueada"));
            rateLimiter.recordFailure(ip, normalized);
            throw locked();
        }
        if (password == null || !encoder.matches(password, user.passwordHash())) {
            boolean lockedNow = users.recordFailure(user.id(), properties.maxFailedAttempts(),
                    now.plus(properties.lockoutDuration()));
            audit.recordAs(null, "sesion.fallida", "usuario", user.id(), null,
                    detail("motivo", "credenciales", "bloqueo_iniciado", lockedNow));
            rateLimiter.recordFailure(ip, normalized);
            throw lockedNow ? locked() : invalidCredentials();
        }

        users.clearFailures(user.id());
        rateLimiter.recordSuccess(ip, normalized);
        SessionService.Issued partial = sessions.issue(user.id(), SessionService.Level.PARCIAL);
        return new PasswordStep(partial.token(), nextStep(user), partial.expiresAt());
    }

    @Transactional
    public NextStep changeInitialPassword(AuthenticatedUser partial, String newPassword) {
        UserAccount user = requireUser(partial);
        if (!user.mustChangePassword()) {
            throw ApiException.conflict("Paso no disponible", "Tu contraseña no necesita cambiarse ahora.");
        }
        validateNewPassword(user, newPassword);
        users.updatePassword(user.id(), encoder.encode(newPassword), false, clock.instant());
        audit.recordAs(user.id(), "contrasena.cambiada", "usuario", user.id(), null, detail("motivo", "primer_ingreso"));
        return user.totpActive() ? NextStep.CODIGO_2FA : NextStep.ACTIVAR_2FA;
    }

    @Transactional
    public TotpSetup startTotpActivation(AuthenticatedUser partial) {
        UserAccount user = requireUser(partial);
        if (user.mustChangePassword()) {
            throw ApiException.conflict("Paso no disponible", "Primero cambia tu contraseña.");
        }
        if (user.totpActive()) {
            throw ApiException.conflict("Paso no disponible", "El segundo factor ya está activo.");
        }
        byte[] secret = Totp.newSecret();
        String base32 = Totp.base32(secret);
        users.setPendingTotp(user.id(), cipher.encrypt(base32, TOTP_CONTEXT));
        return new TotpSetup(base32, Totp.otpauthUri(ISSUER, user.username(), secret));
    }

    @Transactional(noRollbackFor = ApiException.class)
    public CompletedLogin confirmTotpActivation(AuthenticatedUser partial, String code) {
        UserAccount user = requireUser(partial);
        if (user.mustChangePassword() || user.totpActive() || user.totpSecretEncrypted() == null) {
            throw ApiException.conflict("Paso no disponible", "Inicia la activación del segundo factor.");
        }
        byte[] secret = Totp.fromBase32(cipher.decrypt(user.totpSecretEncrypted(), TOTP_CONTEXT));
        OptionalLong step = Totp.verify(secret, code, clock.instant(), null);
        if (step.isEmpty()) {
            throw secondFactorFailure(user, partial, "activacion_2fa");
        }
        Instant now = clock.instant();
        users.activateTotp(user.id(), step.getAsLong(), now);
        users.clearFailures(user.id());
        List<String> codes = recoveryCodes.regenerate(user.id());
        audit.recordAs(user.id(), "2fa.activado", "usuario", user.id(), null, null);
        return completeLogin(user, partial, codes);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public SecondFactorOutcome verifySecondFactor(AuthenticatedUser partial, String code, String recoveryCode) {
        UserAccount user = requireUser(partial);
        if (user.mustChangePassword() || !user.totpActive()) {
            throw ApiException.conflict("Paso no disponible", "Completa primero los pasos anteriores del ingreso.");
        }

        if (recoveryCode != null && !recoveryCode.isBlank()) {
            if (!recoveryCodes.consume(user.id(), recoveryCode)) {
                throw secondFactorFailure(user, partial, "codigo_recuperacion");
            }
            // El código de recuperación sirve una vez y obliga a registrar un autenticador nuevo.
            users.clearFailures(user.id());
            users.clearTotp(user.id());
            audit.recordAs(user.id(), "2fa.recuperacion_usada", "usuario", user.id(), null, null);
            return new SecondFactorOutcome(null, NextStep.ACTIVAR_2FA);
        }

        byte[] secret = Totp.fromBase32(cipher.decrypt(user.totpSecretEncrypted(), TOTP_CONTEXT));
        OptionalLong step = Totp.verify(secret, code, clock.instant(), user.totpLastStep());
        if (step.isEmpty() || !users.advanceTotpStep(user.id(), step.getAsLong())) {
            throw secondFactorFailure(user, partial, "codigo_2fa");
        }
        users.clearFailures(user.id());
        return new SecondFactorOutcome(completeLogin(user, partial, List.of()), null);
    }

    @Transactional
    public void logout(AuthenticatedUser current) {
        sessions.revoke(current.sessionId(), "salida");
        audit.recordAs(current.userId(), "sesion.cerrada", "sesion", current.sessionId(), null, null);
    }

    @Transactional(readOnly = true)
    public Profile profile(UUID userId) {
        UserAccount user = users.findById(userId).orElseThrow(AuthService::sessionGone);
        return new Profile(user.id(), user.username(), user.firstName(), user.lastName(), user.email(),
                users.rolesOf(user.id()), users.permissionsOf(user.id()));
    }

    /** Cambio de contraseña propio: pide la actual y cierra las demás sesiones del usuario. */
    @Transactional
    public void changeOwnPassword(AuthenticatedUser current, String currentPassword, String newPassword) {
        UserAccount user = requireUser(current);
        if (currentPassword == null || !encoder.matches(currentPassword, user.passwordHash())) {
            throw ApiException.badRequest("Contraseña actual incorrecta", "La contraseña actual no coincide.");
        }
        validateNewPassword(user, newPassword);
        users.updatePassword(user.id(), encoder.encode(newPassword), false, clock.instant());
        sessions.revokeAll(user.id(), "cambio_contrasena", current.sessionId());
        audit.recordAs(user.id(), "contrasena.cambiada", "usuario", user.id(), null, detail("motivo", "cambio_propio"));
    }

    private CompletedLogin completeLogin(UserAccount user, AuthenticatedUser partial, List<String> codes) {
        Instant now = clock.instant();
        sessions.revoke(partial.sessionId(), "ascenso");
        SessionService.Issued full = sessions.issue(user.id(), SessionService.Level.COMPLETA);
        users.touchLastLogin(user.id(), now);
        audit.recordAs(user.id(), "sesion.iniciada", "sesion", full.sessionId(), null, null);
        return new CompletedLogin(full.token(), full.expiresAt(), profile(user.id()), codes);
    }

    private ApiException secondFactorFailure(UserAccount user, AuthenticatedUser partial, String reason) {
        Instant now = clock.instant();
        boolean lockedNow = users.recordFailure(user.id(), properties.maxFailedAttempts(),
                now.plus(properties.lockoutDuration()));
        audit.recordAs(null, "sesion.fallida", "usuario", user.id(), null,
                detail("motivo", reason, "bloqueo_iniciado", lockedNow));
        if (lockedNow) {
            sessions.revoke(partial.sessionId(), "salida");
            return locked();
        }
        return ApiException.badRequest("Código incorrecto", "El código no es válido o ya venció.");
    }

    private void validateNewPassword(UserAccount user, String newPassword) {
        policy.violation(newPassword, user.username()).ifPresent(message -> {
            throw ApiException.badRequest("Contraseña no válida", message);
        });
        if (encoder.matches(newPassword, user.passwordHash())) {
            throw ApiException.badRequest("Contraseña no válida", "La nueva contraseña debe ser distinta de la actual.");
        }
    }

    private UserAccount requireUser(AuthenticatedUser principal) {
        UserAccount user = users.findById(principal.userId()).orElseThrow(AuthService::sessionGone);
        if (!user.active()) {
            throw sessionGone();
        }
        return user;
    }

    private static NextStep nextStep(UserAccount user) {
        if (user.mustChangePassword()) {
            return NextStep.CAMBIAR_CONTRASENA;
        }
        return user.totpActive() ? NextStep.CODIGO_2FA : NextStep.ACTIVAR_2FA;
    }

    private static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Ingreso rechazado", "Usuario o contraseña incorrectos.");
    }

    private static ApiException locked() {
        return new ApiException(HttpStatus.LOCKED, "Cuenta bloqueada temporalmente",
                "Demasiados intentos fallidos. Intenta de nuevo más tarde.");
    }

    private static ApiException sessionGone() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "No autenticado", "Inicia sesión para continuar.");
    }

    private static Map<String, Object> detail(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            map.put((String) keyValues[i], keyValues[i + 1]);
        }
        return map;
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }
}
