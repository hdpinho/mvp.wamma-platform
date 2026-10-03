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
        String adminToken = accounts.adminToken();
        TestApi.Response updateRes = api.put("/v1/financiamiento/parametros", adminToken, politica(0.0450));
        assertThat(updateRes.status()).isEqualTo(200);

        try {
            // GET posterior recibe los nuevos valores
            TestApi.Response getRes = api.get("/v1/parametros-financiamiento", null);
            assertThat(getRes.status()).isEqualTo(200);
            assertThat(getRes.map().get("tasa_mensual")).isEqualTo(0.045);

            // Verificar registro inmutable en auditoría
            long auditCount = jdbc.sql("""
                    select count(*) from auditoria_evento
                    where accion = 'parametros_financiamiento.actualizados'
                    """)
                    .query(Long.class)
                    .single();
            assertThat(auditCount).isGreaterThan(0L);
        } finally {
            // La base es compartida entre pruebas: se deja la política aprobada (D-26).
            assertThat(api.put("/v1/financiamiento/parametros", adminToken, politica(0.04)).status()).isEqualTo(200);
        }
    }

    /** Cotizar no da permiso para cambiar la política de toda la plataforma (D-14, D-26). */
    @Test
    void anAdvisorCannotChangeTheOfficialPolicy() {
        TestApi.Response res = api.put("/v1/parametros-financiamiento", advisor.token(), politica(0.01));
        assertThat(res.status()).isEqualTo(403);
        assertThat(api.get("/v1/parametros-financiamiento", null).map().get("tasa_mensual")).isEqualTo(0.04);
    }

    /** D-55: 24 meses, como mínimo y como máximo, también para quien administra la política. */
    @Test
    void thePolicyOnlyAdmitsA24MonthTermAndTheEuroAsBaseCurrency() {
        String adminToken = accounts.adminToken();
        Map<String, Object> otroPlazo = new java.util.HashMap<>(politica(0.04));
        otroPlazo.put("plazo_meses", 36);
        assertThat(api.put("/v1/parametros-financiamiento", adminToken, otroPlazo).status()).isEqualTo(422);

        Map<String, Object> otraMoneda = new java.util.HashMap<>(politica(0.04));
        otraMoneda.put("moneda_base", "USD");
        assertThat(api.put("/v1/parametros-financiamiento", adminToken, otraMoneda).status()).isEqualTo(422);

        // Nada cambió y la política sembrada ya está en euros (V0020; antes decía USD).
        TestApi.Response vigente = api.get("/v1/parametros-financiamiento", null);
        assertThat(vigente.map().get("plazo_meses")).isEqualTo(24);
        assertThat(vigente.map().get("moneda_base")).isEqualTo("EUR");
    }

    private static Map<String, Object> politica(double tasaMensual) {
        return Map.of(
                "tasa_mensual", tasaMensual,
                "plazo_meses", 24,
                "ratio_cuota_ingreso", 0.30,
                "opciones_inicial", List.of(0.20, 0.30, 0.40),
                "inicial_minima", 0.20,
                "moneda_base", "EUR"
        );
    }
}
