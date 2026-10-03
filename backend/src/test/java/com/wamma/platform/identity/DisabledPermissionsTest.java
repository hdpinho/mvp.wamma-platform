package com.wamma.platform.identity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** «Tomar» y «repartir» están fuera del MVP (D-73): apagadas por defecto, y se encienden sin tocar la base. */
class DisabledPermissionsTest {

    private static final Set<String> COORDINATOR = Set.of("crm.ver_todas", "crm.operar", "crm.asignar", "cotizador.usar");

    @Test
    @DisplayName("Apagado, la sesión no trae crm.asignar y conserva el resto")
    void switchedOffRemovesOnlyAssignment() {
        DisabledPermissions off = new DisabledPermissions(false);

        assertThat(off.filter(COORDINATOR)).containsExactlyInAnyOrder("crm.ver_todas", "crm.operar", "cotizador.usar");
        assertThat(off.crmAssignmentEnabled()).isFalse();
    }

    @Test
    @DisplayName("Encendido, no quita nada")
    void switchedOnKeepsEverything() {
        DisabledPermissions on = new DisabledPermissions(true);

        assertThat(on.filter(COORDINATOR)).containsExactlyInAnyOrderElementsOf(COORDINATOR);
        assertThat(on.crmAssignmentEnabled()).isTrue();
    }

    @Test
    @DisplayName("El valor por defecto de la configuración es apagado")
    void defaultIsOff() throws Exception {
        String yml = Files.readString(Path.of("src/main/resources/application.yml"));

        assertThat(yml).contains("asignacion-habilitada: ${WAMMA_CRM_ASIGNACION:false}");
    }
}
