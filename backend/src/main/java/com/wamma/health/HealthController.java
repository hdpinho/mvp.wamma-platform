package com.wamma.health;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Endpoint de comprobación de salud para Render y balanceadores de carga.
 * Devuelve 200 OK cuando el servicio Spring Boot está activo.
 */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "wamma-backend",
                "version", "0.1.0-SNAPSHOT",
                "timestamp", Instant.now().toString()
        ));
    }

    @GetMapping("/")
    public ResponseEntity<Map<String, Object>> root() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "wamma-backend",
                "health", "/api/health"
        ));
    }
}
