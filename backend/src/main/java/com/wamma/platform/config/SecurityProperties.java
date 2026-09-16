package com.wamma.platform.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Parámetros de seguridad del módulo 001. Los valores de política los aprobó el PO
 * (D-24) y viven en {@code application.yml}; las claves llegan por variables de entorno.
 *
 * @param encryptionKey      clave AES-256 en Base64 ({@code WAMMA_CLAVE_CIFRADO})
 * @param indexKey           clave HMAC del índice ciego en Base64 ({@code WAMMA_CLAVE_INDICE})
 * @param sessionIdleTimeout inactividad tras la cual una sesión vence
 * @param sessionMaxDuration duración máxima de una sesión, haya o no actividad
 * @param partialSessionTtl  vida de la sesión parcial, entre la contraseña y el 2FA
 * @param passwordMinLength  longitud mínima de contraseña
 * @param maxFailedAttempts  intentos fallidos seguidos antes del bloqueo
 * @param lockoutDuration    duración del bloqueo
 * @param loginAttemptsPerIp intentos de ingreso admitidos por IP en la ventana
 * @param loginIpWindow      ventana del límite por IP
 */
@ConfigurationProperties("wamma.security")
public record SecurityProperties(
        String encryptionKey,
        String indexKey,
        Duration sessionIdleTimeout,
        Duration sessionMaxDuration,
        Duration partialSessionTtl,
        int passwordMinLength,
        int maxFailedAttempts,
        Duration lockoutDuration,
        int loginAttemptsPerIp,
        Duration loginIpWindow) {
}
