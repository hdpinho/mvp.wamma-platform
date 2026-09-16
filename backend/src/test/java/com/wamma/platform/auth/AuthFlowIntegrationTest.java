package com.wamma.platform.auth;

import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import org.assertj.core.api.InstanceOfAssertFactories;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Ingreso al backoffice contra la API real y un PostgreSQL real (spec 001, §11). */
class AuthFlowIntegrationTest extends ApiIntegrationTest {

    @Test
    void firstLoginChangesPasswordActivatesTotpAndDeliversRecoveryCodes() {
        TestAccounts.Created created = accounts.createUser("asesor", "ASESOR_COMERCIAL");

        TestApi.Response step = login(created.username(), created.temporaryPassword());
        assertThat(step.status()).isEqualTo(200);
        assertThat(step.str("siguiente")).isEqualTo("CAMBIAR_CONTRASENA");
        String temporaryToken = step.str("tokenTemporal");

        TestApi.Response weak = api.post("/v1/auth/contrasena-inicial", temporaryToken, Map.of("nueva", "corta"));
        assertThat(weak.status()).isEqualTo(400);
        assertThat(weak.str("title")).isEqualTo("Contraseña no válida");

        TestApi.Response changed = api.post("/v1/auth/contrasena-inicial", temporaryToken,
                Map.of("nueva", "Una frase larga y propia"));
        assertThat(changed.str("siguiente")).isEqualTo("ACTIVAR_2FA");

        TestApi.Response setup = api.post("/v1/auth/2fa/activacion", temporaryToken, Map.of());
        assertThat(setup.str("uriOtpauth")).startsWith("otpauth://totp/WAMMA");
        byte[] secret = Totp.fromBase32(setup.str("secreto"));

        TestApi.Response wrong = api.post("/v1/auth/2fa/confirmacion", temporaryToken,
                Map.of("codigo", differentFrom(accounts.code(secret))));
        assertThat(wrong.status()).isEqualTo(400);

        TestApi.Response session = api.post("/v1/auth/2fa/confirmacion", temporaryToken,
                Map.of("codigo", accounts.code(secret)));
        assertThat(session.status()).isEqualTo(200);
        assertThat((List<?>) session.map().get("codigosRecuperacion")).hasSize(10);

        TestApi.Response me = api.get("/v1/auth/yo", session.str("token"));
        assertThat(me.status()).isEqualTo(200);
        assertThat(me.map().get("permisos")).asInstanceOf(InstanceOfAssertFactories.list(String.class))
                .contains("crm.operar")
                .doesNotContain("usuarios.gestionar");
    }

    @Test
    void unknownUsersAndWrongPasswordsGetTheSameAnswer() {
        TestAccounts.Created created = accounts.createUser("neutral", "INVENTARIO");
        TestApi.Response unknown = login("no.existe", "cualquier cosa larga");
        TestApi.Response wrong = login(created.username(), "cualquier cosa larga");
        assertThat(unknown.status()).isEqualTo(401);
        assertThat(wrong.status()).isEqualTo(401);
        assertThat(unknown.str("detail")).isEqualTo(wrong.str("detail")).isEqualTo("Usuario o contraseña incorrectos.");
    }

    @Test
    void anAccountLocksAfterFiveFailuresEvenForTheRightPassword() {
        TestAccounts.Created created = accounts.createUser("bloqueo", "INVENTARIO");
        for (int i = 0; i < 4; i++) {
            assertThat(login(created.username(), "contraseña equivocada").status()).isEqualTo(401);
        }
        assertThat(login(created.username(), "contraseña equivocada").status()).isEqualTo(423);
        assertThat(login(created.username(), created.temporaryPassword()).status()).isEqualTo(423);

        clock.advance(Duration.ofMinutes(16));
        TestApi.Response afterLockout = login(created.username(), created.temporaryPassword());
        assertThat(afterLockout.status()).isEqualTo(200);
        assertThat(afterLockout.str("siguiente")).isEqualTo("CAMBIAR_CONTRASENA");
    }

    @Test
    void aTotpCodeCannotBeUsedTwice() {
        TestAccounts.Account account = accounts.createAndLogin("reuso", "INVENTARIO");
        String usedCode = accounts.code(account.secret());
        api.post("/v1/auth/salida", account.token(), null);

        String temporaryToken = login(account.username(), account.password()).str("tokenTemporal");
        assertThat(api.post("/v1/auth/2fa", temporaryToken, Map.of("codigo", usedCode)).status()).isEqualTo(400);

        clock.advance(Duration.ofSeconds(Totp.PERIOD_SECONDS + 1));
        assertThat(api.post("/v1/auth/2fa", temporaryToken, Map.of("codigo", accounts.code(account.secret()))).status())
                .isEqualTo(200);
    }

    @Test
    void aRecoveryCodeWorksOnceAndRequiresANewAuthenticator() {
        TestAccounts.Account account = accounts.createAndLogin("recupera", "INVENTARIO");
        clock.advance(Duration.ofSeconds(Totp.PERIOD_SECONDS + 1));
        String temporaryToken = login(account.username(), account.password()).str("tokenTemporal");

        TestApi.Response recovered = api.post("/v1/auth/2fa", temporaryToken,
                Map.of("codigoRecuperacion", account.recoveryCodes().getFirst()));
        assertThat(recovered.status()).isEqualTo(200);
        assertThat(recovered.str("siguiente")).isEqualTo("ACTIVAR_2FA");

        byte[] newSecret = Totp.fromBase32(api.post("/v1/auth/2fa/activacion", temporaryToken, Map.of()).str("secreto"));
        assertThat(api.post("/v1/auth/2fa/confirmacion", temporaryToken, Map.of("codigo", accounts.code(newSecret))).status())
                .isEqualTo(200);

        clock.advance(Duration.ofSeconds(Totp.PERIOD_SECONDS + 1));
        String again = login(account.username(), account.password()).str("tokenTemporal");
        assertThat(api.post("/v1/auth/2fa", again, Map.of("codigoRecuperacion", account.recoveryCodes().getFirst())).status())
                .isEqualTo(400);
        assertThat(api.post("/v1/auth/2fa", again, Map.of("codigoRecuperacion", account.recoveryCodes().get(1))).status())
                .isEqualTo(400);
    }

    @Test
    void aPartialSessionCannotReachTheBackofficeAndTheDenialIsAudited() {
        TestAccounts.Created created = accounts.createUser("parcial", "INVENTARIO");
        String temporaryToken = login(created.username(), created.temporaryPassword()).str("tokenTemporal");

        assertThat(api.get("/v1/auth/yo", temporaryToken).status()).isEqualTo(403);
        Long denials = jdbc.sql("select count(*) from auditoria_evento where accion = 'acceso.denegado' and actor_id = :id")
                .param("id", created.id())
                .query(Long.class)
                .single();
        assertThat(denials).isPositive();
    }

    @Test
    void logoutRevokesTheSession() {
        TestAccounts.Account account = accounts.createAndLogin("salida", "INVENTARIO");
        assertThat(api.post("/v1/auth/salida", account.token(), null).status()).isEqualTo(204);
        assertThat(api.get("/v1/auth/yo", account.token()).status()).isEqualTo(401);
    }

    @Test
    void anIdleSessionExpires() {
        TestAccounts.Account account = accounts.createAndLogin("inactivo", "INVENTARIO");
        assertThat(api.get("/v1/auth/yo", account.token()).status()).isEqualTo(200);
        clock.advance(Duration.ofMinutes(31));
        assertThat(api.get("/v1/auth/yo", account.token()).status()).isEqualTo(401);
    }

    private static String differentFrom(String code) {
        return code.equals("000000") ? "111111" : "000000";
    }
}
