package com.wamma.financing;

import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FinancingParametersIntegrationTest extends ApiIntegrationTest {

    private TestAccounts.Account advisor;

    @BeforeEach
    void setUpAccounts() {
        advisor = accounts.createAndLogin("asesor_fin", "ASESOR_COMERCIAL");
    }

    @Test
    void publicCanReadActiveFinancingParameters() {
        TestApi.Response res = api.get("/v1/parametros-financiamiento", null);
        assertThat(res.status()).isEqualTo(200);

        Map<String, Object> body = res.map();
        assertThat(body).containsKey("tasa_mensual");
        assertThat(body).containsKey("plazo_meses");
        assertThat(body).containsKey("opciones_inicial");
        assertThat(body.get("plazo_meses")).isEqualTo(24);

        // Validar ruta alternativa
        TestApi.Response aliasRes = api.get("/v1/financiamiento/parametros", null);
        assertThat(aliasRes.status()).isEqualTo(200);
        assertThat(aliasRes.map().get("plazo_meses")).isEqualTo(24);
    }

    @Test
    void unauthenticatedCannotUpdateParameters() {
        TestApi.Response res = api.put("/v1/financiamiento/parametros", null, Map.of(
                "tasa_mensual", 0.05,
                "plazo_meses", 36,
                "ratio_cuota_ingreso", 0.35,
                "opciones_inicial", List.of(0.25, 0.35),
                "inicial_minima", 0.25,
                "moneda_base", "EUR"
        ));
        assertThat(res.status()).isEqualTo(401);
    }

    @Test
    void authorizedUserCanUpdateParametersAndRecordAudit() {
        TestApi.Response updateRes = api.put("/v1/financiamiento/parametros", accounts.adminToken(), Map.of(
                "tasa_mensual", 0.0450,
                "plazo_meses", 30,
                "ratio_cuota_ingreso", 0.30,
                "opciones_inicial", List.of(0.20, 0.30, 0.40),
                "inicial_minima", 0.20,
                "moneda_base", "EUR"
        ));
        assertThat(updateRes.status()).isEqualTo(200);

        // GET posterior recibe los nuevos valores
        TestApi.Response getRes = api.get("/v1/parametros-financiamiento", null);
        assertThat(getRes.status()).isEqualTo(200);
        assertThat(getRes.map().get("plazo_meses")).isEqualTo(30);

        // Verificar registro inmutable en auditoría
        long auditCount = jdbc.sql("""
                select count(*) from auditoria_evento
                where accion = 'parametros_financiamiento.actualizados'
                """)
                .query(Long.class)
                .single();
        assertThat(auditCount).isGreaterThan(0L);
    }
}
