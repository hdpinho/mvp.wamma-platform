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
 * <p>
 * El acceso rápido (token fijo {@code dev-admin-token} con los seis roles, sin contraseña ni
 * 2FA) está apagado por defecto. Se enciende solo con
 * {@code -Dspring-boot.run.arguments=--wamma.dev.acceso-rapido=true}. Sin él se ingresa como en
 * producción, y cada rol se prueba con su propio usuario.
 */
public final class LocalDevServer {

    public static final String ADMIN_USERNAME = "admin.local";
    public static final String ADMIN_INITIAL_PASSWORD = "Clave local de desarrollo 2026";
    /** Propiedad que enciende el acceso rápido de desarrollo. Nunca existe fuera de este servidor. */
    public static final String ACCESO_RAPIDO = "wamma.dev.acceso-rapido";

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
        // Recaudos en otra carpeta temporal, privada: solo salen por el enlace firmado (D-59).
        System.setProperty("wamma.recaudos.almacen", "disco");
        System.setProperty("wamma.recaudos.disco.carpeta",
                Files.createTempDirectory("wamma-recaudos-local").toString());
        System.setProperty("wamma.demo.cargar-inventario", "true");

        org.springframework.context.ConfigurableApplicationContext context = SpringApplication.run(
                new Class<?>[]{WammaApplication.class, DevAutoSessionConfig.class}, args);

        try {
            com.wamma.exchangerate.ExchangeRateRepository ratesRepo = context.getBean(com.wamma.exchangerate.ExchangeRateRepository.class);
            com.wamma.exchangerate.ExchangeRateService ratesService = context.getBean(com.wamma.exchangerate.ExchangeRateService.class);
            com.wamma.inventory.InventoryService inventory = context.getBean(com.wamma.inventory.InventoryService.class);
            com.wamma.platform.identity.UserRepository users = context.getBean(com.wamma.platform.identity.UserRepository.class);

            java.util.UUID adminId = users.findByUsername(ADMIN_USERNAME).map(com.wamma.platform.identity.UserAccount::id).orElse(null);
            boolean accesoRapido = context.getEnvironment().getProperty(ACCESO_RAPIDO, Boolean.class, false);
            if (adminId != null && accesoRapido) {
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
            if (adminId != null && accesoRapido) {
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
                // Vender es después de la visita: se toma la oportunidad sembrada que ya visitó la sede.
                var oppList = oppRepo.listAll().stream().filter(o -> "visito".equals(o.stage())).toList();
                var vehList = vehicleRepo.findAll();
                if (!oppList.isEmpty() && !vehList.isEmpty() && creditAppService.listApplications(null, 10, 0).isEmpty()) {
                    var firstOpp = oppList.getFirst();
                    var saleResult = oppService.sell(firstOpp.id(), "financiamiento");
                    // Recaudos de demostración: PDF reales en el almacén privado, bajo la oportunidad.
                    com.wamma.credit.application.documents.DocumentStorage documentStorage =
                            context.getBean(com.wamma.credit.application.documents.DocumentStorage.class);
                    java.util.List<com.wamma.credit.application.CreditApplicationDtos.DocumentSubmissionDto> recaudosDemo =
                            new java.util.ArrayList<>();
                    for (String[] demo : new String[][]{
                            {"cedula", "cedula_carlos.pdf"}, {"rif", "rif_carlos.pdf"},
                            {"ingresos", "cert_ingresos.pdf"}, {"bancario", "estado_cuenta_3m.pdf"}}) {
                        byte[] pdf = demoPdf("Recaudo de demostracion - " + demo[1]);
                        String key = com.wamma.credit.application.documents.DocumentStorage.keyFor(firstOpp.id(),
                                java.util.UUID.randomUUID(), com.wamma.credit.application.documents.DocumentFileType.PDF);
                        documentStorage.put(key, pdf, "application/pdf");
                        recaudosDemo.add(new com.wamma.credit.application.CreditApplicationDtos.DocumentSubmissionDto(
                                demo[0], key, demo[1], (long) pdf.length, "application/pdf"));
                    }
                    creditAppService.submitApplication(new com.wamma.credit.application.CreditApplicationDtos.SubmitCreditApplicationRequest(
                            saleResult.financingToken(),
                            new java.math.BigDecimal("12000.00"),
                            new java.math.BigDecimal("4000.00"),
                            24,
                            "Mensual",
                            new java.math.BigDecimal("450.50"),
                            new java.math.BigDecimal("1600.00"),
                            // Las mismas claves que envía el formulario de la solicitud (C9).
                            java.util.Map.ofEntries(
                                    java.util.Map.entry("primerNombre", "Carlos"),
                                    java.util.Map.entry("primerApellido", "Mendoza"),
                                    java.util.Map.entry("tipoDocumento", "V"),
                                    java.util.Map.entry("numeroDocumento", "18456789"),
                                    java.util.Map.entry("rif", "V-18456789-0"),
                                    java.util.Map.entry("nacionalidad", "Venezolana"),
                                    java.util.Map.entry("estadoCivil", "Casado(a)"),
                                    java.util.Map.entry("fechaNacimiento", "1988-05-14"),
                                    java.util.Map.entry("lugarNacimiento", "Caracas"),
                                    java.util.Map.entry("cargasFamiliares", 2),
                                    java.util.Map.entry("condicionVivienda", "Propia")
                            ),
                            java.util.Map.of(
                                    "direccionHabitacion", "Av. Francisco de Miranda, Chacao, Caracas",
                                    "estado", "Miranda",
                                    "municipio", "Chacao",
                                    "telefonoCelular", "+584121234567",
                                    "correo", "carlos.mendoza@ejemplo.invalid"
                            ),
                            java.util.Map.of(
                                    "situacionLaboral", "Empleado Fijo",
                                    "empresa", "Soluciones Tecnologicas C.A.",
                                    "cargo", "Gerente de Proyectos",
                                    "antiguedadAnios", 5
                            ),
                            java.util.Map.of(
                                    "sueldoMensual", 1500.00,
                                    "otrosIngresos", 300.00,
                                    "alquilerHipoteca", 0,
                                    "alimentacionServicios", 500.00,
                                    "pagosDeudas", 100.00
                            ),
                            java.util.List.of(
                                    java.util.Map.of("nombre", "Maria Mendoza", "parentesco", "Hermana", "telefono", "+584149876543"),
                                    java.util.Map.of("nombre", "Pedro Gomez", "parentesco", "Colega", "telefono", "+584245551234")
                            ),
                            java.util.Map.of(
                                    "banco", "0134",
                                    "tipoCuenta", "Corriente",
                                    "numeroCuenta", "01340000000000000000"
                            ),
                            java.util.Map.of(
                                    "veracidad", true,
                                    "esPep", false,
                                    "vinculoPep", false,
                                    "consentimientoDatos", true
                            ),
                            recaudosDemo,
                            "WMA-F-FIN-001 v1"
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

    /** Un PDF de una página con una línea de texto (solo ASCII, así los desplazamientos son bytes). */
    static byte[] demoPdf(String text) {
        String stream = "BT /F1 14 Tf 24 90 Td (" + text.replaceAll("[^A-Za-z0-9 .:_-]", "") + ") Tj ET";
        String[] objects = {
                "<</Type/Catalog/Pages 2 0 R>>",
                "<</Type/Pages/Kids[3 0 R]/Count 1>>",
                "<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
                "<</Length " + stream.length() + ">>\nstream\n" + stream + "\nendstream",
                "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>"
        };
        StringBuilder pdf = new StringBuilder("%PDF-1.4\n");
        int[] offsets = new int[objects.length];
        for (int i = 0; i < objects.length; i++) {
            offsets[i] = pdf.length();
            pdf.append(i + 1).append(" 0 obj\n").append(objects[i]).append("\nendobj\n");
        }
        int xref = pdf.length();
        pdf.append("xref\n0 ").append(objects.length + 1).append("\n0000000000 65535 f \n");
        for (int offset : offsets) {
            pdf.append(String.format("%010d 00000 n \n", offset));
        }
        pdf.append("trailer\n<</Size ").append(objects.length + 1).append("/Root 1 0 R>>\nstartxref\n")
                .append(xref).append("\n%%EOF\n");
        return pdf.toString().getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    }

    /** Solo con {@link #ACCESO_RAPIDO}: sin la propiedad, el filtro ni siquiera se registra. */
    @org.springframework.context.annotation.Configuration
    @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = ACCESO_RAPIDO, havingValue = "true")
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

