package com.wamma.catalog;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/** Tabla {@code parametros_financiamiento} (V0015). */
@Repository
public class FinancingParametersRepository {

    private final JdbcClient jdbc;

    public FinancingParametersRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * La fila activa más reciente. Si hubiera varias activas —no debería, pero la tabla
     * no lo impide— manda la de {@code vigente_desde} mayor.
     */
    public Optional<FinancingParameters> current() {
        return jdbc.sql("""
                        select tasa_mensual, plazo_meses, ratio_cuota_ingreso, opciones_inicial,
                               inicial_minima, moneda_base
                        from parametros_financiamiento
                        where activo = true
                        order by vigente_desde desc
                        limit 1
                        """)
                .query(FinancingParametersRepository::map)
                .optional();
    }

    private static FinancingParameters map(ResultSet rs, int rowNum) throws SQLException {
        return new FinancingParameters(
                rs.getBigDecimal("tasa_mensual"),
                rs.getInt("plazo_meses"),
                rs.getBigDecimal("ratio_cuota_ingreso"),
                opciones(rs.getArray("opciones_inicial")),
                rs.getBigDecimal("inicial_minima"),
                rs.getString("moneda_base"));
    }

    private static List<BigDecimal> opciones(Array array) throws SQLException {
        if (array == null) {
            return List.of();
        }
        return Arrays.asList((BigDecimal[]) array.getArray());
    }
}
