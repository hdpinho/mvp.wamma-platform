package com.wamma.support;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Base de las pruebas de integración: un PostgreSQL 17 real, embebido y compartido por todas
 * (D-24, plan 001 S10). Flyway construye el esquema desde cero (V0001 en adelante) al
 * arrancar el contexto, así que cada ejecución también prueba las migraciones.
 * <p>
 * Las claves y contraseñas de prueba son valores fijos, conocidos y sin valor: no son secretos.
 */
public abstract class PostgresIntegrationTest {

    public static final String TEST_ENCRYPTION_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
    public static final String TEST_INDEX_KEY = "ZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1+f4CBgoM=";
    public static final String ADMIN_USERNAME = "admin.pruebas";
    public static final String ADMIN_INITIAL_PASSWORD = "Clave inicial de pruebas 2026";

    private static final EmbeddedPostgres POSTGRES = start();

    private static EmbeddedPostgres start() {
        try {
            EmbeddedPostgres postgres = EmbeddedPostgres.builder().start();
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try {
                    postgres.close();
                } catch (IOException ignored) {
                    // Se apaga con la JVM de todos modos.
                }
            }));
            return postgres;
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo iniciar el PostgreSQL embebido", e);
        }
    }

    /** Carpeta de fotos de las pruebas: el adaptador de disco, igual que en local. */
    public static final Path PHOTOS = createPhotosFolder();

    /** URL del PostgreSQL embebido compartido, para pruebas que abren su propia conexión. */
    public static String jdbcUrl() {
        return POSTGRES.getJdbcUrl("postgres", "postgres");
    }

    /** URL de otra base en el mismo PostgreSQL embebido. */
    public static String jdbcUrl(String database) {
        return POSTGRES.getJdbcUrl("postgres", database);
    }

    private static Path createPhotosFolder() {
        try {
            return Files.createTempDirectory("wamma-fotos-pruebas");
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo crear la carpeta de fotos de las pruebas", e);
        }
    }

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        String url = POSTGRES.getJdbcUrl("postgres", "postgres");
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.flyway.user", () -> "postgres");
        registry.add("spring.flyway.password", () -> "postgres");
        registry.add("wamma.security.encryption-key", () -> TEST_ENCRYPTION_KEY);
        registry.add("wamma.security.index-key", () -> TEST_INDEX_KEY);
        // Las pruebas hacen muchos ingresos desde 127.0.0.1; el límite por IP se prueba aparte.
        registry.add("wamma.security.login-attempts-per-ip", () -> "100000");
        registry.add("wamma.bootstrap-admin.username", () -> ADMIN_USERNAME);
        registry.add("wamma.bootstrap-admin.first-name", () -> "Admin");
        registry.add("wamma.bootstrap-admin.last-name", () -> "Pruebas");
        registry.add("wamma.bootstrap-admin.email", () -> "admin@pruebas.invalid");
        registry.add("wamma.bootstrap-admin.initial-password", () -> ADMIN_INITIAL_PASSWORD);
        registry.add("wamma.fotos.almacen", () -> "disco");
        registry.add("wamma.fotos.disco.carpeta", PHOTOS::toString);
        registry.add("wamma.fotos.url-publica", () -> "http://localhost/archivos");
    }
}
