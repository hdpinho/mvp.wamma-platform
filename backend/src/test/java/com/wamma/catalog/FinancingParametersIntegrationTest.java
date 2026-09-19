package com.wamma.catalog;

import com.wamma.support.ApiIntegrationTest;
import com.wamma.support.TestApi;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Parámetros de financiamiento servidos por el backend (spec 011 §6.2). Las pruebas
 * trabajan sobre la fila real que instaló V0015 y dejan la tabla como estaba.
 */
class FinancingParametersIntegrationTest extends ApiIntegrationTest {

    @Test
    @DisplayName("La vitrina lee los parámetros sin sesión")
    void devuelveLosParametrosVigentesSinSesion() {
        TestApi.Response respuesta = api.get("/v1/parametros-financiamiento", null);

        assertThat(respuesta.status()).isEqualTo(200);
        Map<String, Object> cuerpo = respuesta.map();
        assertThat((Integer) cuerpo.get("plazoMeses")).isPositive();
        assertThat(cuerpo.get("tasaMensual")).isNotNull();
        assertThat(cuerpo.get("inicialMinima")).isNotNull();
        assertThat((List<?>) cuerpo.get("opcionesInicial")).isNotEmpty();
        assertThat((String) cuerpo.get("monedaBase")).isNotBlank();
    }

    @Test
    @DisplayName("Con varias filas activas manda la de vigencia más reciente")
    void devuelveLaMasReciente() {
        jdbc.sql("""
                insert into parametros_financiamiento
                    (tasa_mensual, plazo_meses, ratio_cuota_ingreso, opciones_inicial,
                     inicial_minima, moneda_base, vigente_desde, activo)
                values (0.0500, 36, 0.35, ARRAY[0.25, 0.50], 0.25, 'EUR', now() + interval '1 day', true)
                """).update();
        try {
            assertThat((Integer) api.get("/v1/parametros-financiamiento", null).map().get("plazoMeses"))
                    .isEqualTo(36);
        } finally {
            jdbc.sql("delete from parametros_financiamiento where plazo_meses = 36").update();
        }
    }

    @Test
    @DisplayName("Sin parámetros activos responde error, nunca una cuota inventada")
    void sinParametrosActivosRespondeError() {
        jdbc.sql("update parametros_financiamiento set activo = false where activo = true").update();
        try {
            assertThat(api.get("/v1/parametros-financiamiento", null).status()).isEqualTo(503);
        } finally {
            jdbc.sql("update parametros_financiamiento set activo = true where activo = false").update();
        }
    }
}
