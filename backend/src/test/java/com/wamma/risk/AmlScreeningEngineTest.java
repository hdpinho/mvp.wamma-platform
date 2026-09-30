package com.wamma.risk;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AmlScreeningEngineTest {

    private AmlScreeningEngine engine;

    @BeforeEach
    void setUp() {
        engine = new AmlScreeningEngine();
    }

    @Test
    @DisplayName("Solicitante limpio no genera alertas AML")
    void cleanApplicantGeneratesNoAlerts() {
        List<AmlAlertRecord> alerts = engine.screenApplicant(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Pedro Perez",
                "V-15894562",
                Map.of(),
                Map.of("cargo", "Ingeniero de Software", "empresa", "Tech Solutions"),
                Map.of("esPep", false, "vinculoPep", false)
        );

        assertThat(alerts).isEmpty();
    }

    @Test
    @DisplayName("Nombre con coincidencia de sanción genera alerta bloqueante OFAC")
    void sanctionedNameTriggersBlockingOfacAlert() {
        List<AmlAlertRecord> alerts = engine.screenApplicant(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Juan Carlos Sancionado Perez",
                "V-12345678",
                Map.of(),
                Map.of(),
                Map.of("esPep", false)
        );

        assertThat(alerts).hasSize(1);
        AmlAlertRecord alert = alerts.getFirst();
        assertThat(alert.severity()).isEqualTo("bloqueante");
        assertThat(alert.listOrigin()).isEqualTo("OFAC");
        assertThat(alert.resolution()).isEqualTo("pendiente");
    }

    @Test
    @DisplayName("Declaración afirmativa de PEP genera alerta media de cumplimiento")
    void pepDeclarationTriggersMediumAlert() {
        List<AmlAlertRecord> alerts = engine.screenApplicant(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Maria Rodriguez",
                "V-19876543",
                Map.of(),
                Map.of("cargo", "Directora"),
                Map.of("esPep", true)
        );

        assertThat(alerts).hasSize(1);
        AmlAlertRecord alert = alerts.getFirst();
        assertThat(alert.severity()).isEqualTo("media");
        assertThat(alert.listOrigin()).isEqualTo("PEP_NACIONAL");
    }
}
