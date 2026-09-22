package com.wamma.crm.domain;

import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Catálogo de etapas del embudo, ordenado (spec 010 §8.1).
 * <p>
 * Se construye con las filas de la base. Exige que existan las dos etapas terminales que
 * la máquina de estados trata de forma especial ({@link Stages#WON} y {@link Stages#LOST}):
 * sin ellas no hay forma de cerrar una oportunidad, y es mejor fallar al arrancar que en
 * la primera venta.
 */
public final class StageCatalog {

    private final Map<String, StageDefinition> byCode;

    private StageCatalog(Map<String, StageDefinition> byCode) {
        this.byCode = byCode;
    }

    public static StageCatalog of(List<StageDefinition> stages) {
        Map<String, StageDefinition> byCode = new LinkedHashMap<>();
        Set<Integer> orders = new HashSet<>();
        stages.stream()
                .sorted(Comparator.comparingInt(StageDefinition::order))
                .forEach(stage -> {
                    if (byCode.putIfAbsent(stage.code(), stage) != null) {
                        throw new IllegalArgumentException("Etapa repetida en el catálogo: " + stage.code());
                    }
                    // Con dos etapas del mismo orden no se sabría si un cambio avanza o retrocede.
                    if (!orders.add(stage.order())) {
                        throw new IllegalArgumentException("Orden repetido en el catálogo de etapas: " + stage.order());
                    }
                });
        requireTerminal(byCode, Stages.WON);
        requireTerminal(byCode, Stages.LOST);
        return new StageCatalog(byCode);
    }

    private static void requireTerminal(Map<String, StageDefinition> byCode, String code) {
        StageDefinition stage = byCode.get(code);
        if (stage == null || !stage.terminal()) {
            throw new IllegalArgumentException("El catálogo de etapas necesita la etapa terminal " + code);
        }
    }

    public Optional<StageDefinition> find(String code) {
        return Optional.ofNullable(code).map(byCode::get);
    }

    /** Todas las etapas, en el orden del embudo. */
    public List<StageDefinition> all() {
        return List.copyOf(byCode.values());
    }

    /** Las etapas abiertas, en orden: las columnas del tablero activo. */
    public List<StageDefinition> open() {
        return byCode.values().stream().filter(stage -> !stage.terminal()).toList();
    }
}
