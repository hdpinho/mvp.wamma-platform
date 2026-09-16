package com.wamma.platform.audit;

import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.web.RequestInfo;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.sql.Types;
import java.util.Map;
import java.util.UUID;

/**
 * Registro en la bitácora inmutable (plan 001 §8).
 * <p>
 * Escribe en la transacción en curso: si el cambio se revierte, su registro también. Así no
 * hay cambio sin rastro, ni rastro de un cambio que no ocurrió. Nunca se le pasan
 * contraseñas, secretos, tokens ni códigos; los datos personales van enmascarados
 * ({@link Masking}).
 */
@Component
public class AuditLog {

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public AuditLog(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** Registra con el usuario de la sesión actual como actor (nulo si no hay sesión). */
    public void record(String action, String entity, UUID entityId, Map<String, ?> before, Map<String, ?> after) {
        recordAs(CurrentUser.id().orElse(null), action, entity, entityId, before, after);
    }

    public void recordAs(UUID actorId, String action, String entity, UUID entityId,
                         Map<String, ?> before, Map<String, ?> after) {
        jdbc.sql("""
                        insert into auditoria_evento (actor_id, accion, entidad, entidad_id, antes, despues, ip_origen, user_agent)
                        values (:actor, :action, :entity, :entityId, cast(:before as jsonb), cast(:after as jsonb), :ip, :userAgent)
                        """)
                .param("actor", actorId, Types.OTHER)
                .param("action", action)
                .param("entity", entity)
                .param("entityId", entityId, Types.OTHER)
                .param("before", toJson(before), Types.VARCHAR)
                .param("after", toJson(after), Types.VARCHAR)
                .param("ip", RequestInfo.clientIp(), Types.VARCHAR)
                .param("userAgent", RequestInfo.userAgent(), Types.VARCHAR)
                .update();
    }

    private String toJson(Map<String, ?> value) {
        return value == null || value.isEmpty() ? null : json.writeValueAsString(value);
    }
}
