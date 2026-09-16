package com.wamma.inventory;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Vehículo, su inspección (certificación simplificada) y sus imperfecciones
 * (plan 005 §3 y E7). En esta etapa cada vehículo tiene una sola inspección.
 */
@Repository
public class VehicleRepository {

    public record VehicleRecord(UUID id, String code, String vin, String plate, String brand, String model,
                                String version, int year, String color, int mileage, String bodyType,
                                String transmission, String fuel, String traction, int seats, String state, String site,
                                BigDecimal acquisitionPrice, String acquisitionCurrency, BigDecimal acquisitionRate,
                                LocalDate acquisitionRateDate, boolean demo, Instant createdAt, Instant updatedAt) {
    }

    public record Inserted(UUID id, String code) {
    }

    public record InspectionRecord(UUID id, UUID vehicleId, String state, String result) {

        public boolean certified() {
            return "certificada".equals(state);
        }
    }

    public record ImperfectionRecord(UUID id, UUID vehicleId, String code, String zone, String type,
                                     String description, String severity, String location, BigDecimal x,
                                     BigDecimal y) {
    }

    private static final String SELECT_VEHICLE = """
            select v.id, v.codigo, v.vin, v.placa, v.marca, v.modelo, v.version, v.anio, v.color, v.kilometraje,
                   v.carroceria, v.transmision, v.combustible, v.traccion, v.puestos, v.estado, s.nombre as sede,
                   v.precio_adquisicion, v.moneda_adquisicion, v.tasa_bcv_adquisicion, v.fecha_tasa_adquisicion,
                   v.es_demostracion, v.creado_en, v.actualizado_en
            from vehiculo v
            join sede s on s.id = v.sede_id
            """;

    private static final String SELECT_IMPERFECTION = """
            select p.id, i.vehiculo_id, p.codigo_punto, p.zona, p.nombre_punto, p.notas, p.severidad, p.ubicacion,
                   p.posicion_x, p.posicion_y
            from inspeccion_punto p
            join inspeccion i on i.id = p.inspeccion_id
            where p.categoria = 'estetica' and p.resultado = 'no_conforme'
            """;

    private final JdbcClient jdbc;

    public VehicleRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<VehicleRecord> findByCode(String code) {
        return jdbc.sql(SELECT_VEHICLE + " where v.codigo = :code")
                .param("code", code)
                .query(VehicleRepository::vehicle)
                .optional();
    }

    public List<VehicleRecord> findAll() {
        return jdbc.sql(SELECT_VEHICLE + " order by v.creado_en desc, v.codigo")
                .query(VehicleRepository::vehicle)
                .list();
    }

    public long count() {
        return jdbc.sql("select count(*) from vehiculo").query(Long.class).single();
    }

    public UUID siteId(String code) {
        return jdbc.sql("select id from sede where codigo = :code")
                .param("code", code)
                .query(UUID.class)
                .optional()
                .orElseThrow(() -> new IllegalStateException("Falta la sede " + code + " (V0014)"));
    }

    /** Sin código, la base asigna el siguiente {@code WAM-} de su secuencia (V0014). */
    public Inserted insert(String code, VehicleFields fields, UUID siteId, String state, boolean demo) {
        String codeColumn = code == null ? "" : "codigo, ";
        String codeValue = code == null ? "" : ":code, ";
        JdbcClient.StatementSpec spec = jdbc.sql("""
                insert into vehiculo (%svin, placa, marca, modelo, version, anio, color, kilometraje, carroceria,
                                      transmision, combustible, traccion, puestos, estado, sede_id, precio_adquisicion,
                                      moneda_adquisicion, tasa_bcv_adquisicion, fecha_tasa_adquisicion, es_demostracion)
                values (%s:vin, :plate, :brand, :model, :version, :year, :color, :mileage, :bodyType,
                        :transmission, :fuel, :traction, :seats, :state, :site, :acqPrice,
                        :acqCurrency, :acqRate, :acqDate, :demo)
                returning id, codigo
                """.formatted(codeColumn, codeValue));
        if (code != null) {
            spec = spec.param("code", code);
        }
        return bind(spec, fields)
                .param("state", state)
                .param("site", siteId)
                .param("demo", demo)
                .query((rs, n) -> new Inserted(rs.getObject("id", UUID.class), rs.getString("codigo")))
                .single();
    }

    /** Solo actualiza si nadie lo cambió desde {@code expectedUpdatedAt}. */
    public boolean update(UUID id, VehicleFields fields, Instant expectedUpdatedAt) {
        return bind(jdbc.sql("""
                        update vehiculo
                        set vin = :vin, placa = :plate, marca = :brand, modelo = :model, version = :version, anio = :year,
                            color = :color, kilometraje = :mileage, carroceria = :bodyType, transmision = :transmission,
                            combustible = :fuel, traccion = :traction, puestos = :seats,
                            precio_adquisicion = :acqPrice, moneda_adquisicion = :acqCurrency,
                            tasa_bcv_adquisicion = :acqRate, fecha_tasa_adquisicion = :acqDate
                        where id = :id and actualizado_en = :expected
                        """), fields)
                .param("id", id)
                .param("expected", odt(expectedUpdatedAt))
                .update() == 1;
    }

    public void setState(UUID id, String state) {
        jdbc.sql("update vehiculo set estado = :state where id = :id").param("state", state).param("id", id).update();
    }

    public void delete(UUID id) {
        jdbc.sql("delete from inspeccion where vehiculo_id = :id").param("id", id).update();
        jdbc.sql("delete from vehiculo where id = :id").param("id", id).update();
    }

    public UUID insertInspection(UUID vehicleId, UUID inspectorId, String origin, String state, String result,
                                 Instant finishedAt) {
        return jdbc.sql("""
                        insert into inspeccion (vehiculo_id, inspector_id, origen, estado, resultado, finalizado_en)
                        values (:vehicle, :inspector, :origin, :state, :result, :finished)
                        returning id
                        """)
                .param("vehicle", vehicleId)
                .param("inspector", inspectorId, Types.OTHER)
                .param("origin", origin)
                .param("state", state)
                .param("result", result, Types.VARCHAR)
                .param("finished", odt(finishedAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .query(UUID.class)
                .single();
    }

    /** Si cambia la certificación, queda como inspector quien la cambió. */
    public void updateInspection(UUID id, String state, String result, UUID inspectorId, Instant finishedAt) {
        jdbc.sql("""
                        update inspeccion
                        set estado = :state, resultado = :result, finalizado_en = :finished,
                            inspector_id = coalesce(:inspector, inspector_id)
                        where id = :id
                        """)
                .param("state", state)
                .param("result", result, Types.VARCHAR)
                .param("finished", odt(finishedAt), Types.TIMESTAMP_WITH_TIMEZONE)
                .param("inspector", inspectorId, Types.OTHER)
                .param("id", id)
                .update();
    }

    public Optional<InspectionRecord> inspection(UUID vehicleId) {
        return jdbc.sql("""
                        select id, vehiculo_id, estado, resultado from inspeccion
                        where vehiculo_id = :vehicle order by creado_en desc limit 1
                        """)
                .param("vehicle", vehicleId)
                .query(VehicleRepository::inspection)
                .optional();
    }

    public Map<UUID, InspectionRecord> latestInspections() {
        Map<UUID, InspectionRecord> result = new HashMap<>();
        jdbc.sql("""
                        select distinct on (vehiculo_id) id, vehiculo_id, estado, resultado
                        from inspeccion order by vehiculo_id, creado_en desc
                        """)
                .query(VehicleRepository::inspection)
                .list()
                .forEach(inspection -> result.put(inspection.vehicleId(), inspection));
        return result;
    }

    public List<ImperfectionRecord> imperfections(UUID vehicleId) {
        return jdbc.sql(SELECT_IMPERFECTION + " and i.vehiculo_id = :vehicle order by p.codigo_punto")
                .param("vehicle", vehicleId)
                .query(VehicleRepository::imperfection)
                .list();
    }

    public List<ImperfectionRecord> allImperfections() {
        return jdbc.sql(SELECT_IMPERFECTION + " order by i.vehiculo_id, p.codigo_punto")
                .query(VehicleRepository::imperfection)
                .list();
    }

    public void replaceImperfections(UUID inspectionId, List<VehicleInput.Imperfection> imperfections) {
        jdbc.sql("delete from inspeccion_punto where inspeccion_id = :id").param("id", inspectionId).update();
        int number = 1;
        for (VehicleInput.Imperfection imperfection : imperfections) {
            jdbc.sql("""
                            insert into inspeccion_punto (inspeccion_id, codigo_punto, categoria, nombre_punto, resultado,
                                                          severidad, zona, ubicacion, posicion_x, posicion_y, notas)
                            values (:inspection, :code, 'estetica', :type, 'no_conforme', :severity, :zone, :location,
                                    :x, :y, :description)
                            """)
                    .param("inspection", inspectionId)
                    .param("code", "IMP-%02d".formatted(number++))
                    .param("type", imperfection.tipo())
                    .param("severity", imperfection.severidad())
                    .param("zone", imperfection.zona())
                    .param("location", imperfection.ubicacion(), Types.VARCHAR)
                    .param("x", imperfection.x())
                    .param("y", imperfection.y())
                    .param("description", imperfection.descripcion(), Types.VARCHAR)
                    .update();
        }
    }

    private static JdbcClient.StatementSpec bind(JdbcClient.StatementSpec spec, VehicleFields f) {
        return spec.param("vin", f.vin())
                .param("plate", f.plate(), Types.VARCHAR)
                .param("brand", f.brand())
                .param("model", f.model())
                .param("version", f.version(), Types.VARCHAR)
                .param("year", f.year())
                .param("color", f.color())
                .param("mileage", f.mileage())
                .param("bodyType", f.bodyType())
                .param("transmission", f.transmission())
                .param("fuel", f.fuel())
                .param("traction", f.traction())
                .param("seats", f.seats())
                .param("acqPrice", f.acquisitionPrice(), Types.NUMERIC)
                .param("acqCurrency", f.acquisitionCurrency(), Types.VARCHAR)
                .param("acqRate", f.acquisitionRate(), Types.NUMERIC)
                .param("acqDate", f.acquisitionRateDate(), Types.DATE);
    }

    static OffsetDateTime odt(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private static VehicleRecord vehicle(ResultSet rs, int rowNum) throws SQLException {
        return new VehicleRecord(
                rs.getObject("id", UUID.class),
                rs.getString("codigo"),
                rs.getString("vin"),
                rs.getString("placa"),
                rs.getString("marca"),
                rs.getString("modelo"),
                rs.getString("version"),
                rs.getInt("anio"),
                rs.getString("color"),
                rs.getInt("kilometraje"),
                rs.getString("carroceria"),
                rs.getString("transmision"),
                rs.getString("combustible"),
                rs.getString("traccion"),
                rs.getInt("puestos"),
                rs.getString("estado"),
                rs.getString("sede"),
                rs.getBigDecimal("precio_adquisicion"),
                rs.getString("moneda_adquisicion"),
                rs.getBigDecimal("tasa_bcv_adquisicion"),
                rs.getObject("fecha_tasa_adquisicion", LocalDate.class),
                rs.getBoolean("es_demostracion"),
                rs.getObject("creado_en", OffsetDateTime.class).toInstant(),
                rs.getObject("actualizado_en", OffsetDateTime.class).toInstant());
    }

    private static InspectionRecord inspection(ResultSet rs, int rowNum) throws SQLException {
        return new InspectionRecord(rs.getObject("id", UUID.class), rs.getObject("vehiculo_id", UUID.class),
                rs.getString("estado"), rs.getString("resultado"));
    }

    private static ImperfectionRecord imperfection(ResultSet rs, int rowNum) throws SQLException {
        return new ImperfectionRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("vehiculo_id", UUID.class),
                rs.getString("codigo_punto"),
                rs.getString("zona"),
                rs.getString("nombre_punto"),
                rs.getString("notas"),
                rs.getString("severidad"),
                rs.getString("ubicacion"),
                rs.getBigDecimal("posicion_x"),
                rs.getBigDecimal("posicion_y"));
    }
}
