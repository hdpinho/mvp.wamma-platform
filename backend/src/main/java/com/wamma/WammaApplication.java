package com.wamma;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada de la plataforma WAMMA.
 * <p>
 * Monolito modular Spring Boot. Cada paquete bajo {@code com.wamma.*}
 * representa un módulo de dominio alineado a los specs (001–010).
 */
@SpringBootApplication
public class WammaApplication {

    public static void main(String[] args) {
        SpringApplication.run(WammaApplication.class, args);
    }
}
