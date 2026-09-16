package com.wamma.platform.auth;

import com.wamma.platform.config.SecurityProperties;
import com.wamma.platform.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Límite de intentos de ingreso por IP (plan 001, S6), además del bloqueo por cuenta: frena
 * a quien prueba muchas cuentas distintas desde la misma conexión. Vive en memoria, así que
 * un reinicio lo pone a cero; el bloqueo por cuenta, que está en la base, no.
 */
@Component
public class LoginRateLimiter {

    private static final int CLEANUP_THRESHOLD = 10_000;

    private final Map<String, Deque<Instant>> attempts = new ConcurrentHashMap<>();
    private final SecurityProperties properties;
    private final Clock clock;

    public LoginRateLimiter(SecurityProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    public void check(String ip) {
        if (ip == null) {
            return;
        }
        Instant now = clock.instant();
        Instant cutoff = now.minus(properties.loginIpWindow());
        if (attempts.size() > CLEANUP_THRESHOLD) {
            attempts.values().removeIf(queue -> {
                synchronized (queue) {
                    return queue.isEmpty() || queue.peekLast().isBefore(cutoff);
                }
            });
        }
        Deque<Instant> queue = attempts.computeIfAbsent(ip, key -> new ArrayDeque<>());
        synchronized (queue) {
            while (!queue.isEmpty() && queue.peekFirst().isBefore(cutoff)) {
                queue.pollFirst();
            }
            if (queue.size() >= properties.loginAttemptsPerIp()) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos",
                        "Hubo demasiados intentos de ingreso desde tu conexión. Espera unos minutos.");
            }
            queue.addLast(now);
        }
    }
}
