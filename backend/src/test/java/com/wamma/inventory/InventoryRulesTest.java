package com.wamma.inventory;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Reglas puras del inventario: publicación, disponibilidad y código (plan 005 §4, D-25). */
class InventoryRulesTest {

    @Test
    void aRealVehicleNeedsFivePhotosAndTheEuroRate() {
        assertThat(PublicationRules.missing(new PublicationRules.Candidate(false, 5, false, true))).isEmpty();
        assertThat(PublicationRules.missing(new PublicationRules.Candidate(false, 4, false, true)))
                .containsExactly("Falta 1 foto (se necesitan al menos 5).");
        assertThat(PublicationRules.missing(new PublicationRules.Candidate(false, 0, true, false)))
                .containsExactly("Faltan 5 fotos (se necesitan al menos 5).",
                        "Un vehículo vendido no se publica.",
                        "Registra la tasa BCV del euro antes de publicar.");
    }

    @Test
    void aDemoVehicleIsPublishedWithItsReferencePhoto() {
        assertThat(PublicationRules.missing(new PublicationRules.Candidate(true, 1, false, true))).isEmpty();
        assertThat(PublicationRules.missing(new PublicationRules.Candidate(true, 0, false, true)))
                .containsExactly("Falta 1 foto (se necesitan al menos 1).");
    }

    @Test
    void availabilityMapsToTheVehicleState() {
        for (Availability availability : Availability.values()) {
            assertThat(Availability.fromCode(availability.code())).contains(availability);
            assertThat(Availability.fromDbState(availability.dbState())).isEqualTo(availability);
        }
        assertThat(Availability.fromCode("reservado")).isEmpty();
    }

    @Test
    void theCrmMovesAvailabilityButOnlyInventoryCorrectsASale() {
        assertThat(Availability.transitionError(Availability.AVAILABLE, Availability.APPOINTMENT, false, null)).isEmpty();
        assertThat(Availability.transitionError(Availability.APPOINTMENT, Availability.AVAILABLE, false, null)).isEmpty();
        assertThat(Availability.transitionError(Availability.APPOINTMENT, Availability.SOLD, false, null)).isEmpty();
        assertThat(Availability.transitionError(Availability.SOLD, Availability.SOLD, false, null)).isEmpty();

        assertThat(Availability.transitionError(Availability.SOLD, Availability.AVAILABLE, false, "error"))
                .contains("Solo el rol Inventario puede corregir un vehículo vendido.");
        assertThat(Availability.transitionError(Availability.SOLD, Availability.AVAILABLE, true, " "))
                .contains("Indica el motivo para corregir un vehículo vendido.");
        assertThat(Availability.transitionError(Availability.SOLD, Availability.AVAILABLE, true, "Venta anulada")).isEmpty();
    }

    @Test
    void inventoryCodesFollowTheDatabasePattern() {
        assertThat(InventoryCode.isValid("veh-001")).isTrue();
        assertThat(InventoryCode.isValid("WAM-00017")).isTrue();
        assertThat(InventoryCode.isValid("WAM-123456")).isTrue();
        assertThat(InventoryCode.isValid("VEH-001")).isFalse();
        assertThat(InventoryCode.isValid("WAM-17")).isFalse();
        assertThat(InventoryCode.isValid("../veh-001")).isFalse();
        assertThat(InventoryCode.isValid(null)).isFalse();
    }
}
