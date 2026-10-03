package com.wamma.platform.config;

import com.wamma.platform.audit.AccessDeniedRecorder;
import com.wamma.platform.auth.SessionAuthenticationFilter;
import com.wamma.platform.auth.SessionService;
import com.wamma.platform.identity.DisabledPermissions;
import com.wamma.platform.identity.UserRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Seguridad HTTP del backoffice (plan 001 §4 y §9).
 * <ul>
 *   <li>Públicos: los endpoints de salud y el primer paso del ingreso.</li>
 *   <li>Con sesión parcial (tras la contraseña): solo los pasos que terminan el ingreso.</li>
 *   <li>Todo lo demás exige sesión completa; cada endpoint pide además su permiso con
 *       {@code @PreAuthorize}.</li>
 * </ul>
 * Los rechazos responden en formato Problem Details, y los 403 quedan en la bitácora.
 * CSRF queda desactivado porque la sesión viaja en una cabecera, no en una cookie (plan §5).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final List<String> allowedOrigins;
    private final SessionService sessions;
    private final UserRepository users;
    private final DisabledPermissions disabledPermissions;
    private final AccessDeniedRecorder accessDeniedRecorder;

    public SecurityConfig(@Value("${wamma.cors.allowed-origins}") String allowedOrigins, SessionService sessions,
                          UserRepository users, DisabledPermissions disabledPermissions,
                          AccessDeniedRecorder accessDeniedRecorder) {
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
        this.sessions = sessions;
        this.users = users;
        this.disabledPermissions = disabledPermissions;
        this.accessDeniedRecorder = accessDeniedRecorder;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .logout(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(new SessionAuthenticationFilter(sessions, users, disabledPermissions), UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, exception) ->
                    writeProblem(response, HttpServletResponse.SC_UNAUTHORIZED,
                        "No autenticado", "Inicia sesión para continuar."))
                .accessDeniedHandler((request, response, exception) -> {
                    accessDeniedRecorder.record();
                    writeProblem(response, HttpServletResponse.SC_FORBIDDEN,
                        "Acceso denegado", "Tu rol no permite esta acción.");
                }))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/api/health", "/error").permitAll()
                // Vitrina pública (spec 005), citas públicas (spec 010), parámetros y solicitud de crédito autoservicio.
                .requestMatchers(HttpMethod.GET, "/v1/catalogo", "/v1/catalogo/**", "/v1/tasa-bcv/vigente",
                        "/archivos/**", "/v1/enlaces-financiamiento/**",
                        "/v1/parametros-financiamiento", "/v1/financiamiento/parametros",
                        "/v1/solicitudes-credito/enlace/**").permitAll()
                // Recaudos: sin sesión, pero solo abren con un enlace firmado y vigente (D-59).
                .requestMatchers(HttpMethod.GET, "/v1/recaudos/archivo").permitAll()
                .requestMatchers(HttpMethod.HEAD, "/v1/catalogo", "/v1/catalogo/**", "/v1/tasa-bcv/vigente",
                        "/archivos/**", "/v1/enlaces-financiamiento/**",
                        "/v1/parametros-financiamiento", "/v1/financiamiento/parametros",
                        "/v1/solicitudes-credito/enlace/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/v1/auth/ingreso", "/v1/citas",
                        "/v1/solicitudes-credito", "/v1/solicitudes-credito/recaudos",
                        "/v1/solicitudes-credito/complemento").permitAll()
                .requestMatchers("/v1/auth/contrasena-inicial", "/v1/auth/2fa", "/v1/auth/2fa/**")
                    .hasAuthority(SessionAuthenticationFilter.PARTIAL)
                .anyRequest().hasAuthority(SessionAuthenticationFilter.COMPLETE)
            );

        return http.build();
    }

    /** Solo los orígenes configurados en {@code wamma.cors.allowed-origins}, sin comodines. */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key", "If-Match", "Accept"));
        configuration.setExposedHeaders(List.of("ETag", "Location"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /** Título y detalle son constantes: no hay entrada del usuario que escapar. */
    private static void writeProblem(HttpServletResponse response, int status, String title, String detail)
            throws IOException {
        response.setStatus(status);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/problem+json");
        response.getWriter().write("{\"type\":\"about:blank\",\"title\":\"" + title
                + "\",\"status\":" + status + ",\"detail\":\"" + detail + "\"}");
    }
}
