package com.wamma.crm.domain;

import java.util.Optional;

/**
 * Máquina de estados del embudo (spec 010 §8.1, plan 010 §4).
 * <ul>
 *   <li><b>Avance</b> a cualquier etapa posterior, incluso saltando etapas: hay quien entra
 *       a la sede y compra el mismo día.</li>
 *   <li><b>Cierre perdido</b> desde cualquier etapa abierta, con un motivo del catálogo; si
 *       el motivo lo exige, también un texto (CA-010.2).</li>
 *   <li><b>Retroceso</b> con nota obligatoria (CA-010.10). Prohibirlo solo conseguiría que el
 *       equipo mienta al sistema para que le cuadre.</li>
 *   <li>Desde una etapa <b>terminal</b>, nada (CA-010.3). Retomar el contacto crea una
 *       oportunidad nueva.</li>
 * </ul>
 * Los mensajes son los que ya ve el usuario en la maqueta ({@code evaluarTransicion}).
 */
public final class TransitionRules {

    public enum Kind {
        ADVANCE, RETREAT, CLOSE_LOST
    }

    /**
     * @param lossReason código del motivo; solo cuenta al cerrar como perdida
     * @param lossDetail texto del motivo, para los que lo exigen
     * @param note       nota de la transición; obligatoria al retroceder
     */
    public record Request(String from, String to, String lossReason, String lossDetail, String note) {
    }

    /** Resultado: la clase de transición si se admite, o por qué no. */
    public record Decision(Kind kind, String problem) {

        static Decision allowed(Kind kind) {
            return new Decision(kind, null);
        }

        static Decision rejected(String problem) {
            return new Decision(null, problem);
        }

        public boolean isAllowed() {
            return problem == null;
        }

        public Optional<String> rejection() {
            return Optional.ofNullable(problem);
        }
    }

    private TransitionRules() {
    }

    public static Decision evaluate(StageCatalog stages, LossReasonCatalog reasons, Request request) {
        Optional<StageDefinition> origin = stages.find(request.from());
        if (origin.isEmpty()) {
            return Decision.rejected("La oportunidad está en una etapa desconocida: " + request.from() + ".");
        }
        Optional<StageDefinition> destination = stages.find(request.to());
        if (destination.isEmpty()) {
            return Decision.rejected("La etapa «" + request.to() + "» no existe.");
        }
        StageDefinition from = origin.get();
        StageDefinition to = destination.get();

        if (from.terminal()) {
            return Decision.rejected("«" + from.name() + "» es una etapa terminal. "
                    + "Para retomar el contacto se crea una oportunidad nueva.");
        }
        if (from.code().equals(to.code())) {
            return Decision.rejected("La oportunidad ya está en esa etapa.");
        }
        // Antes que el avance: «Perdido» es la última en orden, y por esa rama perdería la
        // exigencia de motivo.
        if (to.code().equals(Stages.LOST)) {
            return closeLost(reasons, request);
        }
        if (to.order() > from.order()) {
            return Decision.allowed(Kind.ADVANCE);
        }
        if (isBlank(request.note())) {
            return Decision.rejected("Para volver a una etapa anterior escribe una nota que explique por qué.");
        }
        return Decision.allowed(Kind.RETREAT);
    }

    private static Decision closeLost(LossReasonCatalog reasons, Request request) {
        if (isBlank(request.lossReason())) {
            return Decision.rejected("Indica el motivo por el que se perdió la oportunidad.");
        }
        Optional<LossReason> reason = reasons.find(request.lossReason());
        if (reason.isEmpty()) {
            return Decision.rejected("El motivo «" + request.lossReason() + "» no está en el catálogo.");
        }
        if (reason.get().requiresText() && isBlank(request.lossDetail())) {
            return Decision.rejected("Explica el motivo «" + reason.get().name() + "» en el texto.");
        }
        return Decision.allowed(Kind.CLOSE_LOST);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
