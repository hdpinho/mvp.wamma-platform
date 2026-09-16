package com.wamma.platform.identity;

import com.wamma.platform.audit.AuditLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Crea al primer administrador al arrancar, si la base no tiene usuarios (RF-001.12, D-07).
 * Nace con {@code debe_cambiar_contrasena}, y en su primer ingreso activa el 2FA. En los
 * arranques siguientes no hace nada (CA-001.13).
 */
@Component
public class BootstrapAdmin implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdmin.class);

    private final UserRepository users;
    private final BootstrapAdminProperties properties;
    private final PasswordEncoder encoder;
    private final PasswordPolicy policy;
    private final AuditLog audit;
    private final Clock clock;

    public BootstrapAdmin(UserRepository users, BootstrapAdminProperties properties, PasswordEncoder encoder,
                          PasswordPolicy policy, AuditLog audit, Clock clock) {
        this.users = users;
        this.properties = properties;
        this.encoder = encoder;
        this.policy = policy;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.count() > 0) {
            return;
        }
        if (!properties.complete()) {
            log.warn("La base no tiene usuarios y faltan variables WAMMA_ADMIN_*: no se creó el administrador inicial.");
            return;
        }
        String username = properties.username().trim().toLowerCase(Locale.ROOT);
        if (!username.matches(UserAdminService.USERNAME_PATTERN)) {
            log.error("WAMMA_ADMIN_USUARIO no es un nombre de usuario válido (3 a 50 caracteres: a-z, 0-9, punto, guion).");
            return;
        }
        Optional<String> violation = policy.violation(properties.initialPassword(), username);
        if (violation.isPresent()) {
            log.error("WAMMA_ADMIN_CONTRASENA_INICIAL no cumple la política: {}", violation.get());
            return;
        }
        Instant now = clock.instant();
        UUID id = users.insert(username, properties.email().trim(), properties.firstName().trim(),
                properties.lastName().trim(), encoder.encode(properties.initialPassword()), now);
        users.replaceRoles(id, Set.of(Role.ADMINISTRADOR.name()), null, now);

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("usuario", username);
        detail.put("roles", List.of(Role.ADMINISTRADOR.name()));
        detail.put("origen", "arranque");
        audit.recordAs(null, "usuario.creado", "usuario", id, null, detail);
        log.info("Administrador inicial creado: {}. Debe cambiar la contraseña y activar el 2FA en su primer ingreso.", username);
    }
}
