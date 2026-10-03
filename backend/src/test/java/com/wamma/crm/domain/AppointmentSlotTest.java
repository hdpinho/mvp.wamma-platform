package com.wamma.crm.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AppointmentSlotTest {

    @Test
    void theMorningIsTheSameWhateverHowItIsWritten() {
        for (String raw : new String[]{"manana", "Manana", "mañana", "Mañana", "MAÑANA", "  mañana  ", "MAÑANA"}) {
            assertThat(AppointmentSlot.parse(raw)).as(raw).contains(AppointmentSlot.MORNING);
        }
        assertThat(AppointmentSlot.MORNING.code()).isEqualTo("manana");
    }

    @Test
    void theAfternoonHasASingleCode() {
        for (String raw : new String[]{"tarde", "Tarde", "TARDE", " tarde "}) {
            assertThat(AppointmentSlot.parse(raw)).as(raw).contains(AppointmentSlot.AFTERNOON);
        }
        assertThat(AppointmentSlot.AFTERNOON.code()).isEqualTo("tarde");
    }

    @Test
    void anythingElseIsRejected() {
        for (String raw : new String[]{null, "", "  ", "noche", "mañanas", "m", "morning"}) {
            assertThat(AppointmentSlot.parse(raw)).as(String.valueOf(raw)).isEmpty();
        }
    }
}
