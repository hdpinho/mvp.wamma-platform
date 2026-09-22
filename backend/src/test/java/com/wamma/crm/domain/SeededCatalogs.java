package com.wamma.crm.domain;

import java.util.List;

/** Los catálogos tal como los siembra V0010 (spec 010 §8.1, §8.2 y §8.6). */
final class SeededCatalogs {

    static final StageCatalog STAGES = StageCatalog.of(List.of(
            new StageDefinition("nuevo", "Nuevo", 1, false, 2),
            new StageDefinition("contactado", "Contactado", 2, false, 3),
            new StageDefinition("cita_confirmada", "Cita confirmada", 3, false, 7),
            new StageDefinition("visito", "Visitó la sede", 4, false, 7),
            new StageDefinition("negociacion", "En negociación", 5, false, 14),
            new StageDefinition("cerrado_ganado", "Vendido", 6, true, null),
            new StageDefinition("cerrado_perdido", "Perdido", 7, true, null)));

    static final LossReasonCatalog REASONS = LossReasonCatalog.of(List.of(
            new LossReason("precio_fuera_de_presupuesto", "Precio fuera de su presupuesto", false),
            new LossReason("no_califico_financiamiento", "No calificó para financiamiento", false),
            new LossReason("compro_en_otra_parte", "Compró en otra parte", false),
            new LossReason("dejo_de_responder", "Dejó de responder", false),
            new LossReason("vehiculo_vendido_a_otro_cliente", "El vehículo se vendió a otro cliente", false),
            new LossReason("no_era_el_vehiculo_buscado", "No era el vehículo que buscaba", false),
            new LossReason("otro", "Otro motivo", true)));

    private SeededCatalogs() {
    }
}
