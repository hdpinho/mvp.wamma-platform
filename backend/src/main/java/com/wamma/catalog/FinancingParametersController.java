package com.wamma.catalog;

import com.wamma.platform.web.ApiException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Parámetros de financiamiento para la vitrina, sin sesión (spec 011 §6.2).
 * <p>
 * Existe para que el frontend deje de hablar directamente con la API de datos de Supabase:
 * esa ruta ataba la plataforma a un proveedor en el camino crítico del simulador de cuotas
 * (Principio II). Los parámetros se cambian en base de datos y se ven sin redesplegar.
 * <p>
 * Si no hay ninguna fila activa responde error, nunca una respuesta vacía ni valores de
 * respaldo: una cuota calculada con parámetros inventados es peor que no mostrar cuota.
 */
@RestController
public class FinancingParametersController {

    /** Un minuto, como el resto de la vitrina: un cambio tarda como mucho eso en verse. */
    private static final CacheControl ONE_MINUTE = CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic();

    private final FinancingParametersRepository repository;

    public FinancingParametersController(FinancingParametersRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/v1/parametros-financiamiento")
    public ResponseEntity<FinancingParameters> current() {
        FinancingParameters parameters = repository.current()
                .orElseThrow(() -> new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Parámetros de financiamiento no disponibles",
                        "No hay parámetros de financiamiento activos. El simulador no puede "
                                + "calcular cuotas hasta que se registren."));
        return ResponseEntity.ok().cacheControl(ONE_MINUTE).body(parameters);
    }
}
