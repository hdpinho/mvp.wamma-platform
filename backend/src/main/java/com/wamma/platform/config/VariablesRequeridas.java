package com.wamma.platform.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Profiles;

import java.util.ArrayList;
import java.util.List;

/**
 * Comprueba, al arrancar con el perfil {@code supabase}, que estén todas las variables de
 * entorno que ese perfil necesita, y las nombra <strong>todas juntas</strong> si faltan.
 * <p>
 * Existe por dos razones. La primera es que fallar de una en una obliga a desplegar tantas
 * veces como variables falten. La segunda, más importante: el perfil {@code supabase} ya no
 * tiene valores por defecto, así que sin esta comprobación el fallo sería un
 * "Could not resolve placeholder" en medio de la creación de un bean, que no dice cuál es
 * el problema ni cuántos más vienen detrás.
 * <p>
 * Corre como {@link EnvironmentPostProcessor} y no como bean para adelantarse a la
 * construcción del origen de datos. Con {@link Ordered#LOWEST_PRECEDENCE} se garantiza que
 * el {@code application.yml} ya esté cargado y los perfiles resueltos.
 */
public class VariablesRequeridas implements EnvironmentPostProcessor, Ordered {

    /** Siempre exigidas por el perfil supabase. */
    private static final List<String> SIEMPRE = List.of(
            "SUPABASE_DB_URL",
            "SUPABASE_DB_USER",
            "SUPABASE_DB_PASSWORD",
            "FLYWAY_DB_USER",
            "FLYWAY_DB_PASSWORD",
            "WAMMA_CLAVE_CIFRADO",
            "WAMMA_CLAVE_INDICE",
            "WAMMA_CORS_ORIGINS",
            "WAMMA_FOTOS_URL_PUBLICA");

    /** Exigidas solo cuando las fotos van a un almacén S3, que es el caso por defecto. */
    private static final List<String> ALMACEN_S3 = List.of(
            "WAMMA_S3_ENDPOINT",
            "WAMMA_S3_REGION",
            "WAMMA_S3_BUCKET",
            "WAMMA_S3_ACCESS_KEY",
            "WAMMA_S3_SECRET_KEY");

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment entorno, SpringApplication aplicacion) {
        if (!entorno.acceptsProfiles(Profiles.of("supabase"))) {
            return;
        }

        List<String> faltantes = new ArrayList<>();
        for (String variable : SIEMPRE) {
            if (vacia(entorno.getProperty(variable))) {
                faltantes.add(variable);
            }
        }
        if (usaS3(entorno)) {
            for (String variable : ALMACEN_S3) {
                if (vacia(entorno.getProperty(variable))) {
                    faltantes.add(variable);
                }
            }
        }

        if (!faltantes.isEmpty()) {
            throw new IllegalStateException(
                    "El perfil supabase necesita estas variables de entorno y no están definidas: "
                            + String.join(", ", faltantes)
                            + ". Se cargan en el Dashboard de Render (sync: false en render.yaml), "
                            + "nunca en el repositorio.");
        }
    }

    /** El perfil supabase manda las fotos a S3 salvo que se diga otra cosa. */
    private static boolean usaS3(ConfigurableEnvironment entorno) {
        String almacen = entorno.getProperty("WAMMA_FOTOS_ALMACEN");
        return vacia(almacen) || "s3".equalsIgnoreCase(almacen.trim());
    }

    private static boolean vacia(String valor) {
        return valor == null || valor.isBlank();
    }

    @Override
    public int getOrder() {
        // Después de que ConfigData haya cargado application.yml y resuelto los perfiles.
        return Ordered.LOWEST_PRECEDENCE;
    }
}
