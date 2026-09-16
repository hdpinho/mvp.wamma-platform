package com.wamma.catalog;

import com.wamma.inventory.InventoryViews.CatalogVehicle;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Vitrina pública, sin sesión (plan 005 §6). Las respuestas se pueden guardar un minuto en
 * caché: un cambio del backoffice tarda como mucho eso en verse.
 */
@RestController
public class CatalogController {

    private static final CacheControl ONE_MINUTE = CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic();

    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/v1/catalogo")
    public ResponseEntity<CatalogService.CatalogPage> list() {
        return ResponseEntity.ok().cacheControl(ONE_MINUTE).body(catalog.list());
    }

    @GetMapping("/v1/catalogo/{codigo}")
    public ResponseEntity<CatalogVehicle> detail(@PathVariable String codigo) {
        return ResponseEntity.ok().cacheControl(ONE_MINUTE).body(catalog.detail(codigo));
    }
}
