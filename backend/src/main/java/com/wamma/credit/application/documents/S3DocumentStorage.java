package com.wamma.credit.application.documents;

import com.wamma.inventory.photos.PhotoStorageProperties;
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
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Recaudos en un contenedor PRIVADO compatible con S3: Supabase Storage en producción (D-59).
 * Usa las mismas credenciales y el mismo endpoint que las fotos, pero otro contenedor, que debe
 * crearse como privado. Cambiar de proveedor es cambiar el endpoint y las claves (Principio II).
 */
public class S3DocumentStorage implements DocumentStorage, AutoCloseable {

    /** Ni el navegador ni un intermediario guardan copia de un recaudo. */
    private static final String CACHE_CONTROL = "private, no-store";

    private final S3Client client;
    private final String bucket;

    public S3DocumentStorage(PhotoStorageProperties.S3 s3, String bucket) {
        PhotoStorageProperties.S3 connection = s3 != null ? s3 : new PhotoStorageProperties.S3(null, null, null, null, null);
        List<String> missing = new ArrayList<>();
        if (isBlank(connection.endpoint())) missing.add("WAMMA_S3_ENDPOINT");
        if (isBlank(connection.region())) missing.add("WAMMA_S3_REGION");
        if (isBlank(connection.accessKey())) missing.add("WAMMA_S3_ACCESS_KEY");
        if (isBlank(connection.secretKey())) missing.add("WAMMA_S3_SECRET_KEY");
        if (isBlank(bucket)) missing.add("WAMMA_S3_BUCKET_RECAUDOS");
        if (!missing.isEmpty()) {
            throw new IllegalStateException("El almacén de recaudos S3 necesita las variables " + String.join(", ", missing));
        }
        if (connection.bucket() != null && connection.bucket().equals(bucket)) {
            throw new IllegalStateException("Los recaudos no pueden compartir el contenedor público de las fotos ("
                    + bucket + "): usa WAMMA_S3_BUCKET_RECAUDOS con un contenedor privado");
        }
        this.bucket = bucket;
        this.client = S3Client.builder()
                .endpointOverride(URI.create(connection.endpoint()))
                .region(Region.of(connection.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(connection.accessKey(), connection.secretKey())))
                .forcePathStyle(true)
                .serviceConfiguration(S3Configuration.builder().chunkedEncodingEnabled(false).build())
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        DocumentStorage.requireValidKey(key);
        client.putObject(PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        .cacheControl(CACHE_CONTROL)
                        .build(),
                RequestBody.fromBytes(content));
    }

    @Override
    public Optional<byte[]> read(String key) {
        DocumentStorage.requireValidKey(key);
        try {
            return Optional.of(client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build())
                    .asByteArray());
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return Optional.empty();
            }
            throw e;
        }
    }

    @Override
    public boolean exists(String key) {
        DocumentStorage.requireValidKey(key);
        try {
            client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
            return true;
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return false;
            }
            throw e;
        }
    }

    @Override
    public void delete(String key) {
        DocumentStorage.requireValidKey(key);
        client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    @Override
    public void close() {
        client.close();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
