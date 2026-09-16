package com.wamma.inventory.photos;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;

/** Elige el almacén de fotos según {@code wamma.fotos.almacen} (plan 005 §5). */
@Configuration(proxyBeanMethods = false)
public class PhotoStorageConfig {

    @Bean
    @ConditionalOnProperty(name = "wamma.fotos.almacen", havingValue = "disco", matchIfMissing = true)
    public DiskPhotoStorage diskPhotoStorage(PhotoStorageProperties properties) {
        return new DiskPhotoStorage(Path.of(properties.disco().carpeta()), properties.urlPublica());
    }

    @Bean
    @ConditionalOnProperty(name = "wamma.fotos.almacen", havingValue = "s3")
    public S3PhotoStorage s3PhotoStorage(PhotoStorageProperties properties) {
        return new S3PhotoStorage(properties.s3(), properties.urlPublica());
    }
}
