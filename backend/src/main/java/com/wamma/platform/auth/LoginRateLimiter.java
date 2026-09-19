package com.wamma.platform.auth;

import com.wamma.platform.config.SecurityProperties;
import com.wamma.platform.web.RateLimitedException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

/**
 * Límite de intentos de ingreso, por IP y por identificador de usuario (spec 011 §6.3, D-40).
 *
 * <p>Tres decisiones que conviene no deshacer sin pensarlo:
 *
 * <ul>
 *   <li><b>El estado vive en PostgreSQL</b>, no en memoria. Antes se perdía en cada
 *       despliegue —bastaba esperar uno para reiniciar la cuenta— y no se compartía entre
 *       instancias, así que con dos réplicas el límite valía el doble.
 *   <li><b>El servidor nunca duerme.</b> Se guarda el momento en que se admite el siguiente
 *       intento; lo que llega antes recibe un {@code 429} inmediato con {@code Retry-After}.
 *       Dormir el hilo daría el mismo efecto al cliente y le regalaría a un atacante la
 *       manera de agotar el servidor con peticiones que no cuestan nada emitir.
 *   <li><b>Se cuenta el identificador que llega, exista o no la cuenta.</b> Si se contaran
 *       solo los usuarios reales, la diferencia de comportamiento convertiría este limitador
 *       en un oráculo para averiguar qué cuentas existen.
 * </ul>
 */
@Component
public class LoginRateLimiter {

    /** Filas sin uso desde hace más de esto se borran: no tienen valor histórico. */
    private static final int PURGE_MULTIPLIER = 4;

    private final JdbcClient jdbc;
    private final SecurityProperties properties;
    private final Clock clock;

    public LoginRateLimiter(JdbcClient jdbc, SecurityProperties properties, Clock clock) {
        this.jdbc = jdbc;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Rechaza la petición si llega antes de tiempo, por IP o por identificador.
     *
     * @throws RateLimitedException si falta para el siguiente intento admitido
     */
    public void check(String ip, String identificador) {
        Instant now = clock.instant();
        requireAllowed(Tipo.IP, failClosed(ip), now);
        if (identificador != null && !identificador.isBlank()) {
            requireAllowed(Tipo.USUARIO, identificador, now);
        }
    }

    /** Suma un fallo a la IP y al identificador, y corre su próximo intento admitido. */
    public void recordFailure(String ip, String identificador) {
        Instant now = clock.instant();
        registerFailure(Tipo.IP, failClosed(ip), now);
        if (identificador != null && !identificador.isBlank()) {
            registerFailure(Tipo.USUARIO, identificador, now);
        }
        purge(now);
    }

    /** Un ingreso correcto devuelve a cero la cuenta de ambos. */
    public void recordSuccess(String ip, String identificador) {
        clear(Tipo.IP, failClosed(ip));
        if (identificador != null && !identificador.isBlank()) {
            clear(Tipo.USUARIO, identificador);
        }
    }

    /**
     * Sin IP resoluble no se sigue adelante. Antes se dejaba pasar en silencio, con lo que
     * cualquier ruta que no llegara a resolver la IP quedaba sin límite ninguno.
     */
    private static String failClosed(String ip) {
        if (ip == null || ip.isBlank()) {
            throw new RateLimitedException(0,
                    "No se pudo determinar el origen de la petición, así que no se admite el ingreso.");
        }
        return ip;
    }

    private void requireAllowed(Tipo tipo, String identificador, Instant now) {
        Optional<OffsetDateTime> proximo = jdbc.sql("""
                        select proximo_intento_admitido_en from intento_ingreso
                        where tipo = :tipo and identificador = :identificador
                        """)
                .param("tipo", tipo.valor())
                .param("identificador", identificador)
                .query(OffsetDateTime.class)
                .optional();

        if (proximo.isPresent() && proximo.get().toInstant().isAfter(now)) {
            // Retry-After va en segundos enteros: se redondea hacia arriba, porque anunciar
            // menos de lo que falta invita a reintentar antes de tiempo. Sumar un segundo
            // fijo, en cambio, anunciaba 2 donde faltaba exactamente 1.
            long milisegundos = java.time.Duration.between(now, proximo.get().toInstant()).toMillis();
            long faltan = Math.max(1, (milisegundos + 999) / 1000);
            throw new RateLimitedException(faltan,
                    "Hubo demasiados intentos de ingreso. Vuelve a intentarlo en " + faltan + " segundos.");
        }
    }

    private void registerFailure(Tipo tipo, String identificador, Instant now) {
        // El upsert calcula el retardo en la propia sentencia para que dos peticiones
        // simultáneas no se pisen: la segunda ve los fallos que dejó la primera.
        int fallos = jdbc.sql("""
                        insert into intento_ingreso (tipo, identificador, fallos_consecutivos,
                                                     proximo_intento_admitido_en, ultimo_intento_en)
                        values (:tipo, :identificador, 1, :now, :now)
                        on conflict (tipo, identificador) do update
                           set fallos_consecutivos = intento_ingreso.fallos_consecutivos + 1,
                               ultimo_intento_en = :now
                        returning fallos_consecutivos
                        """)
                .param("tipo", tipo.valor())
                .param("identificador", identificador)
                .param("now", OffsetDateTime.ofInstant(now, ZoneOffset.UTC))
                .query(Integer.class)
                .single();

        Instant proximo = now.plusSeconds(delaySeconds(fallos));
        jdbc.sql("""
                        update intento_ingreso set proximo_intento_admitido_en = :proximo
                        where tipo = :tipo and identificador = :identificador
                        """)
                .param("proximo", OffsetDateTime.ofInstant(proximo, ZoneOffset.UTC))
                .param("tipo", tipo.valor())
                .param("identificador", identificador)
                .update();
    }

    /**
     * La curva de D-40 mientras los fallos sean pocos; pasado el techo de
     * {@code loginAttemptsPerIp}, la congelación larga de {@code loginIpWindow}.
     */
    private long delaySeconds(int fallos) {
        if (fallos >= properties.loginAttemptsPerIp()) {
            return properties.loginIpWindow().toSeconds();
        }
        return properties.delayAfter(fallos);
    }

    private void clear(Tipo tipo, String identificador) {
        jdbc.sql("delete from intento_ingreso where tipo = :tipo and identificador = :identificador")
                .param("tipo", tipo.valor())
                .param("identificador", identificador)
                .update();
    }

    /**
     * Las filas en desuso se borran: guardan el identificador que llegó en la petición, que
     * es dato personal indirecto, y sin valor una vez pasada la ventana (Principio I).
     */
    private void purge(Instant now) {
        Instant corte = now.minusSeconds(properties.loginIpWindow().toSeconds() * PURGE_MULTIPLIER);
        jdbc.sql("delete from intento_ingreso where ultimo_intento_en < :corte")
                .param("corte", OffsetDateTime.ofInstant(corte, ZoneOffset.UTC))
                .update();
    }

    private enum Tipo {
        IP("ip"), USUARIO("usuario");

        private final String valor;

        Tipo(String valor) {
            this.valor = valor;
        }

        String valor() {
            return valor;
        }
    }
}
