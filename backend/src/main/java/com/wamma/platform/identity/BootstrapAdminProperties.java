package com.wamma.platform.identity;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Datos del primer administrador (D-07), desde variables de entorno {@code WAMMA_ADMIN_*}.
 * Solo se usan si la base no tiene ningún usuario. Nunca van en el repositorio.
 */
@ConfigurationProperties("wamma.bootstrap-admin")
public record BootstrapAdminProperties(
        String username,
        String firstName,
        String lastName,
        String email,
        String initialPassword) {

    public boolean complete() {
        return notBlank(username) && notBlank(firstName) && notBlank(lastName)
                && notBlank(email) && notBlank(initialPassword);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
