package com.wamma.credit.application.documents;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Recaudos en una carpeta local (desarrollo y pruebas). Es otra carpeta que la de las fotos y
 * ningún controlador la sirve tal cual: solo sale por el enlace firmado.
 */
public class DiskDocumentStorage implements DocumentStorage {

    private final Path root;

    public DiskDocumentStorage(Path root) {
        this.root = root.toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo crear la carpeta de recaudos " + this.root, e);
        }
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, content);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar el recaudo", e);
        }
    }

    @Override
    public Optional<byte[]> read(String key) {
        Path file = resolve(key);
        if (!Files.isRegularFile(file)) {
            return Optional.empty();
        }
        try {
            return Optional.of(Files.readAllBytes(file));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer el recaudo", e);
        }
    }

    @Override
    public boolean exists(String key) {
        return Files.isRegularFile(resolve(key));
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo borrar el recaudo", e);
        }
    }

    private Path resolve(String key) {
        DocumentStorage.requireValidKey(key);
        Path file = root.resolve(key).normalize();
        if (!file.startsWith(root)) {
            throw new IllegalArgumentException("Clave de recaudo fuera de la carpeta");
        }
        return file;
    }
}
