package com.wamma.credit.application;

import java.time.Instant;
import java.util.UUID;

/** Recaudo de una solicitud. {@code fileKey} es la clave en el contenedor privado, no una URL. */
public record CreditDocumentRecord(
        UUID id,
        UUID applicationId,
        String documentType,
        String fileKey,
        String fileName,
        Long fileSizeBytes,
        String mimeType,
        String validationStatus,
        String notes,
        Instant createdAt
) {
}
