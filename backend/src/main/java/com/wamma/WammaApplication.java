package com.wamma;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

/**
 * Punto de entrada de la plataforma WAMMA.
 * <p>
 * Monolito modular Spring Boot. Cada paquete bajo {@code com.wamma.*}
 * representa un módulo de dominio alineado a los specs (001–010).
 * <p>
 * Sin el usuario en memoria que Spring genera por defecto: la identidad la gestiona
 * el módulo 001 ({@code com.wamma.platform}).
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@ConfigurationPropertiesScan
public class WammaApplication {

    public static void main(String[] args) {
        SpringApplication.run(WammaApplication.class, args);
    }
}
