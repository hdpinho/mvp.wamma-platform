package com.wamma.support;

import com.wamma.platform.auth.Totp;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cuentas para las pruebas: el administrador de arranque y usuarios creados por él, con el
 * ingreso completo (cambio de contraseña y activación del 2FA) hecho por la API real.
 * <p>
 * El estado del administrador se comparte entre clases de prueba, como el PostgreSQL embebido.
 */
public class TestAccounts {

    public static final String ADMIN_NEW_PASSWORD = "Nueva clave del administrador 2026";

    private static String adminPassword = PostgresIntegrationTest.ADMIN_INITIAL_PASSWORD;
    private static byte[] adminSecret;

    public record Account(UUID id, String username, String password, byte[] secret, String token,
                          List<String> recoveryCodes) {
    }

    public record Created(UUID id, String username, String temporaryPassword) {
    }

    private final TestApi api;
    private final MutableClock clock;

    public TestAccounts(TestApi api, MutableClock clock) {
        this.api = api;
        this.clock = clock;
    }

    public synchronized String adminToken() {
        Account admin = login(PostgresIntegrationTest.ADMIN_USERNAME, adminPassword, adminSecret, ADMIN_NEW_PASSWORD);
        adminPassword = admin.password();
        adminSecret = admin.secret();
        return admin.token();
    }

    public Created createUser(String prefix, String... roles) {
        String username = prefix + "." + UUID.randomUUID().toString().substring(0, 8);
        TestApi.Response response = api.post("/v1/usuarios", adminToken(), Map.of(
                "usuario", username,
                "nombre", "Nombre",
                "apellido", "Prueba",
                "correo", username + "@pruebas.invalid",
                "roles", List.of(roles)));
        require(response, 201);
        return new Created(UUID.fromString(response.obj("usuario").get("id").toString()), username,
                response.str("contrasenaTemporal"));
    }

    /** Alta y primer ingreso completo. */
    public Account createAndLogin(String prefix, String... roles) {
        Created created = createUser(prefix, roles);
        return login(created.username(), created.temporaryPassword(), null,
                "Frase segura para pruebas " + UUID.randomUUID().toString().substring(0, 6));
    }

    /**
     * Ingreso completo. Adelanta el reloj un paso TOTP para que cada ingreso use un código
     * nuevo, y completa los pasos que el servidor pida.
     */
    public Account login(String username, String password, byte[] secret, String newPassword) {
        clock.advance(Duration.ofSeconds(Totp.PERIOD_SECONDS + 1));
        TestApi.Response step = api.post("/v1/auth/ingreso", null, Map.of("usuario", username, "contrasena", password));
        require(step, 200);
        String temporaryToken = step.str("tokenTemporal");
        String next = step.str("siguiente");
        String currentPassword = password;
        if ("CAMBIAR_CONTRASENA".equals(next)) {
            TestApi.Response changed = api.post("/v1/auth/contrasena-inicial", temporaryToken, Map.of("nueva", newPassword));
            require(changed, 200);
            next = changed.str("siguiente");
            currentPassword = newPassword;
        }
        byte[] currentSecret = secret;
        List<String> codes = List.of();
        TestApi.Response session;
        if ("ACTIVAR_2FA".equals(next)) {
            TestApi.Response setup = api.post("/v1/auth/2fa/activacion", temporaryToken, Map.of());
            require(setup, 200);
            currentSecret = Totp.fromBase32(setup.str("secreto"));
            session = api.post("/v1/auth/2fa/confirmacion", temporaryToken, Map.of("codigo", code(currentSecret)));
            require(session, 200);
            codes = session.map().get("codigosRecuperacion") instanceof List<?> list
                    ? list.stream().map(Object::toString).toList()
                    : List.of();
        } else {
            session = api.post("/v1/auth/2fa", temporaryToken, Map.of("codigo", code(currentSecret)));
            require(session, 200);
        }
        UUID id = UUID.fromString(session.obj("usuario").get("id").toString());
        return new Account(id, username, currentPassword, currentSecret, session.str("token"), codes);
    }

    public String code(byte[] secret) {
        return Totp.code(secret, Totp.step(clock.instant()));
    }

    private static void require(TestApi.Response response, int status) {
        if (response.status() != status) {
            throw new IllegalStateException("Se esperaba " + status + " y llegó " + response.status() + ": " + response.body());
        }
    }
}
