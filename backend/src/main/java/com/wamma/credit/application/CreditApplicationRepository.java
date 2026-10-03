package com.wamma.credit.application;

import com.wamma.platform.crypto.FieldCipher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Repository
public class CreditApplicationRepository {

    public record RiskDecisionRecord(
            UUID id,
            UUID applicationId,
            /** Nulo en el dictamen manual: el puntaje solo existe si un motor o el analista lo informó (D-63). */
            Integer internalScore,
            Integer bureauScore,
            String riskLevel,
            String result,
            BigDecimal approvedLimit,
            BigDecimal maxAllowedPayment,
            String justification,
            UUID evaluatedBy,
            Instant evaluatedAt,
            String currency,
            BigDecimal bcvRate,
            LocalDate rateDate
    ) {
    }

    /** Contexto del cifrado (dato asociado de GCM): un cifrado copiado a otra columna no se abre. */
    public static final String CONTEXT_DOSSIER = "solicitud_credito.expediente";

    private final JdbcClient jdbc;
    private final FieldCipher cipher;
    private final ObjectMapper json;

    public CreditApplicationRepository(JdbcClient jdbc, FieldCipher cipher, ObjectMapper json) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.json = json;
    }

    /** El expediente se cifra entero antes de salir hacia la base (V0019, hallazgo S-06). */
    public void insert(CreditApplicationRecord r) {
        byte[] dossier = cipher.encrypt(json.writeValueAsString(r.dossier()), CONTEXT_DOSSIER);
        jdbc.sql("""
                INSERT INTO solicitud_credito (
                    id, numero_solicitud, oportunidad_id, persona_id, vehiculo_id,
                    monto_solicitado, cuota_inicial, plazo_meses, moneda, tasa_bcv, fecha_tasa,
                    expediente_cifrado, capacidad_pago_mensual,
                    estado, enviada_en, creado_en, actualizado_en,
                    cuota_estimada, frecuencia_pago
                ) VALUES (
                    :id, :num, :oppId, :personId, :vehId,
                    :monto, :inicial, :plazo, :moneda, :tasa, :fechaTasa,
                    :expediente, :capacidad,
                    :estado, :enviadaEn, :creadoEn, :actualizadoEn,
                    :cuotaEstimada, :frecuencia
                )
                """)
                .param("id", r.id())
                .param("num", r.applicationNumber())
                .param("oppId", r.opportunityId())
                .param("personId", r.personId())
                .param("vehId", r.vehicleId())
                .param("monto", r.requestedAmount())
                .param("inicial", r.downPayment())
                .param("plazo", r.termMonths())
                .param("moneda", r.currency())
                .param("tasa", r.bcvRate())
                .param("fechaTasa", r.bcvRateDate())
                .param("expediente", dossier, Types.BINARY)
                .param("capacidad", r.monthlyCapacity())
                .param("estado", r.status())
                .param("enviadaEn", toOffsetDateTime(r.submittedAt()))
                .param("creadoEn", toOffsetDateTime(r.createdAt()))
                .param("actualizadoEn", toOffsetDateTime(r.updatedAt()))
                .param("cuotaEstimada", r.estimatedPayment())
                .param("frecuencia", r.paymentFrequency() != null ? r.paymentFrequency() : "Mensual")
                .update();
    }

    public Optional<CreditApplicationRecord> findById(UUID id) {
        return jdbc.sql("SELECT * FROM solicitud_credito WHERE id = :id")
                .param("id", id)
                .query(this::mapRow)
                .optional();
    }

    public Optional<CreditApplicationRecord> findByOpportunityId(UUID opportunityId) {
        return jdbc.sql("SELECT * FROM solicitud_credito WHERE oportunidad_id = :oppId ORDER BY creado_en DESC LIMIT 1")
                .param("oppId", opportunityId)
                .query(this::mapRow)
                .optional();
    }

    public List<CreditApplicationRecord> listAll(String statusFilter, int limit, int offset) {
        if (statusFilter != null && !statusFilter.isBlank()) {
            return jdbc.sql("""
                    SELECT * FROM solicitud_credito
                    WHERE estado = :status
                    ORDER BY creado_en DESC
                    LIMIT :limit OFFSET :offset
                    """)
                    .param("status", statusFilter)
                    .param("limit", limit)
                    .param("offset", offset)
                    .query(this::mapRow)
                    .list();
        }

        return jdbc.sql("""
                SELECT * FROM solicitud_credito
                ORDER BY creado_en DESC
                LIMIT :limit OFFSET :offset
                """)
                .param("limit", limit)
                .param("offset", offset)
                .query(this::mapRow)
                .list();
    }

    public long count(String statusFilter) {
        if (statusFilter != null && !statusFilter.isBlank()) {
            return jdbc.sql("SELECT count(*) FROM solicitud_credito WHERE estado = :status")
                    .param("status", statusFilter)
                    .query(Long.class)
                    .single();
        }
        return jdbc.sql("SELECT count(*) FROM solicitud_credito")
                .query(Long.class)
                .single();
    }

    public void updateStatus(UUID id, String status) {
        jdbc.sql("UPDATE solicitud_credito SET estado = :status, actualizado_en = now() WHERE id = :id")
                .param("status", status)
                .param("id", id)
                .update();
    }

    public void insertDocument(CreditDocumentRecord doc) {
        jdbc.sql("""
                INSERT INTO solicitud_recaudo (
                    id, solicitud_id, tipo_documento, archivo_clave, nombre_archivo,
                    tamano_bytes, mime_type, estado_validacion, observaciones, creado_en
                ) VALUES (
                    :id, :solId, :tipo, :clave, :nombre,
                    :tamano, :mime, :estado, :obs, :creadoEn
                )
                """)
                .param("id", doc.id())
                .param("solId", doc.applicationId())
                .param("tipo", normalizeDocType(doc.documentType()))
                .param("clave", doc.fileKey())
                .param("nombre", doc.fileName())
                .param("tamano", doc.fileSizeBytes())
                .param("mime", doc.mimeType())
                .param("estado", doc.validationStatus() != null ? doc.validationStatus() : "pendiente")
                .param("obs", doc.notes())
                .param("creadoEn", toOffsetDateTime(doc.createdAt()))
                .update();
    }

    static String normalizeDocType(String type) {
        if (type == null) return "otro";
        String lower = type.trim().toLowerCase();
        return switch (lower) {
            case "cedula", "cedula_identidad" -> "cedula";
            case "rif" -> "rif";
            case "ingresos", "certificacion_ingresos", "constancia_trabajo" -> "ingresos";
            case "bancario", "extracto_bancario", "estado_cuenta" -> "bancario";
            case "domicilio" -> "domicilio";
            case "referencias" -> "referencias";
            default -> "otro";
        };
    }

    public List<CreditDocumentRecord> listDocuments(UUID applicationId) {
        return jdbc.sql("SELECT * FROM solicitud_recaudo WHERE solicitud_id = :solId ORDER BY creado_en ASC")
                .param("solId", applicationId)
                .query(this::mapDocRow)
                .list();
    }

    /** Cuántos recaudos tiene cada solicitud, en una sola consulta (la bandeja del analista los muestra). */
    public Map<UUID, Integer> countDocuments(Collection<UUID> applicationIds) {
        if (applicationIds.isEmpty()) {
            return Map.of();
        }
        StringBuilder literal = new StringBuilder("{");
        for (UUID id : applicationIds) {
            if (literal.length() > 1) {
                literal.append(',');
            }
            literal.append(id);
        }
        literal.append('}');
        Map<UUID, Integer> counts = new HashMap<>();
        jdbc.sql("""
                        select solicitud_id, count(*) as total
                        from solicitud_recaudo
                        where solicitud_id = any (cast(:ids as uuid[]))
                        group by solicitud_id
                        """)
                .param("ids", literal.toString(), Types.VARCHAR)
                .query((rs, n) -> {
                    counts.put(rs.getObject("solicitud_id", UUID.class), rs.getInt("total"));
                    return null;
                })
                .list();
        return counts;
    }

    /** El recaudo, solo si pertenece a esa solicitud. */
    public Optional<CreditDocumentRecord> findDocument(UUID applicationId, UUID documentId) {
        return jdbc.sql("SELECT * FROM solicitud_recaudo WHERE id = :id AND solicitud_id = :solId")
                .param("id", documentId)
                .param("solId", applicationId)
                .query(this::mapDocRow)
                .optional();
    }

    /** El recaudo registrado con esa clave; un archivo cargado y nunca enviado no tiene fila. */
    public Optional<CreditDocumentRecord> findDocumentByKey(String key) {
        return jdbc.sql("SELECT * FROM solicitud_recaudo WHERE archivo_clave = :clave ORDER BY creado_en LIMIT 1")
                .param("clave", key)
                .query(this::mapDocRow)
                .optional();
    }

    /** Cambia el estado de un recaudo de esa solicitud; 0 filas si el recaudo es de otra. */
    public int updateDocumentStatus(UUID applicationId, UUID documentId, String status, String notes) {
        return jdbc.sql("""
                UPDATE solicitud_recaudo SET estado_validacion = :status, observaciones = :obs
                WHERE id = :id AND solicitud_id = :solId
                """)
                .param("status", status)
                .param("obs", notes)
                .param("id", documentId)
                .param("solId", applicationId)
                .update();
    }

    /**
     * Siguiente número de solicitud del año. El contador se incrementa en una sola sentencia atómica: dos envíos
     * simultáneos nunca reciben el mismo número (antes se calculaba con {@code MAX()+1}, hallazgo C-11). Si la
     * transacción se revierte, el número se devuelve con ella.
     */
    public String generateNextApplicationNumber(int year) {
        Long nextVal = jdbc.sql("""
                INSERT INTO contador_solicitud (anio, ultimo) VALUES (:year, 1)
                ON CONFLICT (anio) DO UPDATE SET ultimo = contador_solicitud.ultimo + 1
                RETURNING ultimo
                """)
                .param("year", year)
                .query(Long.class)
                .single();

        return String.format("SOL-%d-%04d", year, nextVal);
    }

    public void insertRiskDecision(RiskDecisionRecord d) {
        jdbc.sql("""
                INSERT INTO decision_riesgo (
                    id, solicitud_id, score_interno, score_buro, riesgo_nivel,
                    resultado, limite_aprobado, cuota_maxima_permitida, justificacion,
                    evaluado_por, evaluado_en, moneda, tasa_bcv, fecha_tasa
                ) VALUES (
                    :id, :solId, :scoreInt, :scoreBuro, :riesgo,
                    :resultado, :limite, :cuotaMax, :justificacion,
                    :evaluadoPor, :evaluadoEn, :moneda, :tasa, :fechaTasa
                )
                ON CONFLICT (solicitud_id) DO UPDATE SET
                    score_interno = EXCLUDED.score_interno,
                    score_buro = EXCLUDED.score_buro,
                    riesgo_nivel = EXCLUDED.riesgo_nivel,
                    resultado = EXCLUDED.resultado,
                    limite_aprobado = EXCLUDED.limite_aprobado,
                    cuota_maxima_permitida = EXCLUDED.cuota_maxima_permitida,
                    justificacion = EXCLUDED.justificacion,
                    evaluado_por = EXCLUDED.evaluado_por,
                    evaluado_en = EXCLUDED.evaluado_en,
                    moneda = EXCLUDED.moneda,
                    tasa_bcv = EXCLUDED.tasa_bcv,
                    fecha_tasa = EXCLUDED.fecha_tasa
                """)
                .param("id", d.id())
                .param("solId", d.applicationId())
                .param("scoreInt", d.internalScore())
                .param("scoreBuro", d.bureauScore())
                .param("riesgo", d.riskLevel())
                .param("resultado", d.result())
                .param("limite", d.approvedLimit())
                .param("cuotaMax", d.maxAllowedPayment())
                .param("justificacion", d.justification())
                .param("evaluadoPor", d.evaluatedBy(), Types.OTHER)
                .param("evaluadoEn", toOffsetDateTime(d.evaluatedAt()), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("moneda", d.currency())
                .param("tasa", d.bcvRate())
                .param("fechaTasa", d.rateDate(), Types.DATE)
                .update();
    }

    public Optional<RiskDecisionRecord> findRiskDecision(UUID applicationId) {
        return jdbc.sql("SELECT * FROM decision_riesgo WHERE solicitud_id = :solId")
                .param("solId", applicationId)
                .query((rs, rowNum) -> new RiskDecisionRecord(
                        (UUID) rs.getObject("id"),
                        (UUID) rs.getObject("solicitud_id"),
                        (Integer) rs.getObject("score_interno"),
                        (Integer) rs.getObject("score_buro"),
                        rs.getString("riesgo_nivel"),
                        rs.getString("resultado"),
                        rs.getBigDecimal("limite_aprobado"),
                        rs.getBigDecimal("cuota_maxima_permitida"),
                        rs.getString("justificacion"),
                        (UUID) rs.getObject("evaluado_por"),
                        toInstant(rs.getObject("evaluado_en", OffsetDateTime.class)),
                        rs.getString("moneda"),
                        rs.getBigDecimal("tasa_bcv"),
                        rs.getObject("fecha_tasa", LocalDate.class)
                ))
                .optional();
    }

    private CreditApplicationRecord mapRow(ResultSet rs, int rowNum) throws SQLException {
        return new CreditApplicationRecord(
                (UUID) rs.getObject("id"),
                rs.getString("numero_solicitud"),
                (UUID) rs.getObject("oportunidad_id"),
                (UUID) rs.getObject("persona_id"),
                (UUID) rs.getObject("vehiculo_id"),
                rs.getBigDecimal("monto_solicitado"),
                rs.getBigDecimal("cuota_inicial"),
                rs.getInt("plazo_meses"),
                rs.getString("moneda"),
                rs.getBigDecimal("tasa_bcv"),
                rs.getObject("fecha_tasa", LocalDate.class),
                json.readValue(cipher.decrypt(rs.getBytes("expediente_cifrado"), CONTEXT_DOSSIER), CreditDossier.class),
                rs.getBigDecimal("capacidad_pago_mensual"),
                rs.getBigDecimal("cuota_estimada"),
                rs.getString("frecuencia_pago"),
                rs.getString("estado"),
                toInstant(rs.getObject("enviada_en", OffsetDateTime.class)),
                toInstant(rs.getObject("creado_en", OffsetDateTime.class)),
                toInstant(rs.getObject("actualizado_en", OffsetDateTime.class))
        );
    }

    private CreditDocumentRecord mapDocRow(ResultSet rs, int rowNum) throws SQLException {
        return new CreditDocumentRecord(
                (UUID) rs.getObject("id"),
                (UUID) rs.getObject("solicitud_id"),
                rs.getString("tipo_documento"),
                rs.getString("archivo_clave"),
                rs.getString("nombre_archivo"),
                (Long) rs.getObject("tamano_bytes"),
                rs.getString("mime_type"),
                rs.getString("estado_validacion"),
                rs.getString("observaciones"),
                toInstant(rs.getObject("creado_en", OffsetDateTime.class))
        );
    }

    private static OffsetDateTime toOffsetDateTime(Instant instant) {
        return instant != null ? OffsetDateTime.ofInstant(instant, ZoneOffset.UTC) : null;
    }

    private static Instant toInstant(OffsetDateTime odt) {
        return odt != null ? odt.toInstant() : null;
    }
}
