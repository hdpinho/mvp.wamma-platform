package com.wamma.crm;

import java.time.Instant;
import java.util.UUID;

public record InteractionRecord(
        UUID id,
        UUID personId,
        UUID opportunityId,
        String channel,
        String direction,
        String note,
        UUID authorId,
        UUID correctsInteractionId,
        Instant occurredAt,
        String idempotencyKey,
        Instant createdAt
) {
}
