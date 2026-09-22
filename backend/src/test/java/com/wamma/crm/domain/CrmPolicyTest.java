package com.wamma.crm.domain;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Plazos y límites de D-48, y el token del enlace de financiamiento (plan 010 E4, E5 y E7). */
class CrmPolicyTest {

    private static final Instant T0 = Instant.parse("2026-09-21T14:00:00Z");
    private final CrmPolicy policy = CrmPolicy.APPROVED;

    @Test
    void theApprovedValuesAreTheOnesOfD48() {
        assertThat(policy.appointmentHold()).isEqualTo(Duration.ofHours(24));
        assertThat(policy.financingLinkValidity()).isEqualTo(Duration.ofDays(7));
        assertThat(policy.capturesPerIp()).isEqualTo(5);
        assertThat(policy.capturesPerPhone()).isEqualTo(2);
        assertThat(policy.captureWindow()).isEqualTo(Duration.ofHours(24));
    }

    @Test
    void anUnconfirmedAppointmentHoldsTheVehicleForExactly24Hours() {
        Instant expires = policy.holdExpiresAt(T0);
        assertThat(expires).isEqualTo(Instant.parse("2026-09-22T14:00:00Z"));
        assertThat(policy.holdActive(expires, expires.minusMillis(1))).isTrue();
        assertThat(policy.holdActive(expires, expires)).isFalse();
        assertThat(policy.holdActive(null, T0)).isFalse();
    }

    @Test
    void aFinancingLinkWorksForSevenDaysAndOnlyOnce() {
        Instant expires = policy.linkExpiresAt(T0);
        assertThat(expires).isEqualTo(Instant.parse("2026-09-28T14:00:00Z"));
        assertThat(policy.linkUsable(expires, null, expires.minusSeconds(1))).isTrue();
        assertThat(policy.linkUsable(expires, null, expires)).isFalse();
        assertThat(policy.linkUsable(expires, T0.plusSeconds(60), T0.plusSeconds(120))).isFalse();
        assertThat(policy.linkUsable(null, null, T0)).isFalse();
    }

    @Test
    void thePolicyRejectsMeaninglessValues() {
        Duration day = Duration.ofDays(1);
        assertThatThrownBy(() -> new CrmPolicy(null, day, 5, 2, day)).hasMessageContaining("plazo de la reserva");
        assertThatThrownBy(() -> new CrmPolicy(day, Duration.ZERO, 5, 2, day)).hasMessageContaining("vigencia del enlace");
        assertThatThrownBy(() -> new CrmPolicy(day, day, 5, 2, Duration.ofHours(-1))).hasMessageContaining("ventana");
        assertThatThrownBy(() -> new CrmPolicy(day, day, 0, 2, day)).hasMessageContaining("al menos una cita");
        assertThatThrownBy(() -> new CrmPolicy(day, day, 5, 0, day)).hasMessageContaining("al menos una cita");
    }

    @Test
    void aFinancingLinkTokenIsRandomAndOnlyItsHashIsKept() {
        SecureRandom random = new SecureRandom();
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 10_000; i++) {
            FinancingLinkToken.Issued issued = FinancingLinkToken.issue(random);
            assertThat(seen.add(issued.token())).isTrue();
            assertThat(FinancingLinkToken.hasValidShape(issued.token())).isTrue();
            assertThat(issued.hash()).matches("[0-9a-f]{64}").isEqualTo(FinancingLinkToken.hash(issued.token()));
        }
    }

    @Test
    void theHashIsSha256() {
        // Vector conocido de SHA-256 para "abc".
        assertThat(FinancingLinkToken.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    void anythingThatDoesNotLookLikeATokenIsRejectedEarly() {
        assertThat(FinancingLinkToken.hasValidShape(null)).isFalse();
        assertThat(FinancingLinkToken.hasValidShape("corto")).isFalse();
        assertThat(FinancingLinkToken.hasValidShape("a".repeat(42) + "=")).isFalse();
        assertThat(FinancingLinkToken.hasValidShape("../" + "a".repeat(40))).isFalse();
        assertThat(FinancingLinkToken.hasValidShape("aZ09_-" + "b".repeat(37))).isTrue();
    }
}
