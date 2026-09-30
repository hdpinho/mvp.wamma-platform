package com.wamma.crm;

import com.wamma.inventory.PublicationRepository;
import com.wamma.inventory.VehicleRepository;
import com.wamma.platform.auth.CurrentUser;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
public class CrmOpportunityController {

    public record OpportunityDto(
            UUID id,
            UUID personaId,
            String personaNombre,
            String personaTelefono,
            UUID vehiculoId,
            String vehiculoCodigo,
            String vehiculoTitulo,
            String vehiculoFotoKey,
            String modalidadPago,
            BigDecimal valorEstimado,
            String moneda,
            BigDecimal tasaBcv,
            LocalDate fechaTasa,
            String etapa,
            String motivoPerdida,
            String detallePerdida,
            UUID asesorId,
            String proximaAccion,
            LocalDate proximaAccionFecha,
            UUID solicitudCreditoId,
            boolean tieneEnlaceFinanciamiento,
            Instant cerradoEn,
            int version,
            Instant creadoEn,
            Instant actualizadoEn
    ) {
    }

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

    public record SaleResponse(
            OpportunityDto oportunidad,
            String tokenFinanciamiento
    ) {
    }

    private final OpportunityService opportunityService;
    private final OpportunityRepository opportunities;
    private final PersonRepository persons;
    private final VehicleRepository vehicles;
    private final PublicationRepository publications;

    public CrmOpportunityController(OpportunityService opportunityService, OpportunityRepository opportunities,
                                    PersonRepository persons, VehicleRepository vehicles,
                                    PublicationRepository publications) {
        this.opportunityService = opportunityService;
        this.opportunities = opportunities;
        this.persons = persons;
        this.vehicles = vehicles;
        this.publications = publications;
    }

    @GetMapping("/v1/crm/oportunidades")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<List<OpportunityDto>> listOpportunities(
            @RequestParam(required = false) String etapa,
            @RequestParam(required = false) UUID asesorId,
            @RequestParam(required = false, defaultValue = "false") boolean sinAsesor,
            @RequestParam(required = false, defaultValue = "100") int limit) {
        boolean viewAll = CurrentUser.hasAuthority("crm.ver_todas");
        UUID currentUserId = CurrentUser.id().orElse(null);

        UUID effectiveAdvisor = viewAll ? asesorId : currentUserId;
        List<OpportunityRecord> list = opportunities.list(etapa, effectiveAdvisor, sinAsesor, null, limit);

        return ResponseEntity.ok(toDtos(list));
    }

    @GetMapping("/v1/crm/oportunidades/{id}")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<OpportunityDto> getOpportunity(@PathVariable UUID id) {
        OpportunityRecord opp = opportunities.findById(id)
                .orElseThrow(() -> ApiException.notFound("Oportunidad no encontrada", "No existe la oportunidad " + id));

        boolean viewAll = CurrentUser.hasAuthority("crm.ver_todas");
        UUID currentUserId = CurrentUser.id().orElse(null);

        if (!viewAll && opp.advisorId() != null && !opp.advisorId().equals(currentUserId)) {
            // No confirmar que existe si es ajena (plan §7)
            throw ApiException.notFound("Oportunidad no encontrada", "No existe la oportunidad " + id);
        }

        return ResponseEntity.ok(toDto(opp));
    }

    @PatchMapping("/v1/crm/oportunidades/{id}/etapa")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<OpportunityDto> changeStage(
            @PathVariable UUID id,
            @RequestHeader(value = "If-Match", required = false) String ifMatch,
            @RequestBody ChangeStageRequest request) {
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

        OpportunityRecord updated = opportunityService.changeStage(
                id,
                request.etapa(),
                request.motivo(),
                request.detalle(),
                request.nota(),
                expectedVersion
        );

        return ResponseEntity.ok(toDto(updated));
    }

    @PutMapping("/v1/crm/oportunidades/{id}/asesor")
    @PreAuthorize("hasAnyAuthority('crm.asignar', 'crm.operar')")
    public ResponseEntity<Void> assignAdvisor(
            @PathVariable UUID id,
            @RequestBody AssignAdvisorRequest request) {
        boolean canAssignAny = CurrentUser.hasAuthority("crm.asignar");
        UUID targetAdvisor = request.asesorId() != null
                ? request.asesorId()
                : CurrentUser.id().orElseThrow();

        opportunityService.assignAdvisor(id, targetAdvisor, canAssignAny);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/v1/crm/oportunidades/{id}/proxima-accion")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<Void> updateNextAction(
            @PathVariable UUID id,
            @RequestBody NextActionRequest request) {
        opportunityService.updateNextAction(id, request.accion(), request.fecha());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/v1/crm/oportunidades/{id}/venta")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<SaleResponse> sell(
            @PathVariable UUID id,
            @RequestBody SaleRequest request) {
        OpportunityService.SaleResult result = opportunityService.sell(id, request.modalidad());
        return ResponseEntity.ok(new SaleResponse(toDto(result.opportunity()), result.financingToken()));
    }

    private List<OpportunityDto> toDtos(List<OpportunityRecord> list) {
        Map<UUID, VehicleRepository.VehicleRecord> vehicleMap = vehicles.findAll().stream()
                .collect(Collectors.toMap(VehicleRepository.VehicleRecord::id, v -> v, (a, b) -> a));

        List<OpportunityDto> result = new ArrayList<>();
        for (OpportunityRecord o : list) {
            PersonRecord p = persons.findById(o.personId()).orElse(null);
            VehicleRepository.VehicleRecord v = vehicleMap.get(o.vehicleId());
            var pub = publications.findByVehicle(o.vehicleId());

            String photoKey = pub.flatMap(pb -> publications.photos(pb.id()).stream()
                            .filter(PublicationRepository.PhotoRecord::main)
                            .findFirst())
                    .map(PublicationRepository.PhotoRecord::key)
                    .orElse(null);

            result.add(new OpportunityDto(
                    o.id(),
                    o.personId(),
                    p != null ? p.fullName() : "Desconocido",
                    p != null ? p.primaryPhone() : null,
                    o.vehicleId(),
                    v != null ? v.code() : null,
                    v != null ? (v.brand() + " " + v.model() + " " + v.year()) : null,
                    photoKey,
                    o.paymentMethod(),
                    o.estimatedValue(),
                    o.currency(),
                    o.bcvRate(),
                    o.rateDate(),
                    o.stage(),
                    o.lossReason(),
                    o.lossDetail(),
                    o.advisorId(),
                    o.nextAction(),
                    o.nextActionDate(),
                    o.creditApplicationId(),
                    o.financingLinkTokenHash() != null,
                    o.closedAt(),
                    o.version(),
                    o.createdAt(),
                    o.updatedAt()
            ));
        }
        return result;
    }

    private OpportunityDto toDto(OpportunityRecord o) {
        return toDtos(List.of(o)).getFirst();
    }
}
