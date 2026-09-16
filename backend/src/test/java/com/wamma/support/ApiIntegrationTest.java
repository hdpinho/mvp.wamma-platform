package com.wamma.support;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

/** Base de las pruebas de la API: contexto completo, PostgreSQL embebido y reloj controlable. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfig.class)
public abstract class ApiIntegrationTest extends PostgresIntegrationTest {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper json;

    @Autowired
    protected MutableClock clock;

    @Autowired
    protected JdbcClient jdbc;

    protected TestApi api;
    protected TestAccounts accounts;

    @BeforeEach
    void setUpApi() {
        api = new TestApi(mvc, json);
        accounts = new TestAccounts(api, clock);
    }

    protected TestApi.Response login(String username, String password) {
        return api.post("/v1/auth/ingreso", null, Map.of("usuario", username, "contrasena", password));
    }
}
