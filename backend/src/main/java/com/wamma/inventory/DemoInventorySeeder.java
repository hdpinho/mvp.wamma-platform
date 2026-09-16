package com.wamma.inventory;

import com.wamma.inventory.PublicationRepository.Credit;
import com.wamma.inventory.PublicationRepository.PublicationRecord;
import com.wamma.inventory.VehicleRepository.VehicleRecord;
import com.wamma.platform.audit.AuditDetail;
import com.wamma.platform.audit.AuditLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.List;
import java.util.UUID;

/**
 * Carga inicial de los 16 vehículos de demostración (D-10, D-25, plan 005 §8), con sus
 * imperfecciones y su foto referencial en el almacenamiento definitivo.
 * <p>
 * Solo actúa con el inventario vacío y se activa con {@code WAMMA_DEMO_CARGAR_INVENTARIO}.
 * Los vehículos quedan en borrador y marcados como de demostración: se publican con
 * "Publicar los listos" una vez registrada la tasa BCV del euro.
 */
@Component
@ConditionalOnProperty(name = "wamma.demo.cargar-inventario", havingValue = "true")
public class DemoInventorySeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoInventorySeeder.class);
    private static final String DATA = "demo/inventario.json";

    record DemoData(String nota, List<DemoVehicle> vehiculos) {
    }

    record DemoVehicle(String codigo, String vin, String marca, String modelo, String version, int anio,
                       BigDecimal precio, int kilometraje, String transmision, String combustible, String carroceria,
                       int puestos, String traccion, boolean certificado, String etiqueta, String color,
                       String disponibilidad, DemoPhoto foto, List<VehicleInput.Imperfection> imperfecciones) {
    }

    record DemoPhoto(String archivo, String autor, String licencia, String origen) {
    }

    private final VehicleRepository vehicles;
    private final PublicationRepository publications;
    private final PhotoService photos;
    private final AuditLog audit;
    private final ObjectMapper json;
    private final TransactionTemplate transaction;
    private final Clock clock;

    public DemoInventorySeeder(VehicleRepository vehicles, PublicationRepository publications, PhotoService photos,
                               AuditLog audit, ObjectMapper json, TransactionTemplate transaction, Clock clock) {
        this.vehicles = vehicles;
        this.publications = publications;
        this.photos = photos;
        this.audit = audit;
        this.json = json;
        this.transaction = transaction;
        this.clock = clock;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (vehicles.count() > 0) {
            log.info("El inventario ya tiene vehículos: no se carga la demostración.");
            return;
        }
        DemoData data = read();
        transaction.executeWithoutResult(status -> data.vehiculos().forEach(this::load));
        log.info("Inventario de demostración cargado: {} vehículos en borrador. Registra la tasa BCV del euro y usa "
                + "«Publicar los listos».", data.vehiculos().size());
    }

    private void load(DemoVehicle demo) {
        VehicleFields fields = new VehicleFields(demo.vin(), null, demo.marca(), demo.modelo(), demo.version(), demo.anio(),
                demo.color(), demo.kilometraje(), demo.carroceria(), demo.transmision(), demo.combustible(),
                demo.traccion(), demo.puestos(), null, null, null, null);
        Availability availability = Availability.fromCode(demo.disponibilidad()).orElse(Availability.AVAILABLE);
        VehicleRepository.Inserted inserted = vehicles.insert(demo.codigo(), fields, vehicles.siteId(InventoryService.SITE),
                availability.dbState(), true);
        publications.insert(inserted.id(), fields.title(), demo.precio(), demo.etiqueta(), null);

        List<VehicleInput.Imperfection> imperfections = demo.imperfecciones() == null ? List.of() : demo.imperfecciones();
        String result = demo.certificado() ? (imperfections.isEmpty() ? "apto" : "con_observaciones") : null;
        UUID inspection = vehicles.insertInspection(inserted.id(), null, "carga_inicial",
                demo.certificado() ? "certificada" : "en_progreso", result, demo.certificado() ? clock.instant() : null);
        vehicles.replaceImperfections(inspection, imperfections);

        VehicleRecord vehicle = vehicles.findByCode(inserted.code()).orElseThrow();
        PublicationRecord publication = publications.findByVehicle(vehicle.id()).orElseThrow();
        DemoPhoto photo = demo.foto();
        photos.store(vehicle, publication, readPhoto(photo.archivo()), 0,
                new Credit(photo.autor(), photo.licencia(), photo.origen()), null);

        audit.recordAs(null, "vehiculo.creado", "vehiculo", vehicle.id(), null,
                AuditDetail.of("codigo", vehicle.code(), "marca", vehicle.brand(), "modelo", vehicle.model(),
                        "anio", vehicle.year(), "precio", demo.precio().toPlainString(), "moneda", "EUR",
                        "origen", "carga_inicial", "imperfecciones", imperfections.size()));
    }

    private DemoData read() {
        try (InputStream in = new ClassPathResource(DATA).getInputStream()) {
            return json.readValue(in, DemoData.class);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer " + DATA, e);
        }
    }

    private static byte[] readPhoto(String file) {
        try (InputStream in = new ClassPathResource("demo/fotos/" + file).getInputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer la foto de demostración " + file, e);
        }
    }
}
