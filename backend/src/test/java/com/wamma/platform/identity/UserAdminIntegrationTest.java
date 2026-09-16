package com.wamma.platform.identity;

import com.wamma.platform.auth.Totp;
import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/** Administración de usuarios, permisos y bitácora contra la API real (spec 001, §11). */
class UserAdminIntegrationTest extends ApiIntegrationTest {

    @Test
    void onlyUserManagersAdministerUsersAndDenialsAreAudited() {
        TestAccounts.Account asesor = accounts.createAndLogin("asesor", "ASESOR_COMERCIAL");
        assertThat(api.get("/v1/usuarios", asesor.token()).status()).isEqualTo(403);
        assertThat(api.get("/v1/usuarios", accounts.adminToken()).status()).isEqualTo(200);

        Long denials = jdbc.sql("select count(*) from auditoria_evento where accion = 'acceso.denegado' and actor_id = :id")
                .param("id", asesor.id())
                .query(Long.class)
                .single();
        assertThat(denials).isPositive();
    }

    @Test
    void deactivatingAUserClosesItsSessionsAtOnce() {
        TestAccounts.Account user = accounts.createAndLogin("baja", "INVENTARIO");
        TestApi.Response deactivated = api.patch("/v1/usuarios/" + user.id(), accounts.adminToken(), Map.of("estado", "inactivo"));
        assertThat(deactivated.status()).isEqualTo(200);
        assertThat(deactivated.str("estado")).isEqualTo("inactivo");

        assertThat(api.get("/v1/auth/yo", user.token()).status()).isEqualTo(401);
        assertThat(login(user.username(), user.password()).status()).isEqualTo(401);
    }

    @Test
    void theLastAdministratorCannotBeRemoved() {
        String token = accounts.adminToken();
        UUID adminId = UUID.fromString(api.get("/v1/auth/yo", token).str("id"));

        TestApi.Response self = api.patch("/v1/usuarios/" + adminId, token, Map.of("estado", "inactivo"));
        assertThat(self.status()).isEqualTo(409);

        TestApi.Response demoted = api.patch("/v1/usuarios/" + adminId, token, Map.of("roles", List.of("AUDITOR")));
        assertThat(demoted.status()).isEqualTo(409);
        assertThat(demoted.str("detail")).isEqualTo("Debe quedar al menos un administrador activo.");
    }

    @Test
    void resettingAPasswordForcesAChangeAndClosesSessions() {
        TestAccounts.Account user = accounts.createAndLogin("reinicio", "INVENTARIO");
        TestApi.Response reset = api.post("/v1/usuarios/" + user.id() + "/restablecer-contrasena", accounts.adminToken(), null);
        assertThat(reset.status()).isEqualTo(200);

        assertThat(api.get("/v1/auth/yo", user.token()).status()).isEqualTo(401);
        assertThat(login(user.username(), reset.str("contrasenaTemporal")).str("siguiente")).isEqualTo("CAMBIAR_CONTRASENA");
    }

    @Test
    void resettingTheSecondFactorRequiresActivatingItAgain() {
        TestAccounts.Account user = accounts.createAndLogin("nuevo2fa", "INVENTARIO");
        assertThat(api.post("/v1/usuarios/" + user.id() + "/restablecer-2fa", accounts.adminToken(), null).status())
                .isEqualTo(204);
        assertThat(login(user.username(), user.password()).str("siguiente")).isEqualTo("ACTIVAR_2FA");
    }

    @Test
    void theRoleMatrixInTheDatabaseIsTheApprovedOne() {
        Map<String, Set<String>> database = new TreeMap<>();
        jdbc.sql("""
                        select r.codigo as rol, p.codigo as permiso
                        from rol_permiso rp join rol r on r.id = rp.rol_id join permiso p on p.id = rp.permiso_id
                        """)
                .query((rs, n) -> Map.entry(rs.getString("rol"), rs.getString("permiso")))
                .list()
                .forEach(entry -> database.computeIfAbsent(entry.getKey(), key -> new TreeSet<>()).add(entry.getValue()));

        Map<String, Set<String>> approved = new TreeMap<>();
        for (Role role : Role.values()) {
            approved.put(role.name(), role.permissions().stream().map(Permission::code)
                    .collect(Collectors.toCollection(TreeSet::new)));
        }
        assertThat(database).isEqualTo(approved);
    }

    @Test
    void theAuditLogIsForAuditorsAndAdministratorsOnly() {
        TestAccounts.Account auditor = accounts.createAndLogin("auditor", "AUDITOR");
        TestAccounts.Account asesor = accounts.createAndLogin("curioso", "ASESOR_COMERCIAL");

        TestApi.Response page = api.get("/v1/auditoria?accion=usuario.creado&limite=5", auditor.token());
        assertThat(page.status()).isEqualTo(200);
        assertThat((List<?>) page.map().get("eventos")).isNotEmpty();
        assertThat(api.get("/v1/auditoria", asesor.token()).status()).isEqualTo(403);
    }

    @Test
    void theAuditLogNeverContainsSecrets() {
        TestAccounts.Created created = accounts.createUser("secretos", "INVENTARIO");
        TestAccounts.Account user = accounts.login(created.username(), created.temporaryPassword(), null,
                "Otra frase larga de prueba");

        String everything = jdbc.sql("""
                        select coalesce(string_agg(coalesce(antes::text, '') || ' ' || coalesce(despues::text, ''), ' '), '')
                        from auditoria_evento
                        """)
                .query(String.class)
                .single();
        assertThat(everything).doesNotContain(created.temporaryPassword(), user.password(),
                Totp.base32(user.secret()), user.token());
        user.recoveryCodes().forEach(code -> assertThat(everything).doesNotContain(code));
    }

    @Test
    void theBootstrapAdministratorExistsOnceWithItsRole() {
        Long admins = jdbc.sql("""
                        select count(*) from usuario u
                        join usuario_rol ur on ur.usuario_id = u.id
                        join rol r on r.id = ur.rol_id
                        where u.nombre_usuario = :username and r.codigo = 'ADMINISTRADOR'
                        """)
                .param("username", ADMIN_USERNAME)
                .query(Long.class)
                .single();
        assertThat(admins).isEqualTo(1);
    }
}
