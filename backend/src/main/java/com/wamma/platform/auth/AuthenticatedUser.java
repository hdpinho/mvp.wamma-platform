package com.wamma.platform.auth;

import java.util.UUID;

/** Quién hace la petición: usuario, sesión y nivel de la sesión (plan 001 §4.2). */
public record AuthenticatedUser(UUID userId, UUID sessionId, String username, SessionService.Level level) {
}
