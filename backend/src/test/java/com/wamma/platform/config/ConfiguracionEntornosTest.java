package com.wamma.platform.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.StandardEnvironment;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pruebas de la configuración de entornos (spec 011 §6.1 y §6.4). Leen los archivos de
 * configuración como texto a propósito: lo que se quiere comprobar es lo que está escrito
 * en ellos, no lo que Spring deduzca después de resolver los valores por defecto.
 */
class ConfiguracionEntornosTest {

    private static final Path APPLICATION_YML = Path.of("src/main/resources/application.yml");
    private static final Path RENDER_YAML = Path.of("../render.yaml");

    /** Variables que Render inyecta o que no son del perfil supabase. */
    private static final Set<String> AJENAS_A_RENDER = Set.of("PORT", "SERVER_PORT");

    @Test
    @DisplayName("El perfil por defecto es local: arrancar sin configurar no apunta a la base compartida")
    void perfilPorDefectoEsLocal() {
        assertThat(texto(APPLICATION_YML)).contains("default: local");
    }

    @Test
    @DisplayName("Flyway no migra salvo que el entorno lo active")
    void flywayDeshabilitadoPorDefecto() {
        assertThat(texto(APPLICATION_YML)).contains("enabled: ${FLYWAY_ENABLED:false}");
    }

    @Test
    @DisplayName("El perfil supabase no conserva ningún valor por defecto que falle en silencio")
    void perfilSupabaseSinValoresPorDefecto() {
        String supabase = bloqueDelPerfilSupabase();
        Matcher conDefecto = Pattern.compile("\\$\\{([A-Z_][A-Z0-9_]*):([^}]*)}").matcher(supabase);
        Set<String> ofensores = new LinkedHashSet<>();
        while (conDefecto.find()) {
            // WAMMA_FOTOS_ALMACEN es la única excepción admitida: su defecto ("s3") es el
            // comportamiento correcto en producción, no un respaldo que enmascare un olvido.
            if (!"WAMMA_FOTOS_ALMACEN".equals(conDefecto.group(1))) {
                ofensores.add(conDefecto.group(1) + " -> " + conDefecto.group(2));
            }
        }
        assertThat(ofensores)
                .as("en el perfil supabase, un valor por defecto deja el servidor arrancando "
                        + "en verde contra el destino equivocado")
                .isEmpty();
    }

    @Test
    @DisplayName("Toda variable del perfil supabase está declarada en render.yaml")
    void variablesDelPerfilSupabaseDeclaradasEnRender() {
        Set<String> enRender = new LinkedHashSet<>();
        Matcher claves = Pattern.compile("- key: ([A-Z_][A-Z0-9_]*)").matcher(texto(RENDER_YAML));
        while (claves.find()) {
            enRender.add(claves.group(1));
        }

        Set<String> sinDeclarar = new LinkedHashSet<>();
        Matcher usadas = Pattern.compile("\\$\\{([A-Z_][A-Z0-9_]*)").matcher(bloqueDelPerfilSupabase());
        while (usadas.find()) {
            String variable = usadas.group(1);
            if (!AJENAS_A_RENDER.contains(variable) && !enRender.contains(variable)) {
                sinDeclarar.add(variable);
            }
        }

        assertThat(sinDeclarar)
                .as("una variable que el perfil supabase lee y render.yaml no declara es "
                        + "justo el hueco que dejó las fotos apuntando a localhost")
                .isEmpty();
    }

    @Test
    @DisplayName("El validador nombra todas las variables faltantes de una vez, no la primera")
    void validadorNombraTodasLasFaltantes() {
        StandardEnvironment entorno = new StandardEnvironment();
        entorno.setActiveProfiles("supabase");

        assertThatThrownBy(() -> new VariablesRequeridas()
                .postProcessEnvironment(entorno, new SpringApplication()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SUPABASE_DB_URL")
                .hasMessageContaining("FLYWAY_DB_USER")
                .hasMessageContaining("FLYWAY_DB_PASSWORD")
                .hasMessageContaining("WAMMA_CLAVE_CIFRADO")
                .hasMessageContaining("WAMMA_FOTOS_URL_PUBLICA")
                .hasMessageContaining("WAMMA_S3_ENDPOINT")
                .hasMessageContaining("WAMMA_S3_SECRET_KEY");
    }

    @Test
    @DisplayName("Sin el perfil supabase el validador no estorba: local y pruebas siguen arrancando")
    void validadorNoActuaFueraDeSupabase() {
        StandardEnvironment entorno = new StandardEnvironment();
        entorno.setActiveProfiles("local");

        new VariablesRequeridas().postProcessEnvironment(entorno, new SpringApplication());
    }

    /** El bloque del documento YAML que activa el perfil supabase. */
    private static String bloqueDelPerfilSupabase() {
        String[] documentos = texto(APPLICATION_YML).split("(?m)^---$");
        for (String documento : documentos) {
            if (documento.contains("on-profile: supabase")) {
                return documento;
            }
        }
        throw new AssertionError("application.yml ya no tiene un bloque para el perfil supabase");
    }

    private static String texto(Path ruta) {
        try {
            return Files.readString(ruta);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer " + ruta.toAbsolutePath(), e);
        }
    }
}
