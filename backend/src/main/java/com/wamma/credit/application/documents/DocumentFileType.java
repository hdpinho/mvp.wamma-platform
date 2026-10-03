package com.wamma.credit.application.documents;

import java.util.Arrays;
import java.util.Optional;

/**
 * Tipos de archivo admitidos como recaudo. Se reconocen por su firma binaria, no por el nombre
 * ni por el tipo que declara el navegador: un ejecutable renombrado a {@code .pdf} no pasa.
 */
public enum DocumentFileType {

    PDF("application/pdf", "pdf", new byte[]{'%', 'P', 'D', 'F', '-'}),
    JPEG("image/jpeg", "jpg", new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}),
    PNG("image/png", "png", new byte[]{(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'});

    private final String mimeType;
    private final String extension;
    private final byte[] signature;

    DocumentFileType(String mimeType, String extension, byte[] signature) {
        this.mimeType = mimeType;
        this.extension = extension;
        this.signature = signature;
    }

    public String mimeType() {
        return mimeType;
    }

    public String extension() {
        return extension;
    }

    public static Optional<DocumentFileType> detect(byte[] content) {
        if (content == null) {
            return Optional.empty();
        }
        return Arrays.stream(values())
                .filter(type -> content.length >= type.signature.length
                        && Arrays.equals(content, 0, type.signature.length, type.signature, 0, type.signature.length))
                .findFirst();
    }
}
