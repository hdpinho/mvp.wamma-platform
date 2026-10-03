package com.wamma.platform.web;

import org.springframework.http.HttpStatus;

/**
 * Petición rechazada por llegar antes de tiempo. Lleva los segundos que faltan para que se
 * admita la siguiente, que {@link GlobalExceptionHandler} publica en la cabecera
 * {@code Retry-After}.
 * <p>
 * El servidor responde de inmediato y <strong>no espera</strong> (D-40): decir cuánto falta
 * es responsabilidad de la respuesta, no del hilo que la atiende. Dormir el hilo daría el
 * mismo efecto al cliente y regalaría a un atacante la forma de agotar el servidor.
 */
public class RateLimitedException extends ApiException {

    private final long retryAfterSeconds;

    public RateLimitedException(long retryAfterSeconds, String detail) {
        super(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos", detail);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
