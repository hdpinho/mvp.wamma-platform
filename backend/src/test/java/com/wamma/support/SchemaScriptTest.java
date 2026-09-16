package com.wamma.support;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Corre {@code tools/db/pruebas-esquema.sql} en modo {@code desde-cero} contra el PostgreSQL
 * embebido: aplica todas las migraciones en un esquema temporal y ejecuta las pruebas del
 * esquema, dentro de una transacción que se revierte. Así esas pruebas también corren en
 * local, no solo en la CI (plan 005, tarea B1).
 */
class SchemaScriptTest {

    @Test
    void migrationsBuildTheSchemaFromScratchAndPassTheSchemaTests() throws Exception {
        String java = ProcessHandle.current().info().command().orElse("java");
        Class<?> driver = Class.forName("org.postgresql.Driver");
        String driverJar = Path.of(driver.getProtectionDomain().getCodeSource().getLocation().toURI()).toString();

        ProcessBuilder builder = new ProcessBuilder(java, "-cp", driverJar,
                "tools/db/SchemaTestRunner.java", "desde-cero", "tools/db/pruebas-esquema.sql")
                .redirectErrorStream(true);
        builder.environment().put("FLYWAY_URL", PostgresIntegrationTest.jdbcUrl());
        builder.environment().put("FLYWAY_USER", "postgres");
        builder.environment().put("FLYWAY_PASSWORD", "postgres");

        Process process = builder.start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        assertThat(process.waitFor(3, TimeUnit.MINUTES)).as("el runner terminó a tiempo").isTrue();
        assertThat(process.exitValue()).as(output).isZero();
    }
}
