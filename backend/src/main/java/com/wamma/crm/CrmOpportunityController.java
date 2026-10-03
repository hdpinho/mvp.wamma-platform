package com.wamma.crm;

import com.wamma.crm.CrmDtos.AdvisorDto;
import com.wamma.crm.CrmDtos.OpportunityDto;
import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.identity.DisabledPermissions;
import com.wamma.platform.identity.UserRepository;
import com.wamma.platform.web.ApiException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
public class CrmOpportunityController {

    public record ChangeStageRequest(
            String etapa,
            String motivo,
            String detalle,
            String nota,
            Integer version
    ) {
    }

    public record AssignAdvisorRequest(
            UUID asesorId
    ) {
    }

    public record NextActionRequest(
            String accion,
            LocalDate fecha
    ) {
    }

    public record SaleRequest(
            String modalidad
    ) {
    }

    /** El enlace personal solo viaja aquí, al emitirlo: el servidor guarda su huella y no puede volver a mostrarlo. */
    public record SaleResponse(
            OpportunityDto oportunidad,
            String tokenFinanciamiento
    ) {
    }

    private final OpportunityService opportunityService;
    private final OpportunityRepository opportunities;
    private final UserRepository users;
    private final CrmAccess access;
    private final CrmMapper mapper;
    private final DisabledPermissions disabledPermissions;

    public CrmOpportunityController(OpportunityService opportunityService, OpportunityRepository opportunities,
                                    UserRepository users, CrmAccess access, CrmMapper mapper,
                                    DisabledPermissions disabledPermissions) {
        this.opportunityService = opportunityService;
        this.opportunities = opportunities;
        this.users = users;
        this.access = access;
        this.mapper = mapper;
        this.disabledPermissions = disabledPermissions;
    }

    /**
     * El embudo. Con {@code crm.ver_propias} llegan las del asesor y las que no tienen dueño; el coordinador ve todas y
     * puede filtrar por asesor o por las que no tienen dueño.
     */
    @GetMapping("/v1/crm/oportunidades")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<List<OpportunityDto>> listOpportunities(
            @RequestParam(required = false) String etapa,
            @RequestParam(required = false) UUID asesorId,
            @RequestParam(required = false, defaultValue = "false") boolean sinAsesor,
            @RequestParam(required = false, defaultValue = "500") int limit) {
        UUID scope = access.advisorScope();
        List<OpportunityDto> list = opportunities
                .listViews(etapa, scope == null ? asesorId : null, sinAsesor, scope, Math.clamp(limit, 1, 1000))
                .stream()
                .map(mapper::opportunity)
                .toList();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/v1/crm/oportunidades/{id}")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<OpportunityDto> getOpportunity(@PathVariable UUID id) {
        // Si es ajena, 404 sin confirmar que existe, y queda en la bitácora (plan §7).
        access.visibleOpportunity(id);
        return ResponseEntity.ok(view(id));
    }

    @PatchMapping("/v1/crm/oportunidades/{id}/etapa")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<OpportunityDto> changeStage(
            @PathVariable UUID id,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody ChangeStageRequest request) {
        access.visibleOpportunity(id);
        int expectedVersion;
        if (ifMatch != null && !ifMatch.isBlank()) {
            try {
                String clean = ifMatch.replace("\"", "").replace("W/", "").trim();
                expectedVersion = Integer.parseInt(clean);
            } catch (NumberFormatException e) {
                expectedVersion = request.version() != null ? request.version() : 0;
            }
        } else if (request.version() != null) {
            expectedVersion = request.version();
        } else {
            throw ApiException.badRequest("Versión requerida",
                    "Debes enviar la cabecera If-Match o el campo version para control de concurrencia.");
        }

        opportunityService.changeStage(
                id,
                request.etapa(),
                request.motivo(),
                request.detalle(),
                request.nota(),
                expectedVersion
        );

        return ResponseEntity.ok(view(id));
    }

    @PutMapping("/v1/crm/oportunidades/{id}/asesor")
    @PreAuthorize("hasAnyAuthority('crm.asignar', 'crm.operar')")
    public ResponseEntity<OpportunityDto> assignAdvisor(
            @PathVariable UUID id,
            @RequestBody AssignAdvisorRequest request) {
        // «Tomar» y «repartir» no entran en el MVP (D-73): la bandera wamma.crm.asignacion-habilitada las devuelve.
        if (!disabledPermissions.crmAssignmentEnabled()) {
            throw ApiException.forbidden("Función no disponible",
                    "Tomar y repartir oportunidades no está habilitado en esta versión.");
        }
        boolean canAssignAny = CurrentUser.hasAuthority("crm.asignar");
        UUID currentUser = CurrentUser.id().orElseThrow();
        UUID targetAdvisor = request.asesorId() != null ? request.asesorId() : currentUser;

        // Sin crm.asignar solo se toma para sí una oportunidad sin dueño (D-48): no se reparte a otros.
        if (!canAssignAny) {
            access.visibleOpportunity(id);
            if (!targetAdvisor.equals(currentUser)) {
                throw ApiException.forbidden("Asignación no permitida",
                        "Solo puedes tomar para ti una oportunidad sin dueño; repartir es del coordinador.");
            }
        }
        opportunityService.assignAdvisor(id, targetAdvisor, canAssignAny);
        return ResponseEntity.ok(view(id));
    }

    /** Los asesores a quienes el coordinador puede repartir oportunidades. */
    @GetMapping("/v1/crm/asesores")
    @PreAuthorize("hasAuthority('crm.asignar')")
    public ResponseEntity<List<AdvisorDto>> listAdvisors() {
        return ResponseEntity.ok(users.activeWithRole("ASESOR_COMERCIAL").stream()
                .map(u -> new AdvisorDto(u.id(), (u.firstName() + " " + u.lastName()).trim()))
                .toList());
    }

    @PutMapping("/v1/crm/oportunidades/{id}/proxima-accion")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<OpportunityDto> updateNextAction(
            @PathVariable UUID id,
            @RequestBody NextActionRequest request) {
        access.visibleOpportunity(id);
        opportunityService.updateNextAction(id, request.accion(), request.fecha());
        return ResponseEntity.ok(view(id));
    }

    @PostMapping("/v1/crm/oportunidades/{id}/venta")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<SaleResponse> sell(
            @PathVariable UUID id,
            @RequestBody SaleRequest request) {
        access.visibleOpportunity(id);
        OpportunityService.SaleResult result = opportunityService.sell(id, request.modalidad());
        return ResponseEntity.ok(new SaleResponse(view(id), result.financingToken()));
    }

    private OpportunityDto view(UUID id) {
        return mapper.opportunity(opportunities.viewById(id)
                .orElseThrow(() -> ApiException.notFound("Oportunidad no encontrada", "No existe la oportunidad " + id)));
    }
}
