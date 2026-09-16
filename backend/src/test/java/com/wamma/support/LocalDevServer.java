package com.wamma.support;

import com.wamma.WammaApplication;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.SpringApplication;

import java.io.IOException;
import java.nio.file.Files;

/**
 * Backend completo en local sobre un PostgreSQL embebido y desechable, para recorrer el
 * frontend sin tocar Supabase:
 * <pre>mvn spring-boot:test-run -Dspring-boot.run.main-class=com.wamma.support.LocalDevServer</pre>
 * Cada arranque parte de una base vacía: Flyway aplica todas las migraciones y se crea el
 * administrador local. Las claves y la contraseña de abajo solo sirven para esa base.
 */
public final class LocalDevServer {

    public static final String ADMIN_USERNAME = "admin.local";
    public static final String ADMIN_INITIAL_PASSWORD = "Clave local de desarrollo 2026";

    private LocalDevServer() {
    }

    public static void main(String[] args) throws IOException {
        EmbeddedPostgres postgres = EmbeddedPostgres.builder().start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                postgres.close();
            } catch (IOException ignored) {
                // Se apaga con la JVM de todos modos.
            }
        }));

        // Las propiedades del sistema mandan sobre application.yml. Sin el perfil supabase,
        // nada apunta a la base compartida.
        System.setProperty("spring.profiles.active", "local");
        System.setProperty("spring.datasource.url", postgres.getJdbcUrl("postgres", "postgres"));
        System.setProperty("spring.datasource.username", "postgres");
        System.setProperty("spring.datasource.password", "postgres");
        System.setProperty("wamma.cors.allowed-origins", "http://localhost:5173,http://localhost:5174");
        System.setProperty("wamma.security.encryption-key", PostgresIntegrationTest.TEST_ENCRYPTION_KEY);
        System.setProperty("wamma.security.index-key", PostgresIntegrationTest.TEST_INDEX_KEY);
        System.setProperty("wamma.bootstrap-admin.username", ADMIN_USERNAME);
        System.setProperty("wamma.bootstrap-admin.first-name", "Admin");
        System.setProperty("wamma.bootstrap-admin.last-name", "Local");
        System.setProperty("wamma.bootstrap-admin.email", "admin@local.invalid");
        System.setProperty("wamma.bootstrap-admin.initial-password", ADMIN_INITIAL_PASSWORD);
        // Fotos en una carpeta temporal, servidas por el backend, y los 16 vehículos de demostración.
        System.setProperty("wamma.fotos.almacen", "disco");
        System.setProperty("wamma.fotos.disco.carpeta",
                Files.createTempDirectory("wamma-fotos-local").toString());
        System.setProperty("wamma.fotos.url-publica", "http://localhost:8080/archivos");
        System.setProperty("wamma.demo.cargar-inventario", "true");

        SpringApplication.run(WammaApplication.class, args);
    }
}
