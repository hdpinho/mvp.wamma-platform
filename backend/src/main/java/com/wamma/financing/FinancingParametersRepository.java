package com.wamma.financing;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Acceso a datos para la tabla {@code parametros_financiamiento} (V0015).
 */
@Repository
public class FinancingParametersRepository {

    private final JdbcClient jdbc;

    public FinancingParametersRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<FinancingParameters> findActive() {
        return jdbc.sql("""
                select id, tasa_mensual, plazo_meses, ratio_cuota_ingreso, opciones_inicial,
                       inicial_minima, moneda_base, vigente_desde, activo
                from parametros_financiamiento
                where activo = true
                order by vigente_desde desc
                limit 1
                """)
                .query(FinancingParametersRepository::map)
                .optional();
    }

    public FinancingParameters saveNewActive(BigDecimal monthlyRate, int termMonths,
                                            BigDecimal paymentToIncomeRatio,
                                            List<BigDecimal> downPaymentOptions,
                                            BigDecimal minimumDownPayment,
                                            String baseCurrency) {
        // Desactivar parámetros anteriores
        jdbc.sql("update parametros_financiamiento set activo = false where activo = true")
                .update();

        String arraySql = "ARRAY[" + downPaymentOptions.stream()
                .map(BigDecimal::toPlainString)
                .collect(Collectors.joining(",")) + "]::numeric[]";

        String currency = (baseCurrency != null && !baseCurrency.isBlank()) ? baseCurrency.toUpperCase() : "EUR";

        String sql = "insert into parametros_financiamiento ("
                + " tasa_mensual, plazo_meses, ratio_cuota_ingreso, opciones_inicial,"
                + " inicial_minima, moneda_base, vigente_desde, activo"
                + " ) values ("
                + " :tasa, :plazo, :ratio, " + arraySql + ","
                + " :minInicial, :moneda, now(), true"
                + " ) returning id, vigente_desde";

        record InsertResult(UUID id, OffsetDateTime vigenteDesde) {}

        InsertResult res = jdbc.sql(sql)
                .param("tasa", monthlyRate)
                .param("plazo", termMonths)
                .param("ratio", paymentToIncomeRatio)
                .param("minInicial", minimumDownPayment)
                .param("moneda", currency)
                .query((rs, rowNum) -> new InsertResult(
                        rs.getObject("id", UUID.class),
                        rs.getObject("vigente_desde", OffsetDateTime.class)
                ))
                .single();

        Instant vigenteDesde = res.vigenteDesde() != null ? res.vigenteDesde().toInstant() : Instant.now();

        return new FinancingParameters(
                res.id(),
                monthlyRate,
                termMonths,
                paymentToIncomeRatio,
                downPaymentOptions,
                minimumDownPayment,
                currency,
                vigenteDesde,
                true
        );
    }

    private static FinancingParameters map(ResultSet rs, int rowNum) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        BigDecimal tasaMensual = rs.getBigDecimal("tasa_mensual");
        int plazoMeses = rs.getInt("plazo_meses");
        BigDecimal ratio = rs.getBigDecimal("ratio_cuota_ingreso");
        BigDecimal minInicial = rs.getBigDecimal("inicial_minima");
        String moneda = rs.getString("moneda_base");
        OffsetDateTime odt = rs.getObject("vigente_desde", OffsetDateTime.class);
        Instant vigenteDesde = odt != null ? odt.toInstant() : Instant.now();
        boolean activo = rs.getBoolean("activo");

        List<BigDecimal> opciones = new ArrayList<>();
        Array sqlArr = rs.getArray("opciones_inicial");
        if (sqlArr != null) {
            Object arrObj = sqlArr.getArray();
            if (arrObj instanceof Object[] items) {
                for (Object item : items) {
                    if (item != null) {
                        opciones.add(new BigDecimal(item.toString()));
                    }
                }
            }
        }

        return new FinancingParameters(
                id,
                tasaMensual,
                plazoMeses,
                ratio,
                opciones,
                minInicial,
                moneda,
                vigenteDesde,
                activo
        );
    }
}
