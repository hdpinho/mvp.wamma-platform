package com.wamma.risk;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * D-63: el scoring, el «AML» y el «Score Buró» están fuera de alcance. Por defecto sus endpoints no existen, ni siquiera
 * para el analista: nadie puede presentar como análisis real lo que no tiene fuente real. Se enciende solo con
 * {@code wamma.riesgo.motor-habilitado=true} (variable {@code WAMMA_RIESGO_MOTOR}).
 */
class RiskEngineSwitchTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(RiskEvaluationService.class, () -> mock(RiskEvaluationService.class))
            .withUserConfiguration(RiskController.class);

    @Test
    void theControllerDoesNotExistByDefault() {
        runner.run(context -> assertThat(context).doesNotHaveBean(RiskController.class));
    }

    @Test
    void theControllerDoesNotExistWhenTheFlagIsExplicitlyOff() {
        runner.withPropertyValues("wamma.riesgo.motor-habilitado=false")
                .run(context -> assertThat(context).doesNotHaveBean(RiskController.class));
    }

    @Test
    void theControllerExistsOnlyWhenTheFlagIsOn() {
        runner.withPropertyValues("wamma.riesgo.motor-habilitado=true")
                .run(context -> assertThat(context).hasSingleBean(RiskController.class));
    }

    /** La configuración que se despliega arranca con el motor apagado, sin importar el entorno. */
    @Test
    void theShippedConfigurationStartsWithTheEngineOff() throws IOException {
        List<PropertySource<?>> documents = new YamlPropertySourceLoader()
                .load("application", new ClassPathResource("application.yml"));
        Object value = documents.stream()
                .map(source -> source.getProperty("wamma.riesgo.motor-habilitado"))
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
        assertThat(value).isEqualTo("${WAMMA_RIESGO_MOTOR:false}");
    }
}
