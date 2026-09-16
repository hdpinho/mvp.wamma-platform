package com.wamma.platform.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

/**
 * Acceso al usuario de la petición en curso. Es la interfaz con la que los módulos de negocio
 * saben quién hace una acción (plan 001 §2).
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Optional<AuthenticatedUser> get() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user
                ? Optional.of(user)
                : Optional.empty();
    }

    public static Optional<UUID> id() {
        return get().map(AuthenticatedUser::userId);
    }

    /** Si el usuario de la petición tiene un permiso (plan 001 §9), para reglas dentro de un servicio. */
    public static boolean hasAuthority(String authority) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(granted -> authority.equals(granted.getAuthority()));
    }
}
