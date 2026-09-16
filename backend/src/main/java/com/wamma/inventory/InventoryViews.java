package com.wamma.inventory;

import com.wamma.exchangerate.BcvRate;
import com.wamma.inventory.InventoryQueries.Assembled;
import com.wamma.inventory.PublicationRepository.PhotoRecord;
import com.wamma.inventory.VehicleRepository.ImperfectionRecord;
import com.wamma.inventory.VehicleRepository.VehicleRecord;
import com.wamma.inventory.photos.PhotoStorage;
import com.wamma.platform.money.CurrencyCode;
import com.wamma.platform.money.Money;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Lo que devuelve la API del inventario y de la vitrina. Los nombres son los del contrato,
 * en español. La vitrina no incluye datos internos: ni placa, ni adquisición (spec 005 §7).
 */
public final class InventoryViews {

    private InventoryViews() {
    }

    public record CreditView(String autor, String licencia, String origen) {
    }

    public record PhotoView(UUID id, String url, String urlMiniatura, int ancho, int alto, int orden, CreditView credito) {
    }

    public record ImperfectionView(UUID id, String zona, String tipo, String descripcion, String severidad,
                                   String ubicacion, BigDecimal x, BigDecimal y) {
    }

    public record PublicationView(String estado, Instant publicadoEn, BigDecimal tasaBcv, LocalDate fechaTasa) {
    }

    public record AcquisitionView(BigDecimal precio, String moneda, BigDecimal tasaBcv, LocalDate fecha) {
    }

    /** Vehículo en el backoffice. {@code adquisicion} solo llega a quien gestiona el inventario. */
    public record InventoryVehicle(String codigo, String vin, String placa, String marca, String modelo, String version,
                                   int anio, int kilometraje, String transmision, String combustible, String carroceria,
                                   int puestos, String traccion, String color, String sede, String disponibilidad,
                                   boolean certificado, BigDecimal precio, String moneda, String etiqueta,
                                   PublicationView publicacion, List<PhotoView> fotos,
                                   List<ImperfectionView> imperfecciones, AcquisitionView adquisicion,
                                   boolean esDemostracion, int fotosMinimas, List<String> faltaParaPublicar,
                                   Instant creadoEn, Instant actualizadoEn) {
    }

    /** Vehículo en la vitrina pública. {@code precioVes} es nulo si no hay tasa del euro registrada. */
    public record CatalogVehicle(String codigo, String vin, String marca, String modelo, String version, int anio,
                                 int kilometraje, String transmision, String combustible, String carroceria,
                                 int puestos, String traccion, String color, String sede, String disponibilidad,
                                 boolean certificado, BigDecimal precio, String moneda, BigDecimal precioVes,
                                 String etiqueta, List<PhotoView> fotos, List<ImperfectionView> imperfecciones) {
    }

    public static InventoryVehicle inventory(Assembled a, PhotoStorage storage, boolean rateAvailable,
                                             boolean includeAcquisition) {
        VehicleRecord v = a.vehicle();
        boolean sold = a.availability() == Availability.SOLD;
        List<String> missing = "publicado".equals(a.publication().state())
                ? List.of()
                : PublicationRules.missing(new PublicationRules.Candidate(v.demo(), a.photos().size(), sold, rateAvailable));
        AcquisitionView acquisition = includeAcquisition && v.acquisitionPrice() != null
                ? new AcquisitionView(v.acquisitionPrice(), v.acquisitionCurrency(), v.acquisitionRate(), v.acquisitionRateDate())
                : null;
        return new InventoryVehicle(v.code(), v.vin(), v.plate(), v.brand(), v.model(), v.version(), v.year(), v.mileage(),
                v.transmission(), v.fuel(), v.bodyType(), v.seats(), v.traction(), v.color(), v.site(),
                a.availability().code(), a.certified(), a.publication().price(), a.publication().currency(),
                a.publication().label(),
                new PublicationView(a.publication().state(), a.publication().publishedAt(), a.publication().rate(),
                        a.publication().rateDate()),
                photos(a.photos(), storage), imperfections(a.imperfections()), acquisition, v.demo(),
                PublicationRules.minimumPhotos(v.demo()), missing, v.createdAt(), v.updatedAt());
    }

    public static CatalogVehicle catalog(Assembled a, PhotoStorage storage, Optional<BcvRate> rate) {
        VehicleRecord v = a.vehicle();
        BigDecimal priceVes = rate
                .map(r -> Money.of(a.publication().price(), CurrencyCode.EUR).convertTo(CurrencyCode.VES, r.vesPerUnit()).amount())
                .orElse(null);
        return new CatalogVehicle(v.code(), v.vin(), v.brand(), v.model(), v.version(), v.year(), v.mileage(),
                v.transmission(), v.fuel(), v.bodyType(), v.seats(), v.traction(), v.color(), v.site(),
                a.availability().code(), a.certified(), a.publication().price(), a.publication().currency(), priceVes,
                a.publication().label(), photos(a.photos(), storage), imperfections(a.imperfections()));
    }

    static PhotoView photo(PhotoRecord p, PhotoStorage storage) {
        CreditView credit = p.credit() == null
                ? null
                : new CreditView(p.credit().author(), p.credit().license(), p.credit().origin());
        return new PhotoView(p.id(), storage.publicUrl(p.key()), storage.publicUrl(p.thumbnailKey()), p.width(),
                p.height(), p.order(), credit);
    }

    private static List<PhotoView> photos(List<PhotoRecord> photos, PhotoStorage storage) {
        return photos.stream().map(p -> photo(p, storage)).toList();
    }

    private static List<ImperfectionView> imperfections(List<ImperfectionRecord> imperfections) {
        return imperfections.stream()
                .map(i -> new ImperfectionView(i.id(), i.zone(), i.type(), i.description(), i.severity(), i.location(),
                        i.x(), i.y()))
                .toList();
    }
}
