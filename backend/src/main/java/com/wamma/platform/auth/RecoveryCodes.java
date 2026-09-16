package com.wamma.platform.auth;

import com.wamma.platform.crypto.BlindIndex;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.sql.Types;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Códigos de recuperación del 2FA (plan 001, S7). Diez por usuario, en formato
 * {@code XXXXX-XXXXX} y sin caracteres ambiguos; cada uno sirve una vez.
 * <p>
 * Se guarda un HMAC con la clave del servidor, no el código: una copia de la base sola no
 * permite probarlos por fuerza bruta.
 */
@Component
public class RecoveryCodes {

    static final int COUNT = 10;
    private static final String ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final String CONTEXT = "codigo_recuperacion";

    private final JdbcClient jdbc;
    private final BlindIndex index;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public RecoveryCodes(JdbcClient jdbc, BlindIndex index, Clock clock) {
        this.jdbc = jdbc;
        this.index = index;
        this.clock = clock;
    }

    /** Sustituye los códigos del usuario por diez nuevos y los devuelve: se muestran una sola vez. */
    public List<String> regenerate(UUID userId) {
        deleteAll(userId);
        List<String> codes = new ArrayList<>(COUNT);
        for (int i = 0; i < COUNT; i++) {
            String code = newCode();
            codes.add(code);
            jdbc.sql("insert into codigo_recuperacion (usuario_id, codigo_hash, creado_en) values (:userId, :hash, :now)")
                    .param("userId", userId, Types.OTHER)
                    .param("hash", index.of(normalize(code), CONTEXT))
                    .param("now", OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC), Types.TIMESTAMP_WITH_TIMEZONE)
                    .update();
        }
        return codes;
    }

    /** Marca el código como usado si era válido y no se había usado (CA-001.7). */
    public boolean consume(UUID userId, String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return jdbc.sql("""
                        update codigo_recuperacion set usado_en = :now
                        where usuario_id = :userId and codigo_hash = :hash and usado_en is null
                        """)
                .param("now", OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("userId", userId, Types.OTHER)
                .param("hash", index.of(normalize(code), CONTEXT))
                .update() == 1;
    }

    public void deleteAll(UUID userId) {
        jdbc.sql("delete from codigo_recuperacion where usuario_id = :userId")
                .param("userId", userId, Types.OTHER)
                .update();
    }

    static String normalize(String code) {
        return code.replace("-", "").replace(" ", "").toUpperCase(Locale.ROOT);
    }

    private String newCode() {
        StringBuilder code = new StringBuilder(11);
        for (int i = 0; i < 10; i++) {
            if (i == 5) {
                code.append('-');
            }
            code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }
}
