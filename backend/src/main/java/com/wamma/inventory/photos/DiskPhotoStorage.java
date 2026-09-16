package com.wamma.inventory.photos;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Fotos en una carpeta local, servidas por el propio backend en {@code /archivos/**}. Solo
 * para desarrollo y pruebas: el disco de Render se borra en cada despliegue (plan 005 §11).
 */
public class DiskPhotoStorage implements PhotoStorage {

    private final Path root;
    private final String publicBase;

    public DiskPhotoStorage(Path root, String publicBase) {
        this.root = root.toAbsolutePath().normalize();
        this.publicBase = publicBase;
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo crear la carpeta de fotos " + this.root, e);
        }
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar la foto " + key, e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo borrar la foto " + key, e);
        }
    }

    @Override
    public String publicUrl(String key) {
        return PhotoStorage.joinUrl(publicBase, key);
    }

    public Optional<byte[]> read(String key) {
        Path file = resolve(key);
        if (!Files.isRegularFile(file)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readAllBytes(file));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer la foto " + key, e);
        }
    }

    private Path resolve(String key) {
        PhotoStorage.requireSafeKey(key);
        Path file = root.resolve(key).normalize();
        if (!file.startsWith(root)) {
            throw new IllegalArgumentException("Clave de foto fuera de la carpeta: " + key);
        }
        return file;
    }
}
