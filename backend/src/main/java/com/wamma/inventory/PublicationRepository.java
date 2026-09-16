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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Publicación de cada vehículo y sus fotos (plan 005 §3 y E6): precio en euros, etiqueta, estado. */
@Repository
public class PublicationRepository {

    public record PublicationRecord(UUID id, UUID vehicleId, String title, BigDecimal price, String currency,
                                    BigDecimal rate, LocalDate rateDate, String state, String label,
                                    Instant publishedAt) {
    }

    public record Credit(String author, String license, String origin) {
    }

    public record PhotoRecord(UUID id, UUID publicationId, String key, String thumbnailKey, int width, int height,
                              int order, boolean main, Credit credit) {
    }

    private static final String SELECT_PUBLICATION = """
            select id, vehiculo_id, titulo, precio_venta, moneda, tasa_bcv, fecha_tasa, estado, etiqueta, publicado_en
            from publicacion
            """;

    private static final String SELECT_PHOTO = """
            select id, publicacion_id, clave, clave_miniatura, ancho, alto, orden, es_principal,
                   credito_autor, credito_licencia, credito_origen
            from publicacion_foto
            """;

    private final JdbcClient jdbc;

    public PublicationRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<PublicationRecord> findByVehicle(UUID vehicleId) {
        return jdbc.sql(SELECT_PUBLICATION + " where vehiculo_id = :vehicle")
                .param("vehicle", vehicleId)
                .query(PublicationRepository::publication)
                .optional();
    }

    public List<PublicationRecord> findAll() {
        return jdbc.sql(SELECT_PUBLICATION).query(PublicationRepository::publication).list();
    }

    /** Nace en borrador y en euros (D-21): la tasa se fija al publicar. */
    public UUID insert(UUID vehicleId, String title, BigDecimal price, String label, UUID createdBy) {
        return jdbc.sql("""
                        insert into publicacion (vehiculo_id, titulo, precio_venta, moneda, estado, etiqueta, creado_por)
                        values (:vehicle, :title, :price, 'EUR', 'borrador', :label, :createdBy)
                        returning id
                        """)
                .param("vehicle", vehicleId)
                .param("title", title)
                .param("price", price)
                .param("label", label, Types.VARCHAR)
                .param("createdBy", createdBy, Types.OTHER)
                .query(UUID.class)
                .single();
    }

    public void updateCommercial(UUID id, String title, BigDecimal price, String label) {
        jdbc.sql("update publicacion set titulo = :title, precio_venta = :price, etiqueta = :label where id = :id")
                .param("title", title)
                .param("price", price)
                .param("label", label, Types.VARCHAR)
                .param("id", id)
                .update();
    }

    public void fixRate(UUID id, BigDecimal rate, LocalDate rateDate) {
        jdbc.sql("update publicacion set tasa_bcv = :rate, fecha_tasa = :date where id = :id")
                .param("rate", rate)
                .param("date", rateDate)
                .param("id", id)
                .update();
    }

    /** Conserva la fecha de la primera publicación: es la que distingue "nunca publicado". */
    public void publish(UUID id, BigDecimal rate, LocalDate rateDate, Instant now) {
        jdbc.sql("""
                        update publicacion
                        set estado = 'publicado', tasa_bcv = :rate, fecha_tasa = :date,
                            publicado_en = coalesce(publicado_en, :now)
                        where id = :id
                        """)
                .param("rate", rate)
                .param("date", rateDate)
                .param("now", VehicleRepository.odt(now))
                .param("id", id)
                .update();
    }

    public void pause(UUID id) {
        jdbc.sql("update publicacion set estado = 'pausado' where id = :id").param("id", id).update();
    }

    public void delete(UUID id) {
        jdbc.sql("delete from publicacion where id = :id").param("id", id).update();
    }

    public List<PhotoRecord> photos(UUID publicationId) {
        return jdbc.sql(SELECT_PHOTO + " where publicacion_id = :publication order by orden")
                .param("publication", publicationId)
                .query(PublicationRepository::photo)
                .list();
    }

    public List<PhotoRecord> allPhotos() {
        return jdbc.sql(SELECT_PHOTO + " order by publicacion_id, orden").query(PublicationRepository::photo).list();
    }

    public UUID insertPhoto(UUID publicationId, String key, String thumbnailKey, int width, int height, int order,
                            Credit credit, UUID uploadedBy) {
        return jdbc.sql("""
                        insert into publicacion_foto (publicacion_id, clave, clave_miniatura, ancho, alto, orden,
                                                      es_principal, subida_por, credito_autor, credito_licencia,
                                                      credito_origen)
                        values (:publication, :key, :thumbnail, :width, :height, :order, :main, :uploadedBy,
                                :author, :license, :origin)
                        returning id
                        """)
                .param("publication", publicationId)
                .param("key", key)
                .param("thumbnail", thumbnailKey)
                .param("width", width)
                .param("height", height)
                .param("order", order)
                .param("main", order == 0)
                .param("uploadedBy", uploadedBy, Types.OTHER)
                .param("author", credit == null ? null : credit.author(), Types.VARCHAR)
                .param("license", credit == null ? null : credit.license(), Types.VARCHAR)
                .param("origin", credit == null ? null : credit.origin(), Types.VARCHAR)
                .query(UUID.class)
                .single();
    }

    public void deletePhoto(UUID id) {
        jdbc.sql("delete from publicacion_foto where id = :id").param("id", id).update();
    }

    /** La primera es la principal: la que se ve en el catálogo. */
    public void reorder(UUID publicationId, List<UUID> orderedIds) {
        // Primero se quita la principal: el índice único parcial no admite dos a la vez.
        jdbc.sql("update publicacion_foto set es_principal = false where publicacion_id = :publication")
                .param("publication", publicationId)
                .update();
        for (int i = 0; i < orderedIds.size(); i++) {
            jdbc.sql("update publicacion_foto set orden = :order, es_principal = :main where id = :id and publicacion_id = :publication")
                    .param("order", i)
                    .param("main", i == 0)
                    .param("id", orderedIds.get(i))
                    .param("publication", publicationId)
                    .update();
        }
    }

    private static PublicationRecord publication(ResultSet rs, int rowNum) throws SQLException {
        OffsetDateTime published = rs.getObject("publicado_en", OffsetDateTime.class);
        return new PublicationRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("vehiculo_id", UUID.class),
                rs.getString("titulo"),
                rs.getBigDecimal("precio_venta"),
                rs.getString("moneda"),
                rs.getBigDecimal("tasa_bcv"),
                rs.getObject("fecha_tasa", LocalDate.class),
                rs.getString("estado"),
                rs.getString("etiqueta"),
                published == null ? null : published.toInstant());
    }

    private static PhotoRecord photo(ResultSet rs, int rowNum) throws SQLException {
        String author = rs.getString("credito_autor");
        return new PhotoRecord(
                rs.getObject("id", UUID.class),
                rs.getObject("publicacion_id", UUID.class),
                rs.getString("clave"),
                rs.getString("clave_miniatura"),
                rs.getInt("ancho"),
                rs.getInt("alto"),
                rs.getInt("orden"),
                rs.getBoolean("es_principal"),
                author == null ? null : new Credit(author, rs.getString("credito_licencia"), rs.getString("credito_origen")));
    }
}
