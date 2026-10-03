package com.wamma.crm;

import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.web.ApiException;
import com.wamma.platform.web.RequestInfo;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Visibilidad del CRM por rol (plan 010 §7, CA-010.8).
 * <p>
 * Con {@code crm.ver_todas} se ve todo. Con {@code crm.ver_propias}, solo lo del asesor y lo que no
 * tiene dueño, que puede tomar para sí (D-48). Lo ajeno responde 404, sin confirmar que existe, y
 * queda en la bitácora. Se consulta desde los controladores, fuera de las transacciones de
 * negocio, para que el registro quede aunque la operación falle.
 */
@Component
public class CrmAccess {

    private final OpportunityRepository opportunities;
    private final AuditLog audit;

    public CrmAccess(OpportunityRepository opportunities, AuditLog audit) {
        this.opportunities = opportunities;
        this.audit = audit;
    }

    /** Nulo si el usuario ve todo; si no, el asesor al que se limita lo que ve y opera. */
    public UUID advisorScope() {
        return CurrentUser.hasAuthority("crm.ver_todas") ? null : CurrentUser.id().orElseThrow();
    }

    /** La oportunidad, si el usuario la ve; si es de otro asesor, 404. */
    public OpportunityRecord visibleOpportunity(UUID id) {
        OpportunityRecord opp = opportunities.findById(id)
                .orElseThrow(() -> ApiException.notFound("Oportunidad no encontrada", "No existe la oportunidad " + id));
        UUID scope = advisorScope();
        if (scope != null && opp.advisorId() != null && !opp.advisorId().equals(scope)) {
            recordForeignAccess("oportunidad", id);
            throw ApiException.notFound("Oportunidad no encontrada", "No existe la oportunidad " + id);
        }
        return opp;
    }

    /** 404 si la persona solo tiene oportunidades de otros asesores. */
    public void requireVisiblePerson(UUID personId) {
        UUID scope = advisorScope();
        if (scope != null && !opportunities.hasOpportunityVisibleTo(personId, scope)) {
            recordForeignAccess("persona", personId);
            throw ApiException.notFound("Persona no encontrada", "No existe la persona " + personId);
        }
    }

    private void recordForeignAccess(String entity, UUID id) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("metodo", RequestInfo.method());
        detail.put("ruta", RequestInfo.path());
        detail.put("motivo", "registro de otro asesor");
        audit.record("acceso.denegado", entity, id, null, detail);
    }
}
