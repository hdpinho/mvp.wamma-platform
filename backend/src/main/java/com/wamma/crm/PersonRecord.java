package com.wamma.crm;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PersonRecord(
        UUID id,
        String fullName,
        String cedula,
        String email,
        String channel,
        UUID advisorId,
        String state,
        String resolutionCriterion,
        List<PhoneRecord> phones,
        Instant createdAt,
        Instant updatedAt
) {
    public String primaryPhone() {
        if (phones == null || phones.isEmpty()) {
            return null;
        }
        return phones.stream()
                .filter(PhoneRecord::isPrimary)
                .findFirst()
                .map(PhoneRecord::phone)
                .orElse(phones.getFirst().phone());
    }
}
