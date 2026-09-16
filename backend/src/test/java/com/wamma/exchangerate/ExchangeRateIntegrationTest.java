package com.wamma.exchangerate;

import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestAccounts;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Tasa BCV del euro (spec 005 RF-005.10, plan E2) contra la API real. */
class ExchangeRateIntegrationTest extends ApiIntegrationTest {

    @Test
    void theEuroRateIsRegisteredCorrectedAndShownToThePublic() {
        jdbc.sql("delete from tasa_cambio_bcv where moneda = 'EUR'").update();
        assertThat(api.get("/v1/tasa-bcv/vigente", null).map().get("tasa")).isNull();

        TestAccounts.Account analyst = accounts.createAndLogin("analista", "ANALISTA_CREDITO");
        String today = today().toString();
        TestApi.Response first = api.post("/v1/tasas-bcv", analyst.token(),
                Map.of("fecha", today, "tasa", new BigDecimal("45.12345678"), "fuente", "BCV"));
        assertThat(first.status()).isEqualTo(200);
        assertThat(first.map().get("corregida")).isEqualTo(false);

        Map<String, Object> current = api.get("/v1/tasa-bcv/vigente", null).obj("tasa");
        assertThat(current.get("fecha")).isEqualTo(today);
        assertThat(new BigDecimal(current.get("tasa").toString())).isEqualByComparingTo("45.12345678");
        assertThat(current).doesNotContainKeys("registradaPor", "corregidaPor");

        TestApi.Response corrected = api.post("/v1/tasas-bcv", analyst.token(),
                Map.of("fecha", today, "tasa", new BigDecimal("46.5"), "fuente", "BCV"));
        assertThat(corrected.map().get("corregida")).isEqualTo(true);

        List<Object> history = api.get("/v1/tasas-bcv", analyst.token()).list();
        Map<?, ?> latest = (Map<?, ?>) history.getFirst();
        assertThat(new BigDecimal(latest.get("tasa").toString())).isEqualByComparingTo("46.5");
        assertThat(latest.get("corregidaPor")).isEqualTo(analyst.username());

        String trail = jdbc.sql("""
                        select antes::text || ' ' || despues::text from auditoria_evento
                        where accion = 'tasa_bcv.corregida' order by creado_en desc limit 1
                        """)
                .query(String.class)
                .single();
        assertThat(trail).contains("45.12345678").contains("46.5");
    }

    @Test
    void futureDaysAndExcessDecimalsAreRejected() {
        String token = accounts.adminToken();
        TestApi.Response future = api.post("/v1/tasas-bcv", token,
                Map.of("fecha", today().plusDays(1).toString(), "tasa", 40, "fuente", "BCV"));
        assertThat(future.status()).isEqualTo(400);

        TestApi.Response decimals = api.post("/v1/tasas-bcv", token,
                Map.of("fecha", today().toString(), "tasa", new BigDecimal("40.123456789"), "fuente", "BCV"));
        assertThat(decimals.status()).isEqualTo(400);
        assertThat(decimals.str("detail")).isEqualTo("La tasa admite hasta 8 decimales.");
    }

    @Test
    void onlyAdministratorsAndCreditAnalystsRegisterIt() {
        TestAccounts.Account advisor = accounts.createAndLogin("asesor", "ASESOR_COMERCIAL");
        assertThat(api.post("/v1/tasas-bcv", advisor.token(),
                Map.of("fecha", today().toString(), "tasa", 40, "fuente", "BCV")).status()).isEqualTo(403);
        assertThat(api.get("/v1/tasas-bcv", advisor.token()).status()).isEqualTo(403);
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(ExchangeRateService.VENEZUELA));
    }
}
