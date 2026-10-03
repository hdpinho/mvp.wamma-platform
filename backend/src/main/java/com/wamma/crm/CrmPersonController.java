package com.wamma.crm;

import com.wamma.crm.CrmDtos.AppointmentDto;
import com.wamma.crm.CrmDtos.InteractionDto;
import com.wamma.crm.CrmDtos.OpportunityDto;
import com.wamma.crm.CrmDtos.PersonDetailDto;
import com.wamma.crm.CrmDtos.PersonSummaryDto;
import com.wamma.crm.CrmDtos.StageEventDto;
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
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
public class CrmPersonController {

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
    private final StageHistoryRepository stageHistories;
    private final InteractionService interactionService;
    private final CrmAccess access;
    private final CrmMapper mapper;

    public CrmPersonController(PersonRepository persons, OpportunityRepository opportunities,
                               AppointmentRepository appointments, StageHistoryRepository stageHistories,
                               InteractionService interactionService, CrmAccess access, CrmMapper mapper) {
        this.persons = persons;
        this.opportunities = opportunities;
        this.appointments = appointments;
        this.stageHistories = stageHistories;
        this.interactionService = interactionService;
        this.access = access;
        this.mapper = mapper;
    }

    @GetMapping("/v1/crm/personas")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<List<PersonSummaryDto>> searchPersons(
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "500") int limit) {
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

        List<PersonRecord> list = persons.search(query, possibleCedula, possiblePhone,
                Math.clamp(limit, 1, 1000), access.advisorScope());
        Map<UUID, Instant> activity = persons.lastActivity(list.stream().map(PersonRecord::id).toList());
        return ResponseEntity.ok(list.stream()
                .map(p -> mapper.personSummary(p, activity.get(p.id())))
                .toList());
    }

    /**
     * Ficha 360. Con {@code crm.ver_propias} muestra solo lo del asesor y lo que no tiene dueño: las oportunidades
     * ajenas de la misma persona no aparecen, ni sus citas ni sus notas.
     */
    @GetMapping("/v1/crm/personas/{id}")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<PersonDetailDto> getPerson(@PathVariable UUID id) {
        PersonRecord person = persons.findById(id)
                .orElseThrow(() -> ApiException.notFound("Persona no encontrada", "No existe la persona " + id));

        // Un registro fusionado ya no tiene nada propio: todo pasó a la persona vigente. Se responde solo con dónde
        // encontrarla (y solo si quien pregunta puede ver a esa persona), sin repetir datos de contacto.
        if ("fusionado".equals(person.state())) {
            UUID survivor = persons.survivorOf(id)
                    .orElseThrow(() -> ApiException.notFound("Persona no encontrada", "No existe la persona " + id));
            access.requireVisiblePerson(survivor);
            return ResponseEntity.ok(new PersonDetailDto(
                    person.id(), person.fullName(), null, null, person.channel(), null, person.state(),
                    person.resolutionCriterion(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
                    survivor, person.createdAt(), person.updatedAt()));
        }
        access.requireVisiblePerson(id);

        UUID scope = access.advisorScope();
        List<OpportunityDto> opps = opportunities.viewsByPerson(id, scope).stream().map(mapper::opportunity).toList();
        Set<UUID> visible = opps.stream().map(OpportunityDto::id).collect(Collectors.toSet());
        List<AppointmentDto> citas = appointments.viewsByPerson(id, scope).stream().map(mapper::appointment).toList();
        List<InteractionDto> interactions = interactionService.listByPersonId(id).stream()
                .filter(i -> scope == null || i.opportunityId() == null || visible.contains(i.opportunityId()))
                .map(mapper::interaction)
                .toList();
        List<StageEventDto> history = opps.stream()
                .flatMap(o -> stageHistories.listByOpportunityId(o.id()).stream())
                .map(mapper::stageEvent)
                .toList();

        return ResponseEntity.ok(new PersonDetailDto(
                person.id(),
                person.fullName(),
                person.cedula(),
                person.email(),
                person.channel(),
                person.advisorId(),
                person.state(),
                person.resolutionCriterion(),
                person.phones().stream().map(PhoneRecord::phone).toList(),
                opps,
                citas,
                interactions,
                history,
                persons.mergesInto(id).stream().map(mapper::merge).toList(),
                null,
                person.createdAt(),
                person.updatedAt()
        ));
    }

    @PostMapping("/v1/crm/personas/{id}/interacciones")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<InteractionDto> createInteraction(
            @PathVariable UUID id,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestBody CreateInteractionRequest request) {
        access.requireVisiblePerson(id);
        if (request.oportunidadId() != null) {
            access.visibleOpportunity(request.oportunidadId());
        }
        InteractionRecord record = interactionService.register(
                id,
                request.oportunidadId(),
                request.canal(),
                request.direccion(),
                request.nota(),
                idempotencyKey
        );

        return ResponseEntity.ok(mapper.interaction(record));
    }
}
