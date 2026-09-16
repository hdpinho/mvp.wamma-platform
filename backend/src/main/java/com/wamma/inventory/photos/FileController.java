package com.wamma.inventory.photos;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/** Sirve las fotos guardadas en disco (desarrollo y pruebas). En producción las sirve S3. */
@RestController
@ConditionalOnProperty(name = "wamma.fotos.almacen", havingValue = "disco", matchIfMissing = true)
public class FileController {

    private final DiskPhotoStorage storage;

    public FileController(DiskPhotoStorage storage) {
        this.storage = storage;
    }

    @GetMapping("/archivos/{*key}")
    public ResponseEntity<byte[]> file(@PathVariable String key) {
        String clean = key.startsWith("/") ? key.substring(1) : key;
        try {
            return storage.read(clean)
                    .map(bytes -> ResponseEntity.ok()
                            .contentType(MediaType.IMAGE_JPEG)
                            .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic())
                            .body(bytes))
                    .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
