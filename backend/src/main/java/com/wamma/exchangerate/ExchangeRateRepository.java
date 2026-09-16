package com.wamma.exchangerate;

import com.wamma.platform.money.CurrencyCode;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Tabla {@code tasa_cambio_bcv}: una tasa por fecha y moneda (V0014). */
@Repository
public class ExchangeRateRepository {

    private static final String SELECT = """
            select t.id, t.fecha, t.moneda, t.tasa_ves, t.fuente, t.capturado_en, cu.nombre_usuario as capturada_por,
                   t.actualizado_en, au.nombre_usuario as corregida_por
            from tasa_cambio_bcv t
            left join usuario cu on cu.id = t.capturado_por
            left join usuario au on au.id = t.actualizado_por
            """;

    private final JdbcClient jdbc;

    public ExchangeRateRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** La de fecha más reciente, hasta el día indicado inclusive. */
    public Optional<BcvRate> latest(CurrencyCode currency, LocalDate upTo) {
        return jdbc.sql(SELECT + " where t.moneda = :currency and t.fecha <= :upTo order by t.fecha desc limit 1")
                .param("currency", currency.name())
                .param("upTo", upTo)
                .query(ExchangeRateRepository::map)
                .optional();
    }

    public Optional<BcvRate> find(LocalDate date, CurrencyCode currency) {
        return jdbc.sql(SELECT + " where t.moneda = :currency and t.fecha = :date")
                .param("currency", currency.name())
                .param("date", date)
                .query(ExchangeRateRepository::map)
                .optional();
    }

    public List<BcvRate> history(CurrencyCode currency, int limit) {
        return jdbc.sql(SELECT + " where t.moneda = :currency order by t.fecha desc limit :limit")
                .param("currency", currency.name())
                .param("limit", limit)
                .query(ExchangeRateRepository::map)
                .list();
    }

    public UUID insert(LocalDate date, CurrencyCode currency, BigDecimal rate, String source, UUID userId, Instant now) {
        return jdbc.sql("""
                        insert into tasa_cambio_bcv (fecha, moneda, tasa_ves, fuente, capturado_en, capturado_por)
                        values (:date, :currency, :rate, :source, :now, :user)
                        returning id
                        """)
                .param("date", date)
                .param("currency", currency.name())
                .param("rate", rate)
                .param("source", source)
                .param("now", OffsetDateTime.ofInstant(now, ZoneOffset.UTC))
                .param("user", userId)
                .query(UUID.class)
                .single();
    }

    public void correct(UUID id, BigDecimal rate, String source, UUID userId, Instant now) {
        jdbc.sql("""
                        update tasa_cambio_bcv
                        set tasa_ves = :rate, fuente = :source, actualizado_en = :now, actualizado_por = :user
                        where id = :id
                        """)
                .param("rate", rate)
                .param("source", source)
                .param("now", OffsetDateTime.ofInstant(now, ZoneOffset.UTC))
                .param("user", userId)
                .param("id", id)
                .update();
    }

    private static BcvRate map(ResultSet rs, int rowNum) throws SQLException {
        OffsetDateTime corrected = rs.getObject("actualizado_en", OffsetDateTime.class);
        return new BcvRate(
                rs.getObject("id", UUID.class),
                rs.getObject("fecha", LocalDate.class),
                CurrencyCode.valueOf(rs.getString("moneda")),
                rs.getBigDecimal("tasa_ves").stripTrailingZeros(),
                rs.getString("fuente"),
                rs.getObject("capturado_en", OffsetDateTime.class).toInstant(),
                rs.getString("capturada_por"),
                corrected == null ? null : corrected.toInstant(),
                rs.getString("corregida_por"));
    }
}
