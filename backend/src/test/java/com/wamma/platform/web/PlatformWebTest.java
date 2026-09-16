package com.wamma.platform.web;

import com.wamma.platform.audit.AccessDeniedRecorder;
import com.wamma.platform.auth.SessionAuthenticationFilter;
import com.wamma.platform.auth.SessionService;
import com.wamma.platform.config.SecurityConfig;
import com.wamma.platform.identity.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contrato transversal de la API: quién entra, desde qué origen y cómo se ven los errores.
 * El frontend depende de este formato para mostrar mensajes sin interpretar códigos.
 */
@WebMvcTest(controllers = PlatformWebTest.ProbeController.class,
        properties = "wamma.cors.allowed-origins=https://permitido.example, http://localhost:5173")
@Import({SecurityConfig.class, GlobalExceptionHandler.class, PlatformWebTest.ProbeController.class})
class PlatformWebTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SessionService sessionService;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private AccessDeniedRecorder accessDeniedRecorder;

    @Test
    void unauthenticatedRequestGetsProblemJson() throws Exception {
        mockMvc.perform(get("/prueba/protegido"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("No autenticado"));
    }

    @Test
    @WithMockUser(authorities = SessionAuthenticationFilter.PARTIAL)
    void partialSessionIsDeniedAndTheDenialIsRecorded() throws Exception {
        mockMvc.perform(get("/prueba/protegido"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.title").value("Acceso denegado"));
        verify(accessDeniedRecorder).record();
    }

    @Test
    void corsAllowsConfiguredOrigin() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "https://permitido.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://permitido.example"));
    }

    @Test
    void corsRejectsUnknownOrigin() throws Exception {
        mockMvc.perform(options("/api/health")
                        .header("Origin", "https://otro-sitio.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = SessionAuthenticationFilter.COMPLETE)
    void validationErrorsListEachField() throws Exception {
        mockMvc.perform(post("/prueba/eco").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Datos inválidos"))
                .andExpect(jsonPath("$.errores.nombre").value("El nombre es obligatorio"));
    }

    @Test
    @WithMockUser(authorities = SessionAuthenticationFilter.COMPLETE)
    void unexpectedErrorsHideInternalDetails() throws Exception {
        mockMvc.perform(get("/prueba/falla"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.title").value("Error interno"))
                .andExpect(jsonPath("$.codigo").exists())
                .andExpect(content().string(not(containsString("detalle interno"))));
    }

    /** Endpoints mínimos para ejercitar la configuración; solo existen en las pruebas. */
    @RestController
    static class ProbeController {

        record Eco(@NotBlank(message = "El nombre es obligatorio") String nombre) {
        }

        @GetMapping("/prueba/protegido")
        String protegido() {
            return "ok";
        }

        @PostMapping("/prueba/eco")
        Eco eco(@Valid @RequestBody Eco eco) {
            return eco;
        }

        @GetMapping("/prueba/falla")
        String falla() {
            throw new IllegalStateException("detalle interno que no debe salir");
        }
    }
}
