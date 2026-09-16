package com.wamma.inventory;

import com.wamma.inventory.InventoryViews.PhotoView;
import com.wamma.inventory.PublicationRepository.Credit;
import com.wamma.inventory.PublicationRepository.PhotoRecord;
import com.wamma.inventory.PublicationRepository.PublicationRecord;
import com.wamma.inventory.VehicleRepository.VehicleRecord;
import com.wamma.inventory.photos.PhotoCleanup;
import com.wamma.inventory.photos.PhotoProcessor;
import com.wamma.inventory.photos.PhotoStorage;
import com.wamma.platform.audit.AuditDetail;
import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.UUID;

/**
 * Fotos de un vehículo (spec 005 RF-005.8): subir, quitar y ordenar. La primera es la
 * principal. Cada cambio queda en la bitácora.
 */
@Service
public class PhotoService {

    private final VehicleRepository vehicles;
    private final PublicationRepository publications;
    private final PhotoProcessor processor;
    private final PhotoStorage storage;
    private final PhotoCleanup cleanup;
    private final AuditLog audit;

    public PhotoService(VehicleRepository vehicles, PublicationRepository publications, PhotoProcessor processor,
                        PhotoStorage storage, PhotoCleanup cleanup, AuditLog audit) {
        this.vehicles = vehicles;
        this.publications = publications;
        this.processor = processor;
        this.storage = storage;
        this.cleanup = cleanup;
        this.audit = audit;
    }

    @Transactional
    public PhotoView add(String code, byte[] content) {
        VehicleRecord vehicle = vehicle(code);
        PublicationRecord publication = publication(vehicle);
        int count = publications.photos(publication.id()).size();
        if (count >= PublicationRules.MAX_PHOTOS) {
            throw ApiException.conflict("Máximo de fotos",
                    "Este vehículo ya tiene " + PublicationRules.MAX_PHOTOS + " fotos, el máximo. Quita una antes de agregar otra.");
        }
        PhotoRecord photo = store(vehicle, publication, content, count, null, CurrentUser.id().orElse(null));
        audit.record("foto.agregada", "vehiculo", vehicle.id(), null,
                AuditDetail.of("codigo", vehicle.code(), "foto", photo.id().toString(), "orden", photo.order()));
        return InventoryViews.photo(photo, storage);
    }

    /**
     * Procesa, sube al almacén y registra en la base. Si la transacción se revierte, lo subido
     * se borra. También la usa la carga de demostración, con el crédito de la foto.
     */
    PhotoRecord store(VehicleRecord vehicle, PublicationRecord publication, byte[] content, int order, Credit credit,
                      UUID uploadedBy) {
        PhotoProcessor.Processed processed = processor.process(content);
        String base = vehicle.code() + "/" + UUID.randomUUID();
        String key = base + "-1600.jpg";
        String thumbnailKey = base + "-640.jpg";
        storage.put(key, processed.large().jpeg(), "image/jpeg");
        storage.put(thumbnailKey, processed.thumbnail().jpeg(), "image/jpeg");
        cleanup.deleteIfRolledBack(List.of(key, thumbnailKey));
        UUID id = publications.insertPhoto(publication.id(), key, thumbnailKey, processed.large().width(),
                processed.large().height(), order, credit, uploadedBy);
        return new PhotoRecord(id, publication.id(), key, thumbnailKey, processed.large().width(),
                processed.large().height(), order, order == 0, credit);
    }

    @Transactional
    public void remove(String code, UUID photoId) {
        VehicleRecord vehicle = vehicle(code);
        PublicationRecord publication = publication(vehicle);
        List<PhotoRecord> photos = publications.photos(publication.id());
        PhotoRecord target = photos.stream()
                .filter(photo -> photo.id().equals(photoId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("La foto no existe."));
        int minimum = PublicationRules.minimumPhotos(vehicle.demo());
        if ("publicado".equals(publication.state()) && photos.size() - 1 < minimum) {
            throw ApiException.conflict("Mínimo de fotos",
                    "Una publicación activa necesita al menos " + minimum
                            + " fotos. Agrega otra o pausa la publicación antes de quitar esta.");
        }
        publications.deletePhoto(photoId);
        publications.reorder(publication.id(), photos.stream().map(PhotoRecord::id).filter(id -> !id.equals(photoId)).toList());
        cleanup.deleteAfterCommit(List.of(target.key(), target.thumbnailKey()));
        audit.record("foto.quitada", "vehiculo", vehicle.id(),
                AuditDetail.of("codigo", vehicle.code(), "foto", photoId.toString()), null);
    }

    @Transactional
    public List<PhotoView> reorder(String code, List<UUID> orderedIds) {
        VehicleRecord vehicle = vehicle(code);
        PublicationRecord publication = publication(vehicle);
        List<PhotoRecord> photos = publications.photos(publication.id());
        boolean sameSet = orderedIds.size() == photos.size()
                && new HashSet<>(orderedIds).size() == orderedIds.size()
                && photos.stream().map(PhotoRecord::id).allMatch(orderedIds::contains);
        if (!sameSet) {
            throw ApiException.badRequest("Orden no válido", "El orden debe incluir cada foto del vehículo una sola vez.");
        }
        publications.reorder(publication.id(), orderedIds);
        audit.record("fotos.reordenadas", "vehiculo", vehicle.id(), null,
                AuditDetail.of("codigo", vehicle.code(), "principal", orderedIds.getFirst().toString()));
        return publications.photos(publication.id()).stream().map(photo -> InventoryViews.photo(photo, storage)).toList();
    }

    private VehicleRecord vehicle(String code) {
        return vehicles.findByCode(code).orElseThrow(() -> ApiException.notFound("El vehículo no existe."));
    }

    private PublicationRecord publication(VehicleRecord vehicle) {
        return publications.findByVehicle(vehicle.id())
                .orElseThrow(() -> new IllegalStateException("Vehículo sin publicación: " + vehicle.code()));
    }
}
