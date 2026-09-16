import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Properties;

/**
 * Pruebas del esquema de base de datos, siempre dentro de UNA transacción que se revierte:
 * este programa no contiene ningún COMMIT. Nunca imprime credenciales.
 *
 * Uso (desde backend/):
 *   java -cp <postgresql.jar> tools/db/SchemaTestRunner.java <modo> tools/db/pruebas-esquema.sql [versión]
 *
 * Modos:
 *   pruebas     corre las pruebas sobre el esquema tal como está (CI, tras flyway:migrate).
 *   ensayo      aplica las migraciones desde [versión] y corre las pruebas: el ensayo previo
 *               a aplicar una migración en Supabase.
 *   desde-cero  crea un esquema temporal, aplica todas las migraciones y corre las pruebas.
 *
 * Conexión: FLYWAY_URL, FLYWAY_USER y FLYWAY_PASSWORD. Si faltan, lee SUPABASE_DB_* de .env;
 * con -Dport=6543 usa el pooler de Supabase en modo transacción.
 * Con -Dbloqueo, otra conexión mantiene abierto flyway_schema_history, como hace Flyway
 * mientras migra (ver database-schema-design.md §5.4).
 *
 * Formato del archivo de pruebas: bloques que empiezan con una línea
 *   -- @verdad <descripción>   consulta que debe devolver true
 *   -- @ok <descripción>       sentencias que deben ejecutarse sin error (sus cambios siguen vivos)
 *   -- @error <descripción>    sentencias que el motor debe rechazar
 *
 * Sale con código 1 si falla una migración o una prueba.
 */
public class SchemaTestRunner {

    private static final Path MIGRATIONS = Path.of("src/main/resources/db/migration");

    record ConnectionInfo(String url, Properties properties) {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Uso: SchemaTestRunner <pruebas|ensayo|desde-cero> <archivo.sql> [version]");
            System.exit(2);
        }
        String mode = args[0];
        Path testFile = Path.of(args[1]);
        int fromVersion = switch (mode) {
            case "pruebas" -> Integer.MAX_VALUE;
            case "desde-cero" -> 1;
            case "ensayo" -> {
                if (args.length < 3) {
                    System.err.println("El modo ensayo necesita la version inicial, por ejemplo: ensayo pruebas.sql 13");
                    System.exit(2);
                }
                yield Integer.parseInt(args[2]);
            }
            default -> {
                System.err.println("Modo desconocido: " + mode);
                System.exit(2);
                yield 0;
            }
        };

        List<Path> migrations = new ArrayList<>();
        if (fromVersion != Integer.MAX_VALUE) {
            try (var files = Files.list(MIGRATIONS)) {
                files.filter(f -> f.getFileName().toString().matches("V\\d{4}__.*\\.sql"))
                        .sorted()
                        .forEach(migrations::add);
            }
        }

        ConnectionInfo info = connectionInfo();
        System.out.println("Destino: " + info.url().replaceAll("\\?.*$", ""));

        boolean ok = false;
        try (Connection connection = DriverManager.getConnection(info.url(), info.properties())) {
            connection.setAutoCommit(false);
            Connection lockHolder = null;
            try (Statement st = connection.createStatement()) {
                st.execute("SET LOCAL statement_timeout = '120s'");
                st.execute("SET LOCAL lock_timeout = '15s'");
                if (System.getProperty("bloqueo") != null) {
                    lockHolder = DriverManager.getConnection(info.url(), info.properties());
                    lockHolder.setAutoCommit(false);
                    try (Statement lock = lockHolder.createStatement()) {
                        lock.execute("select count(*) from flyway_schema_history");
                    }
                    System.out.println("Bloqueo simulado: otra transaccion mantiene abierto flyway_schema_history");
                }
                if (mode.equals("desde-cero")) {
                    st.execute("CREATE SCHEMA wamma_ensayo");
                    st.execute("SET LOCAL search_path = wamma_ensayo, extensions");
                }
                try (ResultSet rs = st.executeQuery("select current_schema()")) {
                    rs.next();
                    System.out.println("Modo " + mode + " sobre el esquema: " + rs.getString(1));
                }
                for (Path migration : migrations) {
                    int version = Integer.parseInt(migration.getFileName().toString().substring(1, 5));
                    if (version < fromVersion) {
                        continue;
                    }
                    long start = System.nanoTime();
                    st.execute(Files.readString(migration));
                    System.out.printf("MIGRACION OK  %s (%d ms)%n", migration.getFileName(),
                            (System.nanoTime() - start) / 1_000_000);
                }
                ok = runTests(connection, testFile);
            } catch (SQLException e) {
                System.out.println("FALLO: " + e.getMessage());
            } finally {
                connection.rollback();
                if (lockHolder != null) {
                    lockHolder.rollback();
                    lockHolder.close();
                }
                System.out.println("ROLLBACK ejecutado: ningun cambio persiste.");
            }
        }
        System.exit(ok ? 0 : 1);
    }

    private static boolean runTests(Connection connection, Path file) throws Exception {
        List<String[]> blocks = new ArrayList<>();
        String header = null;
        StringBuilder body = new StringBuilder();
        for (String line : Files.readAllLines(file)) {
            if (line.startsWith("-- @")) {
                if (header != null) {
                    blocks.add(new String[]{header, body.toString()});
                }
                header = line.substring(4).trim();
                body = new StringBuilder();
            } else {
                body.append(line).append('\n');
            }
        }
        if (header != null) {
            blocks.add(new String[]{header, body.toString()});
        }

        int passed = 0;
        int failed = 0;
        try (Statement st = connection.createStatement()) {
            for (String[] block : blocks) {
                String kind = block[0].split(" ", 2)[0];
                String label = block[0].contains(" ") ? block[0].split(" ", 2)[1] : "";
                st.execute("SAVEPOINT prueba");
                try {
                    boolean hasResult = st.execute(block[1]);
                    if (kind.equals("verdad")) {
                        boolean value = false;
                        if (hasResult) {
                            try (ResultSet rs = st.getResultSet()) {
                                value = rs.next() && rs.getBoolean(1);
                            }
                        }
                        if (value) {
                            passed++;
                            System.out.println("OK     " + label);
                        } else {
                            failed++;
                            System.out.println("FALLA  " + label + "  -> resultado falso");
                        }
                        st.execute("RELEASE SAVEPOINT prueba");
                    } else if (kind.equals("error")) {
                        failed++;
                        System.out.println("FALLA  " + label + "  -> se esperaba un error y no lo hubo");
                        st.execute("ROLLBACK TO SAVEPOINT prueba");
                    } else {
                        passed++;
                        System.out.println("OK     " + label);
                        st.execute("RELEASE SAVEPOINT prueba");
                    }
                } catch (SQLException e) {
                    st.execute("ROLLBACK TO SAVEPOINT prueba");
                    String message = e.getMessage().split("\n")[0];
                    if (kind.equals("error")) {
                        passed++;
                        System.out.println("OK     " + label + "  -> rechazado: " + message);
                    } else {
                        failed++;
                        System.out.println("FALLA  " + label + "  -> " + message);
                    }
                }
            }
        }
        System.out.printf("Pruebas: %d OK, %d fallos%n", passed, failed);
        return failed == 0;
    }

    private static ConnectionInfo connectionInfo() throws Exception {
        Properties properties = new Properties();
        properties.setProperty("prepareThreshold", "0");
        properties.setProperty("ApplicationName", "wamma-pruebas-esquema");
        properties.setProperty("connectTimeout", "40");
        properties.setProperty("socketTimeout", "300");

        String url = System.getenv("FLYWAY_URL");
        if (url != null && !url.isBlank()) {
            properties.setProperty("user", Objects.requireNonNullElse(System.getenv("FLYWAY_USER"), ""));
            properties.setProperty("password", Objects.requireNonNullElse(System.getenv("FLYWAY_PASSWORD"), ""));
            return new ConnectionInfo(url, properties);
        }

        Map<String, String> env = readDotEnv(Path.of(".env"));
        url = env.get("SUPABASE_DB_URL");
        if (url == null) {
            throw new IllegalStateException("Falta FLYWAY_URL y no hay SUPABASE_DB_URL en .env");
        }
        String port = System.getProperty("port");
        if (port != null) {
            url = url.replaceFirst(":\\d+/", ":" + port + "/");
        }
        properties.setProperty("user", Objects.requireNonNullElse(env.get("SUPABASE_DB_USER"), ""));
        properties.setProperty("password", Objects.requireNonNullElse(env.get("SUPABASE_DB_PASSWORD"), ""));
        return new ConnectionInfo(url, properties);
    }

    private static Map<String, String> readDotEnv(Path path) throws Exception {
        Map<String, String> env = new HashMap<>();
        if (!Files.exists(path)) {
            return env;
        }
        for (String line : Files.readAllLines(path)) {
            String l = line.trim();
            if (l.isEmpty() || l.startsWith("#") || !l.contains("=")) {
                continue;
            }
            int i = l.indexOf('=');
            String value = l.substring(i + 1).trim();
            if (value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
                    || (value.startsWith("'") && value.endsWith("'")))) {
                value = value.substring(1, value.length() - 1);
            }
            env.put(l.substring(0, i).trim(), value);
        }
        return env;
    }
}
