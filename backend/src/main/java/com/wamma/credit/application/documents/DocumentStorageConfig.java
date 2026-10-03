package com.wamma.credit.application.documents;

import com.wamma.inventory.photos.PhotoStorageProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;

/** Elige el almacén de recaudos según {@code wamma.recaudos.almacen} (D-59). */
@Configuration(proxyBeanMethods = false)
public class DocumentStorageConfig {

    @Bean
    @ConditionalOnProperty(name = "wamma.recaudos.almacen", havingValue = "disco", matchIfMissing = true)
    public DiskDocumentStorage diskDocumentStorage(DocumentStorageProperties properties) {
        return new DiskDocumentStorage(Path.of(properties.disco().carpeta()));
    }

    @Bean
    @ConditionalOnProperty(name = "wamma.recaudos.almacen", havingValue = "s3")
    public S3DocumentStorage s3DocumentStorage(DocumentStorageProperties properties, PhotoStorageProperties photos) {
        return new S3DocumentStorage(photos.s3(), properties.s3() == null ? null : properties.s3().bucket());
    }
}
