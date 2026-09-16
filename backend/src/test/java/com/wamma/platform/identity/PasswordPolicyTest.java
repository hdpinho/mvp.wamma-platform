package com.wamma.platform.identity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordPolicyTest {

    private final PasswordPolicy policy = PasswordPolicy.withBundledList(12);

    @Test
    void acceptsALongUncommonPassphrase() {
        assertThat(policy.violation("Rio Caura al amanecer", "hdpinho")).isEmpty();
    }

    @Test
    void enforcesLengthLimits() {
        assertThat(policy.violation("corta123", "hdpinho")).hasValue("La contraseña debe tener al menos 12 caracteres.");
        assertThat(policy.violation("x".repeat(11) + "y", "hdpinho")).isEmpty();
        assertThat(policy.violation("ab".repeat(65), "hdpinho")).hasValue("La contraseña no puede superar los 128 caracteres.");
        assertThat(policy.violation(null, "hdpinho")).isPresent();
    }

    @Test
    void rejectsPasswordsContainingTheUsername() {
        assertThat(policy.violation("mi-clave-HDPINHO-2026", "hdpinho"))
                .hasValue("La contraseña no puede contener tu nombre de usuario.");
    }

    @Test
    void rejectsCommonAndRepeatedPasswords() {
        assertThat(policy.violation("Venezuela1234", "hdpinho")).hasValue("Esa contraseña es demasiado común. Elige otra.");
        assertThat(policy.violation("aaaaaaaaaaaaaa", "hdpinho")).hasValue("Esa contraseña es demasiado común. Elige otra.");
    }
}
