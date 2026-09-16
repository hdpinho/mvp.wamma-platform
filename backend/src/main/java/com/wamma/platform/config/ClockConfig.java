package com.wamma.platform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Reloj único de la aplicación. Sesiones, bloqueos y TOTP lo usan en lugar de
 * {@code Instant.now()}, para que las pruebas puedan adelantar el tiempo.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
