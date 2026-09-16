package com.wamma.inventory;

import com.wamma.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Carga de demostración (D-10, D-25) en una base propia del PostgreSQL embebido, para no
 * mezclar sus 16 vehículos con los de las demás pruebas.
 */
@SpringBootTest
class DemoInventorySeederTest {

    private static final String DATABASE = "demo_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    private static final Path PHOTOS = createDatabaseAndFolder();

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private DemoInventorySeeder seeder;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> PostgresIntegrationTest.jdbcUrl(DATABASE));
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.flyway.user", () -> "postgres");
        registry.add("spring.flyway.password", () -> "postgres");
        registry.add("wamma.security.encryption-key", () -> PostgresIntegrationTest.TEST_ENCRYPTION_KEY);
        registry.add("wamma.security.index-key", () -> PostgresIntegrationTest.TEST_INDEX_KEY);
        registry.add("wamma.fotos.almacen", () -> "disco");
        registry.add("wamma.fotos.disco.carpeta", PHOTOS::toString);
        registry.add("wamma.fotos.url-publica", () -> "http://localhost/archivos");
        registry.add("wamma.demo.cargar-inventario", () -> "true");
    }

    @Test
    void loadsTheDemoVehiclesOnceWithTheirReferencePhotoAndCredit() throws IOException {
        JsonNode data;
        try (InputStream in = new ClassPathResource("demo/inventario.json").getInputStream()) {
            data = json.readTree(in);
        }
        int vehicles = data.get("vehiculos").size();
        int imperfections = 0;
        for (JsonNode vehicle : data.get("vehiculos")) {
            imperfections += vehicle.get("imperfecciones").size();
        }
        assertThat(vehicles).isEqualTo(16);

        List<String> expectedCodes = IntStream.rangeClosed(1, vehicles).mapToObj("veh-%03d"::formatted).toList();
        assertThat(jdbc.sql("select codigo from vehiculo order by codigo").query(String.class).list()).isEqualTo(expectedCodes);
        assertThat(count("select count(*) from vehiculo where es_demostracion")).isEqualTo(vehicles);
        assertThat(count("select count(*) from publicacion where estado = 'borrador' and moneda = 'EUR'")).isEqualTo(vehicles);
        assertThat(count("select count(*) from publicacion_foto where es_principal and credito_autor is not null and credito_licencia is not null"))
                .isEqualTo(vehicles);
        assertThat(count("select count(*) from inspeccion where origen = 'carga_inicial' and inspector_id is null")).isEqualTo(vehicles);
        assertThat(count("select count(*) from inspeccion_punto")).isEqualTo(imperfections);
        assertThat(count("select count(*) from auditoria_evento where accion = 'vehiculo.creado' and despues ->> 'origen' = 'carga_inicial'"))
                .isEqualTo(vehicles);
        try (Stream<Path> files = Files.walk(PHOTOS)) {
            assertThat(files.filter(Files::isRegularFile).count()).isEqualTo(vehicles * 2L);
        }

        seeder.run(null);
        assertThat(count("select count(*) from vehiculo")).isEqualTo(vehicles);
    }

    private long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    private static Path createDatabaseAndFolder() {
        try (Connection connection = DriverManager.getConnection(PostgresIntegrationTest.jdbcUrl(), "postgres", "postgres");
             Statement statement = connection.createStatement()) {
            statement.execute("create database " + DATABASE);
            return Files.createTempDirectory("wamma-fotos-demo");
        } catch (SQLException | IOException e) {
            throw new IllegalStateException("No se pudo preparar la base de la carga de demostración", e);
        }
    }
}
