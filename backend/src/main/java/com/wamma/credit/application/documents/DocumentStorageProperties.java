package com.wamma.credit.application.documents;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * Configuración del almacén privado de recaudos (D-59).
 *
 * @param almacen        {@code disco} (local y pruebas) o {@code s3} (producción)
 * @param vigenciaEnlace cuánto dura un enlace firmado para abrir un recaudo
 */
@ConfigurationProperties("wamma.recaudos")
public record DocumentStorageProperties(String almacen, Disk disco, S3 s3, Duration vigenciaEnlace) {

    public DocumentStorageProperties {
        if (vigenciaEnlace == null) {
            vigenciaEnlace = Duration.ofMinutes(5);
        }
    }

    public record Disk(String carpeta) {
    }

    /** Solo el contenedor: el endpoint y las claves son los de {@code wamma.fotos.s3}. */
    public record S3(String bucket) {
    }
}
