package com.wamma.risk;

import java.time.Instant;
import java.util.UUID;

public record AmlAlertRecord(
        UUID id,
        UUID applicationId,
        UUID personId,
        String matchRule,
        String severity,
        String listOrigin,
        UUID reviewedBy,
        String resolution,
        String notes,
        Instant resolvedAt,
        Instant createdAt
) {
}
