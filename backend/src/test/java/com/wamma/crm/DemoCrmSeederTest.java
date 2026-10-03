package com.wamma.crm;

import com.wamma.inventory.VehicleRepository;
import com.wamma.platform.identity.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * La siembra del CRM solo existe en el servidor local (tarea E1). La bandera
 * {@code wamma.demo.cargar-inventario} se enciende también en el primer despliegue (D-10), así
 * que por sí sola no puede bastar: en producción no se crean personas ficticias.
 */
class DemoCrmSeederTest {

    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(DemoCrmSeeder.class)
            .withBean(UserRepository.class, () -> mock(UserRepository.class))
            .withBean(PersonRepository.class, () -> mock(PersonRepository.class))
            .withBean(OpportunityRepository.class, () -> mock(OpportunityRepository.class))
            .withBean(AppointmentRepository.class, () -> mock(AppointmentRepository.class))
            .withBean(VehicleRepository.class, () -> mock(VehicleRepository.class))
            .withBean(TransactionTemplate.class, () -> mock(TransactionTemplate.class))
            .withBean(Clock.class, Clock::systemUTC)
            .withPropertyValues("wamma.demo.cargar-inventario=true");

    @Test
    void doesNotExistWithTheProductionProfileEvenWithTheDemoFlag() {
        context.withPropertyValues("spring.profiles.active=supabase")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(DemoCrmSeeder.class));
    }

    @Test
    void existsOnlyOnTheLocalServer() {
        context.withPropertyValues("spring.profiles.active=local")
                .run(ctx -> assertThat(ctx).hasSingleBean(DemoCrmSeeder.class));
    }
}
