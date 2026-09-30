package com.wamma.credit.application;

import java.time.Instant;
import java.util.UUID;

public record CreditDocumentRecord(
        UUID id,
        UUID applicationId,
        String documentType,
        String fileUrl,
        String fileName,
        Long fileSizeBytes,
        String mimeType,
        String validationStatus,
        String notes,
        Instant createdAt
) {
}
