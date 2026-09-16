package com.wamma.inventory.photos;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración del almacén de fotos (plan 005 §5).
 *
 * @param almacen    {@code disco} (local y pruebas) o {@code s3} (producción)
 * @param urlPublica base de las direcciones públicas de las fotos
 */
@ConfigurationProperties("wamma.fotos")
public record PhotoStorageProperties(String almacen, String urlPublica, Disk disco, S3 s3) {

    public record Disk(String carpeta) {
    }

    public record S3(String endpoint, String region, String bucket, String accessKey, String secretKey) {
    }
}
