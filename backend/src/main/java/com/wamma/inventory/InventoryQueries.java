package com.wamma.inventory;

import com.wamma.inventory.PublicationRepository.PhotoRecord;
import com.wamma.inventory.PublicationRepository.PublicationRecord;
import com.wamma.inventory.VehicleRepository.ImperfectionRecord;
import com.wamma.inventory.VehicleRepository.InspectionRecord;
import com.wamma.inventory.VehicleRepository.VehicleRecord;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Lectura del inventario completo: vehículo, publicación, certificación, fotos e
 * imperfecciones. El listado se arma con cinco consultas, no con cinco por vehículo.
 */
@Component
public class InventoryQueries {

    public record Assembled(VehicleRecord vehicle, PublicationRecord publication, UUID inspectionId, boolean certified,
                            List<PhotoRecord> photos, List<ImperfectionRecord> imperfections) {

        public Availability availability() {
            return Availability.fromDbState(vehicle.state());
        }

        public boolean onShowcase() {
            return "publicado".equals(publication.state()) && availability() != Availability.SOLD;
        }
    }

    private final VehicleRepository vehicles;
    private final PublicationRepository publications;

    public InventoryQueries(VehicleRepository vehicles, PublicationRepository publications) {
        this.vehicles = vehicles;
        this.publications = publications;
    }

    public List<Assembled> all() {
        Map<UUID, PublicationRecord> publicationByVehicle = publications.findAll().stream()
                .collect(Collectors.toMap(PublicationRecord::vehicleId, Function.identity()));
        Map<UUID, List<PhotoRecord>> photosByPublication = publications.allPhotos().stream()
                .collect(Collectors.groupingBy(PhotoRecord::publicationId));
        Map<UUID, InspectionRecord> inspections = vehicles.latestInspections();
        Map<UUID, List<ImperfectionRecord>> imperfectionsByVehicle = vehicles.allImperfections().stream()
                .collect(Collectors.groupingBy(ImperfectionRecord::vehicleId));

        return vehicles.findAll().stream()
                .filter(vehicle -> publicationByVehicle.containsKey(vehicle.id()))
                .map(vehicle -> {
                    PublicationRecord publication = publicationByVehicle.get(vehicle.id());
                    InspectionRecord inspection = inspections.get(vehicle.id());
                    return new Assembled(vehicle, publication,
                            inspection == null ? null : inspection.id(),
                            inspection != null && inspection.certified(),
                            photosByPublication.getOrDefault(publication.id(), List.of()),
                            imperfectionsByVehicle.getOrDefault(vehicle.id(), List.of()));
                })
                .toList();
    }

    public Optional<Assembled> byCode(String code) {
        return vehicles.findByCode(code).flatMap(vehicle -> publications.findByVehicle(vehicle.id()).map(publication -> {
            Optional<InspectionRecord> inspection = vehicles.inspection(vehicle.id());
            return new Assembled(vehicle, publication,
                    inspection.map(InspectionRecord::id).orElse(null),
                    inspection.map(InspectionRecord::certified).orElse(false),
                    publications.photos(publication.id()),
                    vehicles.imperfections(vehicle.id()));
        }));
    }
}
