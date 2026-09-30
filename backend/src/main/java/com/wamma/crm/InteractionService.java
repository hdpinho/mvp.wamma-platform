package com.wamma.crm;

import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class InteractionService {

    private static final Set<String> VALID_CHANNELS = Set.of("whatsapp", "llamada", "correo", "presencial");
    private static final Set<String> VALID_DIRECTIONS = Set.of("entrante", "saliente");

    private final InteractionRepository interactions;
    private final PersonRepository persons;
    private final AuditLog audit;
    private final Clock clock;

    public InteractionService(InteractionRepository interactions, PersonRepository persons,
                              AuditLog audit, Clock clock) {
        this.interactions = interactions;
        this.persons = persons;
        this.audit = audit;
        this.clock = clock;
    }

    public InteractionRecord register(UUID personId, UUID opportunityId, String channel, String direction,
                                      String note, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<InteractionRecord> existing = interactions.findByIdempotencyKey(idempotencyKey.trim());
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        if (persons.findById(personId).isEmpty()) {
            throw ApiException.notFound("Persona no encontrada", "No existe la persona " + personId);
        }

        if (channel == null || !VALID_CHANNELS.contains(channel.toLowerCase())) {
            throw ApiException.unprocessable("Canal inválido", "El canal debe ser whatsapp, llamada, correo o presencial.");
        }
        if (direction == null || !VALID_DIRECTIONS.contains(direction.toLowerCase())) {
            throw ApiException.unprocessable("Dirección inválida", "La dirección debe ser entrante o saliente.");
        }
        if (note == null || note.isBlank()) {
            throw ApiException.unprocessable("Nota requerida", "Indica el contenido de la interacción.");
        }

        UUID authorId = CurrentUser.id().orElse(null);
        Instant now = clock.instant();

        UUID id = interactions.insert(personId, opportunityId, channel.toLowerCase(), direction.toLowerCase(),
                note.trim(), authorId, null, now, idempotencyKey);

        audit.record("interaccion.registrada", "interaccion", id,
                Map.of("persona_id", personId.toString(), "canal", channel.toLowerCase()));

        return new InteractionRecord(id, personId, opportunityId, channel.toLowerCase(), direction.toLowerCase(),
                note.trim(), authorId, null, now, idempotencyKey, now);
    }

    public List<InteractionRecord> listByPersonId(UUID personId) {
        return interactions.listByPersonId(personId);
    }
}
