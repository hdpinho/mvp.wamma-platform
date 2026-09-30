package com.wamma.risk;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
public class AmlScreeningEngine {

    // Nombres o términos de prueba para simular coincidencias en listas de sanciones
    private static final Set<String> SANCTIONED_KEYWORDS = Set.of(
            "SANCIONADO", "OFAC", "BLOQUEADO", "TEST-SANCTION", "NARCOTRAFICO", "TERRORISMO"
    );

    private static final Set<String> SANCTIONED_IDS = Set.of(
            "V00000001", "V99999999", "E00000001", "00000001", "99999999"
    );

    public List<AmlAlertRecord> screenApplicant(
            UUID applicationId,
            UUID personId,
            String fullName,
            String nationalId,
            Map<String, Object> personalData,
            Map<String, Object> employmentData,
            Map<String, Object> declarations
    ) {
        List<AmlAlertRecord> alerts = new ArrayList<>();
        Instant now = Instant.now();

        String normalizedName = fullName != null ? fullName.trim().toUpperCase(Locale.ROOT) : "";
        String normalizedId = nationalId != null ? nationalId.replaceAll("[^a-zA-Z0-9]", "").toUpperCase(Locale.ROOT) : "";

        // 1. Verificación en listas de sanciones internacionales (OFAC / Clinton List)
        boolean ofacMatch = false;
        for (String keyword : SANCTIONED_KEYWORDS) {
            if (normalizedName.contains(keyword)) {
                ofacMatch = true;
                break;
            }
        }
        if (SANCTIONED_IDS.contains(normalizedId)) {
            ofacMatch = true;
        }

        if (ofacMatch) {
            alerts.add(new AmlAlertRecord(
                    UUID.randomUUID(),
                    applicationId,
                    personId,
                    "Coincidencia exacta o por homonimia con Lista OFAC / Sanciones Internacionales",
                    "bloqueante",
                    "OFAC",
                    null,
                    "pendiente",
                    "Cotejo de nombre y documento con listas restrictivas internacionales. Requiere verificación inmediata de cumplimiento.",
                    null,
                    now
            ));
        }

        // 2. Verificación de Personas Políticamente Expuestas (PEP)
        boolean isPep = false;
        String pepDetail = null;

        if (declarations != null) {
            Object esPepObj = declarations.get("esPep");
            Object vinculoPepObj = declarations.get("vinculoPep");
            if (Boolean.TRUE.equals(esPepObj) || "true".equalsIgnoreCase(String.valueOf(esPepObj))) {
                isPep = true;
                pepDetail = "El solicitante declaró ser Persona Políticamente Expuesta (PEP activo)";
            } else if (Boolean.TRUE.equals(vinculoPepObj) || "true".equalsIgnoreCase(String.valueOf(vinculoPepObj))) {
                isPep = true;
                pepDetail = "El solicitante declaró tener parentesco o vínculo directo con PEP";
            }
        }

        // Detección heurística de cargos públicos en datos laborales
        if (employmentData != null && !isPep) {
            String cargo = String.valueOf(employmentData.getOrDefault("cargo", "")).toLowerCase(Locale.ROOT);
            String empresa = String.valueOf(employmentData.getOrDefault("empresa", "")).toLowerCase(Locale.ROOT);
            if (cargo.contains("ministro") || cargo.contains("alcalde") || cargo.contains("gobernador")
                    || cargo.contains("diputado") || cargo.contains("magistrado") || cargo.contains("juez militar")) {
                isPep = true;
                pepDetail = "Detección automática de cargo público de alto nivel en datos laborales: " + cargo;
            }
        }

        if (isPep) {
            alerts.add(new AmlAlertRecord(
                    UUID.randomUUID(),
                    applicationId,
                    personId,
                    "Identificación como Persona Políticamente Expuesta (PEP Nacional o Vinculado)",
                    "media",
                    "PEP_NACIONAL",
                    null,
                    "pendiente",
                    pepDetail != null ? pepDetail : "Declaración afirmativa de PEP.",
                    null,
                    now
            ));
        }

        return alerts;
    }
}
