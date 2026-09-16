package com.wamma.inventory.photos;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

/**
 * Fotos en un almacén compatible con S3: Supabase Storage en producción (D-09). Cambiar de
 * proveedor es cambiar el endpoint y las claves.
 * <p>
 * Las sumas de verificación se envían solo cuando la operación las exige: los proveedores
 * compatibles con S3 no siempre aceptan las que el SDK añade por omisión desde 2025.
 */
public class S3PhotoStorage implements PhotoStorage, AutoCloseable {

    /** Cada foto tiene una clave nueva: se puede guardar en caché indefinidamente. */
    private static final String CACHE_CONTROL = "public, max-age=31536000, immutable";

    private final S3Client client;
    private final String bucket;
    private final String publicBase;

    public S3PhotoStorage(PhotoStorageProperties.S3 config, String publicBase) {
        List<String> missing = new ArrayList<>();
        if (config == null || isBlank(config.endpoint())) missing.add("WAMMA_S3_ENDPOINT");
        if (config == null || isBlank(config.region())) missing.add("WAMMA_S3_REGION");
        if (config == null || isBlank(config.bucket())) missing.add("WAMMA_S3_BUCKET");
        if (config == null || isBlank(config.accessKey())) missing.add("WAMMA_S3_ACCESS_KEY");
        if (config == null || isBlank(config.secretKey())) missing.add("WAMMA_S3_SECRET_KEY");
        if (isBlank(publicBase)) missing.add("WAMMA_FOTOS_URL_PUBLICA");
        if (!missing.isEmpty()) {
            throw new IllegalStateException("El almacén de fotos S3 necesita las variables " + String.join(", ", missing));
        }
        this.bucket = config.bucket();
        this.publicBase = publicBase;
        this.client = S3Client.builder()
                .endpointOverride(URI.create(config.endpoint()))
                .region(Region.of(config.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(config.accessKey(), config.secretKey())))
                .forcePathStyle(true)
                // Cuerpo en una sola pieza, sin la codificación por trozos propia de AWS.
                .serviceConfiguration(S3Configuration.builder().chunkedEncodingEnabled(false).build())
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        PhotoStorage.requireSafeKey(key);
        client.putObject(PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        .cacheControl(CACHE_CONTROL)
                        .build(),
                RequestBody.fromBytes(content));
    }

    @Override
    public void delete(String key) {
        PhotoStorage.requireSafeKey(key);
        client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    @Override
    public String publicUrl(String key) {
        return PhotoStorage.joinUrl(publicBase, key);
    }

    @Override
    public void close() {
        client.close();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
