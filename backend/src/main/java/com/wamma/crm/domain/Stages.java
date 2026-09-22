package com.wamma.crm.domain;

/**
 * Códigos de etapa que los flujos del CRM nombran explícitamente (spec 010 §8.1).
 * <p>
 * El catálogo completo, con nombres, orden y umbrales, vive en la base
 * ({@code catalogo_etapa}, V0010) y llega como {@link StageCatalog}. Aquí solo están los
 * códigos a los que el código lleva una oportunidad: capturar, confirmar, asistir, vender
 * y cerrar.
 */
public final class Stages {

    public static final String NEW = "nuevo";
    public static final String CONTACTED = "contactado";
    public static final String APPOINTMENT_CONFIRMED = "cita_confirmada";
    public static final String VISITED = "visito";
    public static final String NEGOTIATION = "negociacion";
    public static final String WON = "cerrado_ganado";
    public static final String LOST = "cerrado_perdido";

    private Stages() {
    }
}
