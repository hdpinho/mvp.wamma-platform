package com.wamma.crm.domain;

import java.util.List;

import com.wamma.crm.domain.TransitionRules.Decision;
import com.wamma.crm.domain.TransitionRules.Kind;
import com.wamma.crm.domain.TransitionRules.Request;
import org.junit.jupiter.api.Test;

import static com.wamma.crm.domain.SeededCatalogs.REASONS;
import static com.wamma.crm.domain.SeededCatalogs.STAGES;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Máquina de estados del embudo (spec 010 §8.1, plan 010 §4). */
class TransitionRulesTest {

    private static Decision move(String from, String to) {
        return TransitionRules.evaluate(STAGES, REASONS, new Request(from, to, null, null, null));
    }

    private static Decision loseWith(String reason, String detail) {
        return TransitionRules.evaluate(STAGES, REASONS, new Request("contactado", "cerrado_perdido", reason, detail, null));
    }

    private static Decision retreatWith(String note) {
        return TransitionRules.evaluate(STAGES, REASONS, new Request("negociacion", "contactado", null, null, note));
    }

    @Test
    void everyOpenStageAdvancesToAnyLaterOneIncludingASale() {
        List<StageDefinition> open = STAGES.open();
        for (int i = 0; i < open.size(); i++) {
            for (int j = i + 1; j < open.size(); j++) {
                assertThat(move(open.get(i).code(), open.get(j).code()).kind()).isEqualTo(Kind.ADVANCE);
            }
            Decision sale = move(open.get(i).code(), Stages.WON);
            assertThat(sale.isAllowed()).isTrue();
            assertThat(sale.kind()).isEqualTo(Kind.ADVANCE);
            assertThat(sale.rejection()).isEmpty();
        }
    }

    @Test
    void closingAsLostNeedsAReasonFromTheCatalog() {
        // CA-010.2
        assertThat(loseWith(null, null).rejection()).contains("Indica el motivo por el que se perdió la oportunidad.");
        assertThat(loseWith("  ", null).isAllowed()).isFalse();
        assertThat(loseWith("se_aburrio", null).rejection()).contains("El motivo «se_aburrio» no está en el catálogo.");
        assertThat(loseWith("dejo_de_responder", null).kind()).isEqualTo(Kind.CLOSE_LOST);
    }

    @Test
    void theReasonOtherNeedsAnExplanation() {
        assertThat(loseWith("otro", null).rejection()).contains("Explica el motivo «Otro motivo» en el texto.");
        assertThat(loseWith("otro", " ").isAllowed()).isFalse();
        assertThat(loseWith("otro", "Se mudó del país").kind()).isEqualTo(Kind.CLOSE_LOST);
    }

    @Test
    void goingBackNeedsANote() {
        // CA-010.10
        assertThat(retreatWith(null).rejection())
                .contains("Para volver a una etapa anterior escribe una nota que explique por qué.");
        assertThat(retreatWith("").isAllowed()).isFalse();
        assertThat(retreatWith("El cliente pidió pensarlo").kind()).isEqualTo(Kind.RETREAT);
    }

    @Test
    void aClosedOpportunityNeverMovesAgain() {
        // CA-010.3
        for (String terminal : List.of(Stages.WON, Stages.LOST)) {
            for (StageDefinition target : STAGES.all()) {
                assertThat(move(terminal, target.code()).isAllowed()).isFalse();
            }
        }
        assertThat(move(Stages.WON, Stages.NEW).rejection())
                .contains("«Vendido» es una etapa terminal. Para retomar el contacto se crea una oportunidad nueva.");
    }

    @Test
    void stayingInTheSameStageIsNotATransition() {
        assertThat(move(Stages.VISITED, Stages.VISITED).rejection()).contains("La oportunidad ya está en esa etapa.");
    }

    @Test
    void unknownStagesAreRejected() {
        assertThat(move("inventada", Stages.CONTACTED).rejection())
                .contains("La oportunidad está en una etapa desconocida: inventada.");
        assertThat(move(null, Stages.CONTACTED).isAllowed()).isFalse();
        assertThat(move(Stages.NEW, "inventada").rejection()).contains("La etapa «inventada» no existe.");
    }

    @Test
    void theStageCatalogIsOrderedAndNeedsBothClosings() {
        assertThat(STAGES.all()).extracting(StageDefinition::code).containsExactly(
                "nuevo", "contactado", "cita_confirmada", "visito", "negociacion", "cerrado_ganado", "cerrado_perdido");
        assertThat(STAGES.open()).extracting(StageDefinition::code).containsExactly(
                "nuevo", "contactado", "cita_confirmada", "visito", "negociacion");
        assertThat(STAGES.find(null)).isEmpty();

        StageDefinition won = new StageDefinition(Stages.WON, "Vendido", 6, true, null);
        StageDefinition lost = new StageDefinition(Stages.LOST, "Perdido", 7, true, null);
        StageDefinition fresh = new StageDefinition(Stages.NEW, "Nuevo", 1, false, 2);
        assertThatThrownBy(() -> StageCatalog.of(List.of(fresh, won)))
                .hasMessageContaining("cerrado_perdido");
        assertThatThrownBy(() -> StageCatalog.of(List.of(fresh, lost,
                new StageDefinition(Stages.WON, "Vendido", 6, false, 3))))
                .hasMessageContaining("cerrado_ganado");
        assertThatThrownBy(() -> StageCatalog.of(List.of(fresh, won, lost, fresh)))
                .hasMessageContaining("Etapa repetida");
        assertThatThrownBy(() -> StageCatalog.of(List.of(fresh, won, lost,
                new StageDefinition(Stages.CONTACTED, "Contactado", 1, false, 3))))
                .hasMessageContaining("Orden repetido");
    }

    @Test
    void theLossReasonCatalogIsClosed() {
        assertThat(REASONS.all()).hasSize(7);
        assertThat(REASONS.find("otro")).get().extracting(LossReason::requiresText).isEqualTo(true);
        assertThat(REASONS.find(null)).isEmpty();
        LossReason reason = new LossReason("otro", "Otro motivo", true);
        assertThatThrownBy(() -> LossReasonCatalog.of(List.of(reason, reason)))
                .hasMessageContaining("Motivo de pérdida repetido");
    }
}
