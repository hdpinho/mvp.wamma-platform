package com.wamma.crm;

import com.wamma.platform.crypto.BlindIndex;
import com.wamma.platform.crypto.FieldCipher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
public class PersonRepository {

    public static final String CONTEXT_CEDULA = "persona.cedula";
    public static final String CONTEXT_PHONE = "persona_telefono.telefono";
    public static final String CONTEXT_EMAIL = "persona.correo";

    /**
     * Una fusión ya hecha, tal como quedó en la copia íntegra: lo que era la persona absorbida y todo lo que
     * se le reasignó a la sobreviviente.
     */
    public record MergeRecord(UUID absorbedId, String fullName, List<String> phones, String email,
                              Instant createdAt, Instant mergedAt, List<UUID> opportunityIds,
                              List<UUID> appointmentIds, List<UUID> interactionIds) {
    }

    private final JdbcClient jdbc;
    private final FieldCipher cipher;
    private final BlindIndex blindIndex;
    private final ObjectMapper json;

    public PersonRepository(JdbcClient jdbc, FieldCipher cipher, BlindIndex blindIndex, ObjectMapper json) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.blindIndex = blindIndex;
        this.json = json;
    }

    public Optional<PersonRecord> findById(UUID id) {
        Optional<PersonRecord> person = jdbc.sql("""
                        select id, nombre_apellido, cedula_cifrada, correo_cifrado, canal_origen, asesor_id,
                               estado, criterio_resolucion, creado_en, actualizado_en
                        from persona
                        where id = :id
                        """)
                .param("id", id, Types.OTHER)
                .query(this::mapPerson)
                .optional();

        return person.map(p -> withPhones(p, findPhones(p.id())));
    }

    public Optional<PersonRecord> findByBlindIndexCedula(String blindIndexCedula) {
        Optional<PersonRecord> person = jdbc.sql("""
                        select id, nombre_apellido, cedula_cifrada, correo_cifrado, canal_origen, asesor_id,
                               estado, criterio_resolucion, creado_en, actualizado_en
                        from persona
                        where indice_ciego_cedula = :idx and estado = 'activo'
                        """)
                .param("idx", blindIndexCedula)
                .query(this::mapPerson)
                .optional();

        return person.map(p -> withPhones(p, findPhones(p.id())));
    }

    public Optional<PersonRecord> findByBlindIndexPhone(String blindIndexPhone) {
        Optional<PersonRecord> person = jdbc.sql("""
                        select p.id, p.nombre_apellido, p.cedula_cifrada, p.correo_cifrado, p.canal_origen, p.asesor_id,
                               p.estado, p.criterio_resolucion, p.creado_en, p.actualizado_en
                        from persona p
                        join persona_telefono pt on pt.persona_id = p.id
                        where pt.indice_ciego_telefono = :idx and p.estado = 'activo'
                        order by pt.creado_en desc
                        limit 1
                        """)
                .param("idx", blindIndexPhone)
                .query(this::mapPerson)
                .optional();

        return person.map(p -> withPhones(p, findPhones(p.id())));
    }

    public List<PhoneRecord> findPhones(UUID personId) {
        return jdbc.sql("""
                        select id, persona_id, telefono_cifrado, es_principal, creado_en
                        from persona_telefono
                        where persona_id = :personId
                        order by es_principal desc, creado_en desc
                        """)
                .param("personId", personId, Types.OTHER)
                .query(this::mapPhone)
                .list();
    }

    public UUID insertPerson(String fullName, String plainCedula, String plainEmail, String channel,
                             UUID advisorId, String resolutionCriterion) {
        byte[] cedulaBytes = plainCedula != null ? cipher.encrypt(plainCedula, CONTEXT_CEDULA) : null;
        String cedulaIdx = plainCedula != null ? blindIndex.of(plainCedula, CONTEXT_CEDULA) : null;
        byte[] emailBytes = plainEmail != null ? cipher.encrypt(plainEmail, CONTEXT_EMAIL) : null;
        String emailIdx = plainEmail != null ? blindIndex.of(plainEmail, CONTEXT_EMAIL) : null;

        return jdbc.sql("""
                        insert into persona (nombre_apellido, cedula_cifrada, indice_ciego_cedula, correo_cifrado,
                                             indice_ciego_correo, canal_origen, asesor_id, estado, criterio_resolucion)
                        values (:name, :cedula, :cedulaIdx, :email, :emailIdx, :channel, :advisor, 'activo', :resolution)
                        on conflict do nothing
                        returning id
                        """)
                .param("name", fullName)
                .param("cedula", cedulaBytes, Types.BINARY)
                .param("cedulaIdx", cedulaIdx, Types.VARCHAR)
                .param("email", emailBytes, Types.BINARY)
                .param("emailIdx", emailIdx, Types.VARCHAR)
                .param("channel", channel)
                .param("advisor", advisorId, Types.OTHER)
                .param("resolution", resolutionCriterion)
                .query(UUID.class)
                .optional()
                .orElse(null);
    }

    public UUID insertPhone(UUID personId, String plainPhone, boolean isPrimary) {
        byte[] phoneBytes = cipher.encrypt(plainPhone, CONTEXT_PHONE);
        String phoneIdx = blindIndex.of(plainPhone, CONTEXT_PHONE);

        if (isPrimary) {
            jdbc.sql("update persona_telefono set es_principal = false where persona_id = :personId")
                    .param("personId", personId, Types.OTHER)
                    .update();
        }

        return jdbc.sql("""
                        insert into persona_telefono (persona_id, telefono_cifrado, indice_ciego_telefono, es_principal)
                        values (:personId, :phone, :phoneIdx, :isPrimary)
                        on conflict (persona_id, indice_ciego_telefono) do update
                            set es_principal = excluded.es_principal
                        returning id
                        """)
                .param("personId", personId, Types.OTHER)
                .param("phone", phoneBytes, Types.BINARY)
                .param("phoneIdx", phoneIdx)
                .param("isPrimary", isPrimary)
                .query(UUID.class)
                .single();
    }

    public void setPrimaryPhone(UUID personId, UUID phoneId) {
        jdbc.sql("update persona_telefono set es_principal = false where persona_id = :personId")
                .param("personId", personId, Types.OTHER)
                .update();
        jdbc.sql("update persona_telefono set es_principal = true where id = :phoneId and persona_id = :personId")
                .param("phoneId", phoneId, Types.OTHER)
                .param("personId", personId, Types.OTHER)
                .update();
    }

    public void updateCedula(UUID personId, String plainCedula) {
        byte[] cedulaBytes = plainCedula != null ? cipher.encrypt(plainCedula, CONTEXT_CEDULA) : null;
        String cedulaIdx = plainCedula != null ? blindIndex.of(plainCedula, CONTEXT_CEDULA) : null;

        jdbc.sql("""
                        update persona
                        set cedula_cifrada = :cedula, indice_ciego_cedula = :cedulaIdx
                        where id = :personId
                        """)
                .param("cedula", cedulaBytes, Types.BINARY)
                .param("cedulaIdx", cedulaIdx, Types.VARCHAR)
                .param("personId", personId, Types.OTHER)
                .update();
    }

    /** Cómo se identificó a la persona: por cédula, por teléfono o es nueva (plan 010 §5). */
    public void updateResolutionCriterion(UUID personId, String criterion) {
        jdbc.sql("update persona set criterio_resolucion = :criterion where id = :personId")
                .param("criterion", criterion)
                .param("personId", personId, Types.OTHER)
                .update();
    }

    public void updateEmail(UUID personId, String plainEmail) {
        byte[] emailBytes = plainEmail != null ? cipher.encrypt(plainEmail, CONTEXT_EMAIL) : null;
        String emailIdx = plainEmail != null ? blindIndex.of(plainEmail, CONTEXT_EMAIL) : null;

        jdbc.sql("""
                        update persona
                        set correo_cifrado = :email, indice_ciego_correo = :emailIdx
                        where id = :personId
                        """)
                .param("email", emailBytes, Types.BINARY)
                .param("emailIdx", emailIdx, Types.VARCHAR)
                .param("personId", personId, Types.OTHER)
                .update();
    }

    public void updateAdvisor(UUID personId, UUID advisorId) {
        jdbc.sql("update persona set asesor_id = :advisor where id = :personId")
                .param("advisor", advisorId, Types.OTHER)
                .param("personId", personId, Types.OTHER)
                .update();
    }

    /**
     * Búsqueda de personas activas. Con {@code advisorScope}, solo las que tienen alguna oportunidad
     * de ese asesor o sin dueño (crm.ver_propias, plan 010 §7); nulo, todas.
     */
    public List<PersonRecord> search(String queryText, String plainCedula, String plainPhone, int limit,
                                     UUID advisorScope) {
        String cedulaIdx = plainCedula != null ? blindIndex.of(plainCedula, CONTEXT_CEDULA) : null;
        String phoneIdx = plainPhone != null ? blindIndex.of(plainPhone, CONTEXT_PHONE) : null;
        String pattern = queryText != null && !queryText.isBlank() ? "%" + queryText.trim() + "%" : null;

        List<PersonRecord> list;
        if (pattern == null && cedulaIdx == null && phoneIdx == null) {
            list = jdbc.sql("""
                            select p.id, p.nombre_apellido, p.cedula_cifrada, p.correo_cifrado, p.canal_origen,
                                   p.asesor_id, p.estado, p.criterio_resolucion, p.creado_en, p.actualizado_en
                            from persona p
                            where p.estado = 'activo'
                              and (cast(:advisor as uuid) is null or exists (
                                select 1 from oportunidad o
                                where o.persona_id = p.id and (o.asesor_id = cast(:advisor as uuid) or o.asesor_id is null)
                              ))
                            order by p.creado_en desc
                            limit :limit
                            """)
                    .param("advisor", advisorScope, Types.OTHER)
                    .param("limit", limit)
                    .query(this::mapPerson)
                    .list();
        } else {
            list = jdbc.sql("""
                            select distinct p.id, p.nombre_apellido, p.cedula_cifrada, p.correo_cifrado, p.canal_origen,
                                   p.asesor_id, p.estado, p.criterio_resolucion, p.creado_en, p.actualizado_en
                            from persona p
                            left join persona_telefono pt on pt.persona_id = p.id
                            where p.estado = 'activo'
                              and (
                                (:pattern is not null and p.nombre_apellido ilike :pattern)
                                or (:cedulaIdx is not null and p.indice_ciego_cedula = :cedulaIdx)
                                or (:phoneIdx is not null and pt.indice_ciego_telefono = :phoneIdx)
                              )
                              and (cast(:advisor as uuid) is null or exists (
                                select 1 from oportunidad o
                                where o.persona_id = p.id and (o.asesor_id = cast(:advisor as uuid) or o.asesor_id is null)
                              ))
                            order by p.nombre_apellido
                            limit :limit
                            """)
                    .param("pattern", pattern, Types.VARCHAR)
                    .param("cedulaIdx", cedulaIdx, Types.VARCHAR)
                    .param("phoneIdx", phoneIdx, Types.VARCHAR)
                    .param("advisor", advisorScope, Types.OTHER)
                    .param("limit", limit)
                    .query(this::mapPerson)
                    .list();
        }

        List<PersonRecord> result = new ArrayList<>();
        for (PersonRecord p : list) {
            result.add(withPhones(p, findPhones(p.id())));
        }
        return result;
    }

    /**
     * Fusiona dos registros de la misma persona: la absorbida queda como «fusionado» y todo lo suyo pasa a la
     * sobreviviente. En {@code fusion_persona} quedan la copia íntegra de lo absorbido (con sus datos cifrados
     * tal cual estaban, nunca en claro) y la lista completa de lo reasignado, de modo que la fusión se puede
     * auditar y revertir (plan 010 §5.1).
     * <p>
     * La cédula y el correo de la absorbida pasan a la sobreviviente si esta no los tenía. La cédula es única:
     * si se quedara en el registro fusionado, nadie volvería a encontrar a la persona por ella.
     */
    @Transactional
    public void absorbPerson(UUID survivorId, UUID absorbedId, UUID mergedBy) {
        Map<String, Object> copy = snapshot(absorbedId);
        List<UUID> opportunityIds = idsOf("select id from oportunidad where persona_id = :id order by creado_en", absorbedId);
        List<UUID> appointmentIds = idsOf("select id from cita_inspeccion where persona_id = :id order by creado_en", absorbedId);
        List<UUID> interactionIds = idsOf("select id from interaccion where persona_id = :id order by creado_en", absorbedId);

        jdbc.sql("""
                        insert into fusion_persona (persona_sobreviviente_id, persona_absorbida_id, copia_absorbida_json,
                                                    oportunidad_ids, cita_ids, interaccion_ids, fusionada_por)
                        values (:survivor, :absorbed, cast(:snapshot as jsonb), cast(:opps as uuid[]),
                                cast(:citas as uuid[]), cast(:inter as uuid[]), :mergedBy)
                        """)
                .param("survivor", survivorId, Types.OTHER)
                .param("absorbed", absorbedId, Types.OTHER)
                .param("snapshot", json.writeValueAsString(copy), Types.VARCHAR)
                .param("opps", uuidArray(opportunityIds), Types.VARCHAR)
                .param("citas", uuidArray(appointmentIds), Types.VARCHAR)
                .param("inter", uuidArray(interactionIds), Types.VARCHAR)
                .param("mergedBy", mergedBy, Types.OTHER)
                .update();

        carryOverIdentity(survivorId, absorbedId);

        jdbc.sql("update oportunidad set persona_id = :survivor where persona_id = :absorbed")
                .param("survivor", survivorId, Types.OTHER)
                .param("absorbed", absorbedId, Types.OTHER)
                .update();

        jdbc.sql("update cita_inspeccion set persona_id = :survivor where persona_id = :absorbed")
                .param("survivor", survivorId, Types.OTHER)
                .param("absorbed", absorbedId, Types.OTHER)
                .update();

        jdbc.sql("update interaccion set persona_id = :survivor where persona_id = :absorbed")
                .param("survivor", survivorId, Types.OTHER)
                .param("absorbed", absorbedId, Types.OTHER)
                .update();

        jdbc.sql("""
                        delete from persona_telefono
                        where persona_id = :absorbed
                          and indice_ciego_telefono in (
                              select indice_ciego_telefono from persona_telefono where persona_id = :survivor
                          )
                        """)
                .param("absorbed", absorbedId, Types.OTHER)
                .param("survivor", survivorId, Types.OTHER)
                .update();

        jdbc.sql("""
                        update persona_telefono
                        set persona_id = :survivor, es_principal = false
                        where persona_id = :absorbed
                        """)
                .param("survivor", survivorId, Types.OTHER)
                .param("absorbed", absorbedId, Types.OTHER)
                .update();

        jdbc.sql("update persona set estado = 'fusionado' where id = :absorbed")
                .param("absorbed", absorbedId, Types.OTHER)
                .update();
    }

    /** La cédula y el correo de la absorbida pasan a la sobreviviente solo si esta no los tenía. */
    private void carryOverIdentity(UUID survivorId, UUID absorbedId) {
        IdentityRow survivor = identityOf(survivorId);
        IdentityRow absorbed = identityOf(absorbedId);

        if (survivor.cedulaIndex() == null && absorbed.cedulaIndex() != null) {
            // El índice de la cédula es único: se libera en la absorbida antes de asignarlo a la sobreviviente.
            jdbc.sql("update persona set cedula_cifrada = null, indice_ciego_cedula = null where id = :id")
                    .param("id", absorbedId, Types.OTHER)
                    .update();
            jdbc.sql("update persona set cedula_cifrada = :cedula, indice_ciego_cedula = :idx, criterio_resolucion = 'cedula' where id = :id")
                    .param("cedula", absorbed.cedula(), Types.BINARY)
                    .param("idx", absorbed.cedulaIndex(), Types.VARCHAR)
                    .param("id", survivorId, Types.OTHER)
                    .update();
        }
        if (survivor.emailIndex() == null && absorbed.emailIndex() != null) {
            jdbc.sql("update persona set correo_cifrado = :email, indice_ciego_correo = :idx where id = :id")
                    .param("email", absorbed.email(), Types.BINARY)
                    .param("idx", absorbed.emailIndex(), Types.VARCHAR)
                    .param("id", survivorId, Types.OTHER)
                    .update();
        }
    }

    private record IdentityRow(byte[] cedula, String cedulaIndex, byte[] email, String emailIndex) {
    }

    private IdentityRow identityOf(UUID personId) {
        return jdbc.sql("""
                        select cedula_cifrada, indice_ciego_cedula, correo_cifrado, indice_ciego_correo
                        from persona where id = :id
                        """)
                .param("id", personId, Types.OTHER)
                .query((rs, n) -> new IdentityRow(rs.getBytes("cedula_cifrada"), rs.getString("indice_ciego_cedula"),
                        rs.getBytes("correo_cifrado"), rs.getString("indice_ciego_correo")))
                .single();
    }

    /**
     * Copia íntegra de la persona tal como está en la base: los datos personales van cifrados (Base64 del
     * mismo cifrado de la columna), así que la copia no expone nada y aun así permite devolver la persona a su
     * estado anterior.
     */
    private Map<String, Object> snapshot(UUID personId) {
        Map<String, Object> copy = jdbc.sql("""
                        select id, nombre_apellido, canal_origen, asesor_id, estado, criterio_resolucion, creado_en,
                               cedula_cifrada, indice_ciego_cedula, correo_cifrado, indice_ciego_correo
                        from persona where id = :id
                        """)
                .param("id", personId, Types.OTHER)
                .query((rs, n) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getObject("id", UUID.class).toString());
                    row.put("nombreApellido", rs.getString("nombre_apellido"));
                    row.put("canalOrigen", rs.getString("canal_origen"));
                    row.put("asesorId", rs.getObject("asesor_id", UUID.class) == null
                            ? null : rs.getObject("asesor_id", UUID.class).toString());
                    row.put("estado", rs.getString("estado"));
                    row.put("criterioResolucion", rs.getString("criterio_resolucion"));
                    row.put("creadoEn", instant(rs, "creado_en").toString());
                    row.put("cedulaCifrada", base64(rs.getBytes("cedula_cifrada")));
                    row.put("indiceCiegoCedula", rs.getString("indice_ciego_cedula"));
                    row.put("correoCifrado", base64(rs.getBytes("correo_cifrado")));
                    row.put("indiceCiegoCorreo", rs.getString("indice_ciego_correo"));
                    return row;
                })
                .single();
        List<Map<String, Object>> phones = jdbc.sql("""
                        select id, telefono_cifrado, indice_ciego_telefono, es_principal, creado_en
                        from persona_telefono where persona_id = :id order by creado_en
                        """)
                .param("id", personId, Types.OTHER)
                .query((rs, n) -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", rs.getObject("id", UUID.class).toString());
                    row.put("telefonoCifrado", base64(rs.getBytes("telefono_cifrado")));
                    row.put("indiceCiego", rs.getString("indice_ciego_telefono"));
                    row.put("esPrincipal", rs.getBoolean("es_principal"));
                    row.put("creadoEn", instant(rs, "creado_en").toString());
                    return row;
                })
                .list();
        copy.put("telefonos", phones);
        return copy;
    }

    private List<UUID> idsOf(String sql, UUID personId) {
        return jdbc.sql(sql).param("id", personId, Types.OTHER).query(UUID.class).list();
    }

    private static String base64(byte[] value) {
        return value == null ? null : Base64.getEncoder().encodeToString(value);
    }

    /** Literal de PostgreSQL para un {@code uuid[]}: evita depender de cómo el controlador envía las matrices. */
    private static String uuidArray(Collection<UUID> ids) {
        StringBuilder literal = new StringBuilder("{");
        for (UUID id : ids) {
            if (literal.length() > 1) {
                literal.append(',');
            }
            literal.append(id);
        }
        return literal.append('}').toString();
    }

    /**
     * Último movimiento de cada persona: su alta, sus oportunidades, sus cambios de etapa o una nota.
     * Una sola consulta para toda la lista.
     */
    public Map<UUID, Instant> lastActivity(Collection<UUID> personIds) {
        if (personIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Instant> result = new LinkedHashMap<>();
        jdbc.sql("""
                        select p.id,
                               greatest(
                                   p.creado_en,
                                   coalesce((select max(o.creado_en) from oportunidad o where o.persona_id = p.id), p.creado_en),
                                   coalesce((select max(h.creado_en) from etapa_historial h
                                             join oportunidad o on o.id = h.oportunidad_id
                                             where o.persona_id = p.id), p.creado_en),
                                   coalesce((select max(i.ocurrido_en) from interaccion i where i.persona_id = p.id), p.creado_en)
                               ) as actividad
                        from persona p
                        where p.id = any (cast(:ids as uuid[]))
                        """)
                .param("ids", uuidArray(personIds), Types.VARCHAR)
                .query((rs, n) -> {
                    result.put(rs.getObject("id", UUID.class), instant(rs, "actividad"));
                    return null;
                })
                .list();
        return result;
    }

    /** La persona que absorbió este registro, si fue fusionado: quien abre un enlace viejo llega a la ficha vigente. */
    public Optional<UUID> survivorOf(UUID absorbedId) {
        return jdbc.sql("""
                        select persona_sobreviviente_id
                        from fusion_persona
                        where persona_absorbida_id = :id
                        order by fusionada_en desc
                        limit 1
                        """)
                .param("id", absorbedId, Types.OTHER)
                .query(UUID.class)
                .optional();
    }

    /** Fusiones en las que esta persona fue la sobreviviente, con lo absorbido descifrado para mostrarlo. */
    @SuppressWarnings("unchecked")
    public List<MergeRecord> mergesInto(UUID survivorId) {
        return jdbc.sql("""
                        select persona_absorbida_id, copia_absorbida_json::text as copia, fusionada_en,
                               array_to_string(oportunidad_ids, ',') as oportunidades,
                               array_to_string(cita_ids, ',') as citas,
                               array_to_string(interaccion_ids, ',') as interacciones
                        from fusion_persona
                        where persona_sobreviviente_id = :id
                        order by fusionada_en
                        """)
                .param("id", survivorId, Types.OTHER)
                .query((rs, n) -> {
                    Map<String, Object> copy = json.readValue(rs.getString("copia"), Map.class);
                    List<String> phones = new ArrayList<>();
                    Object stored = copy.get("telefonos");
                    if (stored instanceof List<?> rows) {
                        for (Object row : rows) {
                            Object cipherText = ((Map<String, Object>) row).get("telefonoCifrado");
                            if (cipherText != null) {
                                phones.add(cipher.decrypt(Base64.getDecoder().decode(cipherText.toString()), CONTEXT_PHONE));
                            }
                        }
                    }
                    Object email = copy.get("correoCifrado");
                    return new MergeRecord(
                            rs.getObject("persona_absorbida_id", UUID.class),
                            String.valueOf(copy.get("nombreApellido")),
                            phones,
                            email == null ? null
                                    : cipher.decrypt(Base64.getDecoder().decode(email.toString()), CONTEXT_EMAIL),
                            copy.get("creadoEn") == null ? null : Instant.parse(copy.get("creadoEn").toString()),
                            instant(rs, "fusionada_en"),
                            uuids(rs.getString("oportunidades")),
                            uuids(rs.getString("citas")),
                            uuids(rs.getString("interacciones")));
                })
                .list();
    }

    private static List<UUID> uuids(String commaSeparated) {
        if (commaSeparated == null || commaSeparated.isBlank()) {
            return List.of();
        }
        List<UUID> ids = new ArrayList<>();
        for (String id : commaSeparated.split(",")) {
            ids.add(UUID.fromString(id.trim()));
        }
        return ids;
    }

    private PersonRecord mapPerson(ResultSet rs, int rowNum) throws SQLException {
        byte[] cedulaBytes = rs.getBytes("cedula_cifrada");
        String plainCedula = cedulaBytes != null ? cipher.decrypt(cedulaBytes, CONTEXT_CEDULA) : null;

        byte[] emailBytes = rs.getBytes("correo_cifrado");
        String plainEmail = emailBytes != null ? cipher.decrypt(emailBytes, CONTEXT_EMAIL) : null;

        return new PersonRecord(
                rs.getObject("id", UUID.class),
                rs.getString("nombre_apellido"),
                plainCedula,
                plainEmail,
                rs.getString("canal_origen"),
                rs.getObject("asesor_id", UUID.class),
                rs.getString("estado"),
                rs.getString("criterio_resolucion"),
                List.of(),
                instant(rs, "creado_en"),
                instant(rs, "actualizado_en")
        );
    }

    private PhoneRecord mapPhone(ResultSet rs, int rowNum) throws SQLException {
        byte[] phoneBytes = rs.getBytes("telefono_cifrado");
        String plainPhone = phoneBytes != null ? cipher.decrypt(phoneBytes, CONTEXT_PHONE) : null;

        return new PhoneRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("persona_id", UUID.class),
                plainPhone,
                rs.getBoolean("es_principal"),
                instant(rs, "creado_en")
        );
    }

    private static PersonRecord withPhones(PersonRecord p, List<PhoneRecord> phones) {
        return new PersonRecord(
                p.id(), p.fullName(), p.cedula(), p.email(), p.channel(), p.advisorId(),
                p.state(), p.resolutionCriterion(), phones, p.createdAt(), p.updatedAt()
        );
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }
}
