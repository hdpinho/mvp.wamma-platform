package com.wamma.platform.identity;

import com.wamma.platform.config.SecurityProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class IdentityConfig {

    /** BCrypt con prefijo de algoritmo ({@code {bcrypt}…}): permite cambiarlo más adelante sin migrar. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    public PasswordPolicy passwordPolicy(SecurityProperties properties) {
        return PasswordPolicy.withBundledList(properties.passwordMinLength());
    }
}
