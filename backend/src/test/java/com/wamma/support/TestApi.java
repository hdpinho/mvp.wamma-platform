package com.wamma.support;

import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/** Cliente mínimo de la API para las pruebas de integración. */
public class TestApi {

    public record Response(int status, Object body) {

        @SuppressWarnings("unchecked")
        public Map<String, Object> map() {
            return (Map<String, Object>) body;
        }

        @SuppressWarnings("unchecked")
        public List<Object> list() {
            return (List<Object>) body;
        }

        public String str(String key) {
            Object value = map().get(key);
            return value == null ? null : value.toString();
        }

        @SuppressWarnings("unchecked")
        public Map<String, Object> obj(String key) {
            return (Map<String, Object>) map().get(key);
        }
    }

    private final MockMvc mvc;
    private final ObjectMapper json;

    public TestApi(MockMvc mvc, ObjectMapper json) {
        this.mvc = mvc;
        this.json = json;
    }

    public Response get(String path, String token) {
        return send(MockMvcRequestBuilders.get(path), token, null);
    }

    public Response post(String path, String token, Object body) {
        return send(MockMvcRequestBuilders.post(path), token, body);
    }

    public Response patch(String path, String token, Object body) {
        return send(MockMvcRequestBuilders.patch(path), token, body);
    }

    public Response put(String path, String token, Object body) {
        return send(MockMvcRequestBuilders.put(path), token, body);
    }

    public Response delete(String path, String token) {
        return send(MockMvcRequestBuilders.delete(path), token, null);
    }

    /** Sube un archivo en el campo {@code archivo}, como el formulario del backoffice. */
    public Response upload(String path, String token, byte[] content) {
        MockMultipartFile file = new MockMultipartFile("archivo", "foto.jpg", "image/jpeg", content);
        return send(MockMvcRequestBuilders.multipart(path).file(file), token, null);
    }

    private Response send(AbstractMockHttpServletRequestBuilder<?> request, String token, Object body) {
        try {
            if (token != null) {
                request.header("Authorization", "Bearer " + token);
            }
            if (body != null) {
                request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
            }
            MockHttpServletResponse response = mvc.perform(request).andReturn().getResponse();
            String text = response.getContentAsString(StandardCharsets.UTF_8);
            return new Response(response.getStatus(), text.isBlank() ? null : json.readValue(text, Object.class));
        } catch (Exception e) {
            throw new IllegalStateException("La petición de prueba falló", e);
        }
    }
}
