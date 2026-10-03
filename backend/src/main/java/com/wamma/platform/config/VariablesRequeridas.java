package com.wamma.platform.config;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
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
 * el {@code application.yml} ya esté cargado y los perfiles resueltos. Se registra en
 * {@code META-INF/spring.factories}: Spring Boot no lee estos procesadores de ningún otro sitio.
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

    /** Las fotos y los recaudos comparten el endpoint y las claves del almacén S3. */
    private static final List<String> CREDENCIALES_S3 = List.of(
            "WAMMA_S3_ENDPOINT",
            "WAMMA_S3_REGION",
            "WAMMA_S3_ACCESS_KEY",
            "WAMMA_S3_SECRET_KEY");

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment entorno, SpringApplication aplicacion) {
        if (!entorno.acceptsProfiles(Profiles.of("supabase"))) {
            return;
        }

        String almacenFotos = entorno.getProperty("WAMMA_FOTOS_ALMACEN");
        boolean fotosEnS3 = usaS3(almacenFotos);
        // Los recaudos van al almacén de las fotos salvo que se diga otra cosa (application.yml).
        String almacenRecaudos = entorno.getProperty("WAMMA_RECAUDOS_ALMACEN");
        boolean recaudosEnS3 = usaS3(vacia(almacenRecaudos) ? almacenFotos : almacenRecaudos);

        List<String> exigidas = new ArrayList<>(SIEMPRE);
        if (fotosEnS3 || recaudosEnS3) {
            exigidas.addAll(CREDENCIALES_S3);
        }
        if (fotosEnS3) {
            exigidas.add("WAMMA_S3_BUCKET");
        }
        if (recaudosEnS3) {
            // Contenedor PRIVADO, distinto del de las fotos (D-59): se declara siempre.
            exigidas.add("WAMMA_S3_BUCKET_RECAUDOS");
        }

        List<String> faltantes = new ArrayList<>();
        for (String variable : exigidas) {
            if (vacia(entorno.getProperty(variable))) {
                faltantes.add(variable);
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

    /** El perfil supabase manda fotos y recaudos a S3 salvo que se diga otra cosa. */
    private static boolean usaS3(String almacen) {
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
