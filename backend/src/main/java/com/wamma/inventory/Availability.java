package com.wamma.inventory;

import java.util.Arrays;
import java.util.Optional;

/**
 * Disponibilidad comercial del vehículo (spec 005 RF-005.9, spec 010 §8.4). Es un eje
 * distinto de la etapa de la oportunidad; en el esquema se guarda en {@code vehiculo.estado}
 * (plan 005 E5). Los demás estados de esa columna son del módulo 004 completo.
 */
public enum Availability {

    AVAILABLE("disponible", "exhibicion"),
    APPOINTMENT("cita_agendada", "reservado"),
    SOLD("vendido", "vendido");

    private final String code;
    private final String dbState;

    Availability(String code, String dbState) {
        this.code = code;
        this.dbState = dbState;
    }

    /** Valor del contrato de la API, el mismo que usa la maqueta. */
    public String code() {
        return code;
    }

    /** Valor de {@code vehiculo.estado}. */
    public String dbState() {
        return dbState;
    }

    public static Optional<Availability> fromCode(String code) {
        return Arrays.stream(values()).filter(a -> a.code.equals(code)).findFirst();
    }

    public static Availability fromDbState(String dbState) {
        return Arrays.stream(values())
                .filter(a -> a.dbState.equals(dbState))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Estado de vehículo sin disponibilidad comercial: " + dbState));
    }

    /**
     * Por qué no se permite pasar de un estado a otro, o vacío si se permite (plan 005 §4.2).
     * Corregir un vendido es solo del rol Inventario, y exige un motivo.
     */
    public static Optional<String> transitionError(Availability from, Availability to, boolean canManageInventory,
                                                   String reason) {
        if (from == to) {
            return Optional.empty();
        }
        if (from == SOLD) {
            if (!canManageInventory) {
                return Optional.of("Solo el rol Inventario puede corregir un vehículo vendido.");
            }
            if (reason == null || reason.isBlank()) {
                return Optional.of("Indica el motivo para corregir un vehículo vendido.");
            }
        }
        return Optional.empty();
    }
}
