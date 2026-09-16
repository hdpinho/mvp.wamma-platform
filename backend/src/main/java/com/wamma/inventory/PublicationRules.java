package com.wamma.inventory;

import java.util.ArrayList;
import java.util.List;

/**
 * Cuándo se puede publicar un vehículo (spec 005 RF-005.2, D-25).
 * <p>
 * No se exige la certificación: un vehículo sin certificar se publica con aviso y sin sello
 * mientras no exista el 004 completo (E11).
 */
public final class PublicationRules {

    public static final int MIN_PHOTOS = 5;
    public static final int MAX_PHOTOS = 10;
    /** Los de demostración se publican con su foto referencial, por excepción (E9-A). */
    public static final int MIN_PHOTOS_DEMO = 1;

    private PublicationRules() {
    }

    public record Candidate(boolean demo, int photoCount, boolean sold, boolean rateAvailable) {
    }

    public static int minimumPhotos(boolean demo) {
        return demo ? MIN_PHOTOS_DEMO : MIN_PHOTOS;
    }

    /** Lo que falta para publicar, en frases listas para el usuario; vacío si se puede. */
    public static List<String> missing(Candidate candidate) {
        List<String> missing = new ArrayList<>();
        int minimum = minimumPhotos(candidate.demo());
        if (candidate.photoCount() < minimum) {
            int lacking = minimum - candidate.photoCount();
            missing.add(lacking == 1
                    ? "Falta 1 foto (se necesitan al menos " + minimum + ")."
                    : "Faltan " + lacking + " fotos (se necesitan al menos " + minimum + ").");
        }
        if (candidate.sold()) {
            missing.add("Un vehículo vendido no se publica.");
        }
        if (!candidate.rateAvailable()) {
            missing.add("Registra la tasa BCV del euro antes de publicar.");
        }
        return missing;
    }
}
