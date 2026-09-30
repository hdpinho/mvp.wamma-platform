package com.wamma.crm;

import com.wamma.crm.domain.CedulaNormalizer;
import com.wamma.crm.domain.PhoneNormalizer;
import com.wamma.platform.web.ApiException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
public class CrmPersonController {

    public record PersonSummaryDto(
            UUID id,
            String nombreApellido,
            String cedula,
            String telefonoPrincipal,
            String correo,
            String canalOrigen,
            String estado,
            Instant creadoEn
    ) {
    }

    public record PersonDetailDto(
            UUID id,
            String nombreApellido,
            String cedula,
            String correo,
            String canalOrigen,
            UUID asesorId,
            String estado,
            String criterioResolucion,
            List<PhoneRecord> telefonos,
            List<OpportunityRecord> oportunidades,
            List<AppointmentRecord> citas,
            List<InteractionRecord> interacciones,
            Instant creadoEn,
            Instant actualizadoEn
    ) {
    }

    public record CreateInteractionRequest(
            String canal,
            String direccion,
            String nota,
            UUID oportunidadId
    ) {
    }

    private final PersonRepository persons;
    private final OpportunityRepository opportunities;
    private final AppointmentRepository appointments;
    private final InteractionService interactionService;

    public CrmPersonController(PersonRepository persons, OpportunityRepository opportunities,
                               AppointmentRepository appointments, InteractionService interactionService) {
        this.persons = persons;
        this.opportunities = opportunities;
        this.appointments = appointments;
        this.interactionService = interactionService;
    }

    @GetMapping("/v1/crm/personas")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<List<PersonSummaryDto>> searchPersons(
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "50") int limit) {
        String query = q != null ? q.trim() : null;
        String possibleCedula = null;
        String possiblePhone = null;

        if (query != null && !query.isBlank()) {
            try {
                possibleCedula = CedulaNormalizer.canonical(query);
            } catch (Exception ignored) {
            }
            try {
                possiblePhone = PhoneNormalizer.mobileE164(query);
            } catch (Exception ignored) {
            }
        }

        List<PersonRecord> list = persons.search(query, possibleCedula, possiblePhone, limit);
        List<PersonSummaryDto> dtos = list.stream()
                .map(p -> new PersonSummaryDto(
                        p.id(),
                        p.fullName(),
                        p.cedula(),
                        p.primaryPhone(),
                        p.email(),
                        p.channel(),
                        p.state(),
                        p.createdAt()
                ))
                .toList();

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/v1/crm/personas/{id}")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<PersonDetailDto> getPerson(@PathVariable UUID id) {
        PersonRecord person = persons.findById(id)
                .orElseThrow(() -> ApiException.notFound("Persona no encontrada", "No existe la persona " + id));

        List<OpportunityRecord> opps = opportunities.listByPersonId(id);
        List<AppointmentRecord> citas = appointments.listByPersonId(id);
        List<InteractionRecord> inters = interactionService.listByPersonId(id);

        return ResponseEntity.ok(new PersonDetailDto(
                person.id(),
                person.fullName(),
                person.cedula(),
                person.email(),
                person.channel(),
                person.advisorId(),
                person.state(),
                person.resolutionCriterion(),
                person.phones(),
                opps,
                citas,
                inters,
                person.createdAt(),
                person.updatedAt()
        ));
    }

    @PostMapping("/v1/crm/personas/{id}/interacciones")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<InteractionRecord> createInteraction(
            @PathVariable UUID id,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody CreateInteractionRequest request) {
        InteractionRecord record = interactionService.register(
                id,
                request.oportunidadId(),
                request.canal(),
                request.direccion(),
                request.nota(),
                idempotencyKey
        );

        return ResponseEntity.ok(record);
    }
}
