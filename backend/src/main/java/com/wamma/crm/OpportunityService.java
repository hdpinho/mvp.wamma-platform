package com.wamma.crm;

import com.wamma.crm.domain.FinancingLinkToken;
import com.wamma.crm.domain.LossReasonCatalog;
import com.wamma.crm.domain.StageCatalog;
import com.wamma.crm.domain.TransitionRules;
import com.wamma.inventory.VehicleRepository;
import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class OpportunityService {

    public record SaleResult(OpportunityRecord opportunity, String financingToken) {
    }

    private final OpportunityRepository opportunities;
    private final StageHistoryRepository stageHistories;
    private final VehicleRepository vehicles;
    private final FunnelService funnel;
    private final AuditLog audit;
    private final Clock clock;

    public OpportunityService(OpportunityRepository opportunities, StageHistoryRepository stageHistories,
                              VehicleRepository vehicles, FunnelService funnel, AuditLog audit, Clock clock) {
        this.opportunities = opportunities;
        this.stageHistories = stageHistories;
        this.vehicles = vehicles;
        this.funnel = funnel;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public OpportunityRecord changeStage(UUID id, String targetStage, String lossReason, String lossDetail,
                                         String note, int expectedVersion) {
        OpportunityRecord opp = opportunities.findById(id)
                .orElseThrow(() -> ApiException.notFound("Oportunidad no encontrada", "No existe la oportunidad " + id));

        String currentStage = opp.stage();
        StageCatalog stages = funnel.loadStageCatalog();
        LossReasonCatalog reasons = funnel.loadLossReasonCatalog();
        var request = new TransitionRules.Request(currentStage, targetStage, lossReason, lossDetail, note);
        var decision = TransitionRules.evaluate(stages, reasons, request);
        if (!decision.isAllowed()) {
            String problem = decision.rejection().orElse("Transición no permitida");
            audit.record("oportunidad.transicion_rechazada", "oportunidad", id,
                    Map.of("etapa_actual", currentStage, "etapa_destino", targetStage, "motivo", problem));
            throw ApiException.unprocessable("Transición inválida", problem);
        }

        Instant now = clock.instant();
        Instant closedAt = ("cerrado_ganado".equals(targetStage) || "cerrado_perdido".equals(targetStage)) ? now : null;

        boolean ok = opportunities.updateStage(id, targetStage, lossReason, lossDetail, closedAt, expectedVersion);
        if (!ok) {
            throw ApiException.conflict("Conflicto de concurrencia", "La oportunidad fue modificada por otro usuario.");
        }

        UUID actorId = CurrentUser.id().orElse(null);
        stageHistories.insert(id, currentStage, targetStage, note, actorId);

        // Efectos en el inventario
        if ("cerrado_ganado".equals(targetStage)) {
            vehicles.setState(opp.vehicleId(), "vendido");
        } else if ("cerrado_perdido".equals(targetStage)) {
            long otherOpen = opportunities.countOpenByVehicleIdExcluding(opp.vehicleId(), id);
            if (otherOpen == 0) {
                vehicles.setState(opp.vehicleId(), "exhibicion");
            }
        }

        audit.record("oportunidad.etapa_cambiada", "oportunidad", id,
                Map.of("etapa_anterior", currentStage, "etapa_nueva", targetStage));

        return opportunities.findById(id).orElseThrow();
    }

    @Transactional
    public SaleResult sell(UUID id, String modality) {
        OpportunityRecord opp = opportunities.findById(id)
                .orElseThrow(() -> ApiException.notFound("Oportunidad no encontrada", "No existe la oportunidad " + id));

        if ("contado".equalsIgnoreCase(modality)) {
            OpportunityRecord updated = changeStage(id, "cerrado_ganado", null, null,
                    "Venta de contado confirmada", opp.version());
            audit.record("oportunidad.venta_contado", "oportunidad", id, Map.of("vehiculo_id", opp.vehicleId()));
            return new SaleResult(updated, null);
        } else if ("financiamiento".equalsIgnoreCase(modality)) {
            OpportunityRecord updated = changeStage(id, "negociacion", null, null,
                    "Pase a financiamiento", opp.version());
            FinancingLinkToken.Issued linkToken = FinancingLinkToken.issue(new java.security.SecureRandom());
            Instant now = clock.instant();
            Instant expiresAt = now.plus(Duration.ofDays(7));
            opportunities.setFinancingLink(id, linkToken.hash(), now, expiresAt);
            audit.record("enlace_financiamiento.emitido", "oportunidad", id, Map.of("expira_en", expiresAt.toString()));
            return new SaleResult(updated, linkToken.token());
        } else {
            throw ApiException.badRequest("Modalidad inválida", "La modalidad debe ser contado o financiamiento.");
        }
    }

    @Transactional
    public void assignAdvisor(UUID id, UUID advisorId, boolean canAssignAny) {
        OpportunityRecord opp = opportunities.findById(id)
                .orElseThrow(() -> ApiException.notFound("Oportunidad no encontrada", "No existe la oportunidad " + id));

        if (!canAssignAny) {
            if (opp.advisorId() != null && !opp.advisorId().equals(advisorId)) {
                throw ApiException.forbidden("Acceso denegado", "No puedes reasignar una oportunidad que ya tiene asesor.");
            }
        }

        opportunities.updateAdvisor(id, advisorId);
        audit.record("oportunidad.asesor_asignado", "oportunidad", id, Map.of("asesor_id", advisorId));
    }

    public void updateNextAction(UUID id, String action, LocalDate date) {
        opportunities.updateNextAction(id, action, date);
    }
}
