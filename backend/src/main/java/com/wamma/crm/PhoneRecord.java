package com.wamma.crm;

import java.time.Instant;
import java.util.UUID;

public record PhoneRecord(
        UUID id,
        UUID personId,
        String phone,
        boolean isPrimary,
        Instant createdAt
) {
}
