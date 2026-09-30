package com.wamma.crm;

import com.wamma.platform.crypto.BlindIndex;
import com.wamma.platform.crypto.FieldCipher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class PersonRepository {

    public static final String CONTEXT_CEDULA = "persona.cedula";
    public static final String CONTEXT_PHONE = "persona_telefono.telefono";
    public static final String CONTEXT_EMAIL = "persona.correo";

    private final JdbcClient jdbc;
    private final FieldCipher cipher;
    private final BlindIndex blindIndex;

    public PersonRepository(JdbcClient jdbc, FieldCipher cipher, BlindIndex blindIndex) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.blindIndex = blindIndex;
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

    public List<PersonRecord> search(String queryText, String plainCedula, String plainPhone, int limit) {
        String cedulaIdx = plainCedula != null ? blindIndex.of(plainCedula, CONTEXT_CEDULA) : null;
        String phoneIdx = plainPhone != null ? blindIndex.of(plainPhone, CONTEXT_PHONE) : null;
        String pattern = queryText != null && !queryText.isBlank() ? "%" + queryText.trim() + "%" : null;

        List<PersonRecord> list;
        if (pattern == null && cedulaIdx == null && phoneIdx == null) {
            list = jdbc.sql("""
                            select id, nombre_apellido, cedula_cifrada, correo_cifrado, canal_origen, asesor_id,
                                   estado, criterio_resolucion, creado_en, actualizado_en
                            from persona
                            where estado = 'activo'
                            order by creado_en desc
                            limit :limit
                            """)
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
                            order by p.nombre_apellido
                            limit :limit
                            """)
                    .param("pattern", pattern, Types.VARCHAR)
                    .param("cedulaIdx", cedulaIdx, Types.VARCHAR)
                    .param("phoneIdx", phoneIdx, Types.VARCHAR)
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

    @Transactional
    public void absorbPerson(UUID survivorId, UUID absorbedId, String snapshotJson,
                             UUID[] opportunityIds, UUID[] appointmentIds, UUID[] interactionIds,
                             UUID mergedBy) {
        jdbc.sql("""
                        insert into fusion_persona (persona_sobreviviente_id, persona_absorbida_id, copia_absorbida_json,
                                                    oportunidad_ids, cita_ids, interaccion_ids, fusionada_por)
                        values (:survivor, :absorbed, :snapshot::jsonb, :opps, :citas, :inter, :mergedBy)
                        """)
                .param("survivor", survivorId, Types.OTHER)
                .param("absorbed", absorbedId, Types.OTHER)
                .param("snapshot", snapshotJson)
                .param("opps", opportunityIds != null ? opportunityIds : new UUID[0])
                .param("citas", appointmentIds != null ? appointmentIds : new UUID[0])
                .param("inter", interactionIds != null ? interactionIds : new UUID[0])
                .param("mergedBy", mergedBy, Types.OTHER)
                .update();

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
