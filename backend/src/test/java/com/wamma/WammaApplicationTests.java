package com.wamma;

import com.wamma.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * El contexto completo arranca sobre un PostgreSQL real, y Flyway aplica todas las
 * migraciones desde cero: es la prueba de que el entorno se puede reconstruir (Principio II).
 */
@SpringBootTest
class WammaApplicationTests extends PostgresIntegrationTest {

    @Autowired
    private JdbcClient jdbc;

    @Test
    void contextLoadsAndSchemaIsAtTheLatestVersion() {
        String version = jdbc.sql("select max(version::int)::text from flyway_schema_history where success")
                .query(String.class)
                .single();
        assertThat(Integer.parseInt(version)).isGreaterThanOrEqualTo(14);
    }
}
