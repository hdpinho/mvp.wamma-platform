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
        System.setProperty("wamma.cors.allowed-origins", "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174");
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

        org.springframework.context.ConfigurableApplicationContext context = SpringApplication.run(
                new Class<?>[]{WammaApplication.class, DevAutoSessionConfig.class}, args);

        try {
            com.wamma.exchangerate.ExchangeRateRepository ratesRepo = context.getBean(com.wamma.exchangerate.ExchangeRateRepository.class);
            com.wamma.exchangerate.ExchangeRateService ratesService = context.getBean(com.wamma.exchangerate.ExchangeRateService.class);
            com.wamma.inventory.InventoryService inventory = context.getBean(com.wamma.inventory.InventoryService.class);
            com.wamma.platform.identity.UserRepository users = context.getBean(com.wamma.platform.identity.UserRepository.class);

            java.util.UUID adminId = users.findByUsername(ADMIN_USERNAME).map(com.wamma.platform.identity.UserAccount::id).orElse(null);
            if (adminId != null) {
                java.util.Set<String> allRoles = java.util.Arrays.stream(com.wamma.platform.identity.Role.values())
                        .map(Enum::name)
                        .collect(java.util.stream.Collectors.toSet());
                users.replaceRoles(adminId, allRoles, adminId, java.time.Instant.now());
                System.out.println(">>> ROLES COMPLETOS ASIGNADOS A admin.local: " + allRoles);
            }

            java.time.LocalDate today = ratesService.today();
            if (ratesService.currentEuroRate().isEmpty()) {
                ratesRepo.insert(today, com.wamma.platform.money.CurrencyCode.EUR, new java.math.BigDecimal("54.25000000"), "BCV", adminId, java.time.Instant.now());
            }
            com.wamma.inventory.InventoryService.BatchResult result = inventory.publishReady();
            System.out.println(">>> Vehículos publicados en vitrina local: " + result.publicados().size());

            org.springframework.jdbc.core.simple.JdbcClient jdbc = context.getBean(org.springframework.jdbc.core.simple.JdbcClient.class);
            if (adminId != null) {
                byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest("dev-admin-token".getBytes(java.nio.charset.StandardCharsets.UTF_8));
                String tokenHash = java.util.HexFormat.of().formatHex(digest);
                jdbc.sql("""
                    insert into sesion (usuario_id, token_hash, nivel, creada_en, ultimo_uso_en, expira_en, ip_origen, agente_usuario)
                    values (:userId, :hash, 'completa', now(), now(), now() + interval '30 days', '127.0.0.1', 'DevServer')
                    """)
                    .param("userId", adminId, java.sql.Types.OTHER)
                    .param("hash", tokenHash)
                    .update();
                System.out.println(">>> SESIÓN DEV REGISTRADA PARA admin.local (Token: dev-admin-token)");
                com.wamma.platform.auth.SessionService sessionService = context.getBean(com.wamma.platform.auth.SessionService.class);
                System.out.println(">>> AUTH TEST DEV TOKEN: " + sessionService.authenticate("dev-admin-token").isPresent());
            }

            try {
                com.wamma.credit.application.CreditApplicationService creditAppService = context.getBean(com.wamma.credit.application.CreditApplicationService.class);
                com.wamma.crm.OpportunityRepository oppRepo = context.getBean(com.wamma.crm.OpportunityRepository.class);
                com.wamma.crm.OpportunityService oppService = context.getBean(com.wamma.crm.OpportunityService.class);
                com.wamma.inventory.VehicleRepository vehicleRepo = context.getBean(com.wamma.inventory.VehicleRepository.class);
                var oppList = oppRepo.listAll();
                var vehList = vehicleRepo.findAll();
                if (!oppList.isEmpty() && !vehList.isEmpty() && creditAppService.listApplications(null, 10, 0).isEmpty()) {
                    var firstOpp = oppList.getFirst();
                    var saleResult = oppService.sell(firstOpp.id(), "financiamiento");
                    var veh = vehList.getFirst();
                    creditAppService.submitApplication(new com.wamma.credit.application.CreditApplicationDtos.SubmitCreditApplicationRequest(
                            saleResult.financingToken(),
                            veh.id(),
                            new java.math.BigDecimal("12000.00"),
                            new java.math.BigDecimal("4000.00"),
                            36,
                            "MENSUAL",
                            new java.math.BigDecimal("450.50"),
                            new java.math.BigDecimal("1600.00"),
                            java.util.Map.of(
                                    "primerNombre", "Carlos",
                                    "primerApellido", "Mendoza",
                                    "tipoDocumento", "V",
                                    "numeroDocumento", "18456789",
                                    "fechaNacimiento", "1988-05-14",
                                    "estadoCivil", "CASADO",
                                    "cargasFamiliares", 2
                            ),
                            java.util.Map.of(
                                    "telefonoMovil", "+584121234567",
                                    "correoElectronico", "carlos.mendoza@ejemplo.com",
                                    "direccionHabitacion", "Av. Francisco de Miranda, Chacao, Caracas",
                                    "tipoVivienda", "PROPIA"
                            ),
                            java.util.Map.of(
                                    "tipoOcupacion", "EMPLEADO_PRIVADO",
                                    "empresa", "Soluciones Tecnologicas C.A.",
                                    "cargo", "Gerente de Proyectos",
                                    "antiguedadAnios", 5,
                                    "ingresoMensual", 1500.00,
                                    "otrosIngresos", 300.00
                            ),
                            java.util.Map.of(
                                    "egresosTotales", 500.00,
                                    "deudasBancarias", 100.00,
                                    "capacidadNeta", 1200.00
                            ),
                            java.util.List.of(
                                    java.util.Map.of("nombre", "Maria Mendoza", "parentesco", "HERMANA", "telefono", "+584149876543"),
                                    java.util.Map.of("nombre", "Pedro Gomez", "parentesco", "COLEGA", "telefono", "+584245551234")
                            ),
                            java.util.Map.of(
                                    "banco", "Banesco",
                                    "tipoCuenta", "CORRIENTE",
                                    "numeroCuenta", "01340000000000000000"
                            ),
                            java.util.Map.of(
                                    "origenFondosLicito", true,
                                    "autorizaConsultaBNC", true,
                                    "declaraVeracidad", true
                            ),
                            java.util.List.of(
                                    new com.wamma.credit.application.CreditApplicationDtos.DocumentSubmissionDto("CEDULA", "http://localhost:8080/archivos/demo-cedula.pdf", "cedula_carlos.pdf", 245000L, "application/pdf"),
                                    new com.wamma.credit.application.CreditApplicationDtos.DocumentSubmissionDto("RIF", "http://localhost:8080/archivos/demo-rif.pdf", "rif_carlos.pdf", 180000L, "application/pdf"),
                                    new com.wamma.credit.application.CreditApplicationDtos.DocumentSubmissionDto("CERTIFICACION_INGRESOS", "http://localhost:8080/archivos/demo-cert.pdf", "cert_ingresos.pdf", 310000L, "application/pdf"),
                                    new com.wamma.credit.application.CreditApplicationDtos.DocumentSubmissionDto("ESTADO_CUENTA", "http://localhost:8080/archivos/demo-cuenta.pdf", "estado_cuenta_3m.pdf", 520000L, "application/pdf")
                            ),
                            "123456",
                            true
                    ), "127.0.0.1", "LocalDevSeeder");
                    System.out.println(">>> DEMO SOLICITUD DE CRÉDITO SEMBRADA EXITOSAMENTE");
                }
            } catch (Exception ex) {
                System.err.println("Advertencia al sembrar solicitud de crédito demo: " + ex.getMessage());
            }
        } catch (Exception e) {
            System.err.println("Advertencia al publicar catálogo local: " + e.getMessage());
        }
    }

    @org.springframework.context.annotation.Configuration
    public static class DevAutoSessionConfig {
        @org.springframework.context.annotation.Bean
        @org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
        public jakarta.servlet.Filter devTokenSessionFilter(org.springframework.jdbc.core.simple.JdbcClient jdbc) {
            return (request, response, chain) -> {
                if (request instanceof jakarta.servlet.http.HttpServletRequest httpRequest) {
                    String authHeader = httpRequest.getHeader("Authorization");
                    if (authHeader != null && authHeader.trim().equalsIgnoreCase("Bearer dev-admin-token")) {
                        try {
                            byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
                                    .digest("dev-admin-token".getBytes(java.nio.charset.StandardCharsets.UTF_8));
                            String tokenHash = java.util.HexFormat.of().formatHex(digest);
                            java.util.UUID adminId = jdbc.sql("select id from usuario where nombre_usuario = 'admin.local'")
                                    .query(java.util.UUID.class)
                                    .optional()
                                    .orElse(null);
                            if (adminId != null) {
                                int updated = jdbc.sql("""
                                        update sesion
                                        set revocada_en = null,
                                            expira_en = now() + interval '30 days',
                                            ultimo_uso_en = now()
                                        where token_hash = :hash
                                        """)
                                        .param("hash", tokenHash)
                                        .update();
                                if (updated == 0) {
                                    jdbc.sql("""
                                            insert into sesion (usuario_id, token_hash, nivel, creada_en, ultimo_uso_en, expira_en, ip_origen, agente_usuario)
                                            values (:userId, :hash, 'completa', now(), now(), now() + interval '30 days', '127.0.0.1', 'DevServerAuto')
                                            """)
                                            .param("userId", adminId, java.sql.Types.OTHER)
                                            .param("hash", tokenHash)
                                            .update();
                                }
                            }
                        } catch (Exception ignored) {
                        }
                    }
                }
                chain.doFilter(request, response);
            };
        }
    }
}

