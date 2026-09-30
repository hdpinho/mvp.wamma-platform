package com.wamma.crm;

import java.time.Instant;
import java.util.UUID;

public record StageHistoryRecord(
        UUID id,
        UUID opportunityId,
        String previousStage,
        String newStage,
        String note,
        UUID actorId,
        Instant createdAt
) {
}
