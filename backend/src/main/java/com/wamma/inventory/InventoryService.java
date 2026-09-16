package com.wamma.inventory;

import com.wamma.exchangerate.BcvRate;
import com.wamma.exchangerate.ExchangeRateService;
import com.wamma.inventory.InventoryQueries.Assembled;
import com.wamma.inventory.InventoryViews.InventoryVehicle;
import com.wamma.inventory.PublicationRepository.PhotoRecord;
import com.wamma.inventory.PublicationRepository.PublicationRecord;
import com.wamma.inventory.VehicleRepository.ImperfectionRecord;
import com.wamma.inventory.VehicleRepository.VehicleRecord;
import com.wamma.inventory.photos.PhotoCleanup;
import com.wamma.inventory.photos.PhotoStorage;
import com.wamma.platform.audit.AuditDetail;
import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.web.ApiException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Inventario del backoffice (spec 005 §6, plan §4): alta, edición, certificación,
 * imperfecciones, publicación y disponibilidad. Cada cambio queda en la bitácora dentro de
 * la misma transacción (plan 001 §8).
 */
@Service
public class InventoryService {

    static final String SITE = "DC";
    static final String MANAGE = "inventario.gestionar";

    public record BatchResult(List<String> publicados, List<Pending> pendientes) {

        public record Pending(String codigo, List<String> motivos) {
        }
    }

    private final VehicleRepository vehicles;
    private final PublicationRepository publications;
    private final InventoryQueries queries;
    private final ExchangeRateService rates;
    private final PhotoStorage storage;
    private final PhotoCleanup cleanup;
    private final AuditLog audit;
    private final Clock clock;

    public InventoryService(VehicleRepository vehicles, PublicationRepository publications, InventoryQueries queries,
                            ExchangeRateService rates, PhotoStorage storage, PhotoCleanup cleanup, AuditLog audit,
                            Clock clock) {
        this.vehicles = vehicles;
        this.publications = publications;
        this.queries = queries;
        this.rates = rates;
        this.storage = storage;
        this.cleanup = cleanup;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<InventoryVehicle> list() {
        boolean rateAvailable = rates.currentEuroRate().isPresent();
        boolean acquisition = CurrentUser.hasAuthority(MANAGE);
        return queries.all().stream()
                .map(a -> InventoryViews.inventory(a, storage, rateAvailable, acquisition))
                .toList();
    }

    @Transactional(readOnly = true)
    public InventoryVehicle get(String code) {
        return InventoryViews.inventory(find(code), storage, rates.currentEuroRate().isPresent(),
                CurrentUser.hasAuthority(MANAGE));
    }

    @Transactional
    public InventoryVehicle create(VehicleInput input) {
        VehicleFields fields = VehicleFields.from(input, rates.today());
        Availability availability = input.disponibilidad() == null
                ? Availability.AVAILABLE
                : Availability.fromCode(input.disponibilidad()).orElseThrow();
        UUID user = CurrentUser.id().orElseThrow(() -> new IllegalStateException("Alta de vehículo sin usuario"));
        List<VehicleInput.Imperfection> imperfections = normalized(input.imperfecciones());

        VehicleRepository.Inserted inserted = guardUnique(() ->
                vehicles.insert(null, fields, vehicles.siteId(SITE), availability.dbState(), false));
        publications.insert(inserted.id(), fields.title(), input.precio(), blankToNull(input.etiqueta()), user);
        UUID inspection = vehicles.insertInspection(inserted.id(), user, "manual", inspectionState(input.certificado()),
                inspectionResult(input.certificado(), imperfections), finishedAt(input.certificado()));
        vehicles.replaceImperfections(inspection, imperfections);

        audit.record("vehiculo.creado", "vehiculo", inserted.id(), null,
                AuditDetail.of("codigo", inserted.code(), "marca", fields.brand(), "modelo", fields.model(),
                        "anio", fields.year(), "precio", input.precio().toPlainString(), "moneda", "EUR",
                        "certificado", input.certificado(), "imperfecciones", imperfections.size()));
        return get(inserted.code());
    }

    @Transactional
    public InventoryVehicle update(String code, VehicleInput input) {
        if (input.actualizadoEn() == null) {
            throw ApiException.badRequest("Datos inválidos", "Falta actualizadoEn: la fecha de la última actualización que leíste.");
        }
        Assembled current = find(code);
        VehicleRecord before = current.vehicle();
        VehicleFields fields = VehicleFields.from(input, rates.today());
        boolean updated = guardUnique(() -> vehicles.update(before.id(), fields, input.actualizadoEn()));
        if (!updated) {
            throw ApiException.conflict("Cambio simultáneo",
                    "Otra persona modificó este vehículo mientras lo editabas. Recarga la página para ver sus cambios.");
        }

        PublicationRecord publication = current.publication();
        boolean priceChanged = publication.price().compareTo(input.precio()) != 0;
        publications.updateCommercial(publication.id(), fields.title(), input.precio(), blankToNull(input.etiqueta()));
        BcvRate fixedRate = null;
        if (priceChanged && "publicado".equals(publication.state())) {
            fixedRate = rates.currentEuroRate().orElseThrow(() -> ApiException.conflict("Sin tasa BCV",
                    "Registra la tasa BCV del euro antes de cambiar el precio de un vehículo publicado."));
            publications.fixRate(publication.id(), fixedRate.vesPerUnit(), fixedRate.date());
        }

        List<VehicleInput.Imperfection> imperfections = normalized(input.imperfecciones());
        boolean certificationChanged = current.certified() != input.certificado();
        vehicles.updateInspection(current.inspectionId(), inspectionState(input.certificado()),
                inspectionResult(input.certificado(), imperfections),
                certificationChanged ? CurrentUser.id().orElse(null) : null,
                finishedAt(input.certificado()));
        vehicles.replaceImperfections(current.inspectionId(), imperfections);

        Map<String, Object> changedBefore = new LinkedHashMap<>();
        Map<String, Object> changedAfter = new LinkedHashMap<>();
        diff(changedBefore, changedAfter, "vin", before.vin(), fields.vin());
        diff(changedBefore, changedAfter, "placa", before.plate(), fields.plate());
        diff(changedBefore, changedAfter, "marca", before.brand(), fields.brand());
        diff(changedBefore, changedAfter, "modelo", before.model(), fields.model());
        diff(changedBefore, changedAfter, "version", before.version(), fields.version());
        diff(changedBefore, changedAfter, "anio", before.year(), fields.year());
        diff(changedBefore, changedAfter, "kilometraje", before.mileage(), fields.mileage());
        diff(changedBefore, changedAfter, "color", before.color(), fields.color());
        diff(changedBefore, changedAfter, "carroceria", before.bodyType(), fields.bodyType());
        diff(changedBefore, changedAfter, "transmision", before.transmission(), fields.transmission());
        diff(changedBefore, changedAfter, "combustible", before.fuel(), fields.fuel());
        diff(changedBefore, changedAfter, "traccion", before.traction(), fields.traction());
        diff(changedBefore, changedAfter, "puestos", before.seats(), fields.seats());
        diff(changedBefore, changedAfter, "etiqueta", publication.label(), blankToNull(input.etiqueta()));
        diff(changedBefore, changedAfter, "adquisicion", plain(before.acquisitionPrice()), plain(fields.acquisitionPrice()));
        if (!sameImperfections(current.imperfections(), imperfections)) {
            changedBefore.put("imperfecciones", current.imperfections().size());
            changedAfter.put("imperfecciones", imperfections.size());
        }
        changedAfter.put("codigo", code);
        audit.record("vehiculo.actualizado", "vehiculo", before.id(), changedBefore, changedAfter);
        if (priceChanged) {
            audit.record("publicacion.precio_cambiado", "vehiculo", before.id(),
                    AuditDetail.of("precio", publication.price().toPlainString()),
                    AuditDetail.of("codigo", code, "precio", input.precio().toPlainString(), "moneda", "EUR",
                            "tasa", fixedRate == null ? null : fixedRate.vesPerUnit().toPlainString(),
                            "fechaTasa", fixedRate == null ? null : fixedRate.date().toString()));
        }
        if (certificationChanged) {
            audit.record("vehiculo.certificado", "vehiculo", before.id(),
                    AuditDetail.of("certificado", current.certified()),
                    AuditDetail.of("codigo", code, "certificado", input.certificado()));
        }
        return get(code);
    }

    @Transactional
    public void delete(String code) {
        Assembled current = find(code);
        if (current.publication().publishedAt() != null) {
            throw ApiException.conflict("Vehículo publicado",
                    "Este vehículo ya se publicó: pausa su publicación en lugar de eliminarlo.");
        }
        List<String> keys = new ArrayList<>();
        for (PhotoRecord photo : current.photos()) {
            keys.add(photo.key());
            keys.add(photo.thumbnailKey());
        }
        try {
            publications.delete(current.publication().id());
            vehicles.delete(current.vehicle().id());
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("Vehículo en uso",
                    "Este vehículo tiene registros asociados y no se puede eliminar. Pausa su publicación.");
        }
        cleanup.deleteAfterCommit(keys);
        VehicleRecord vehicle = current.vehicle();
        audit.record("vehiculo.eliminado", "vehiculo", vehicle.id(),
                AuditDetail.of("codigo", code, "marca", vehicle.brand(), "modelo", vehicle.model(), "anio", vehicle.year()),
                null);
    }

    @Transactional
    public InventoryVehicle publish(String code) {
        Assembled current = find(code);
        if ("publicado".equals(current.publication().state())) {
            return get(code);
        }
        Optional<BcvRate> rate = rates.currentEuroRate();
        List<String> missing = missingToPublish(current, rate.isPresent());
        if (!missing.isEmpty()) {
            throw ApiException.conflict("No se puede publicar", String.join(" ", missing));
        }
        doPublish(current, rate.orElseThrow());
        return get(code);
    }

    /** Publica los borradores que cumplen las reglas; los demás quedan con sus motivos. */
    @Transactional
    public BatchResult publishReady() {
        Optional<BcvRate> rate = rates.currentEuroRate();
        List<String> published = new ArrayList<>();
        List<BatchResult.Pending> pending = new ArrayList<>();
        for (Assembled current : queries.all()) {
            if (!"borrador".equals(current.publication().state())) {
                continue;
            }
            List<String> missing = missingToPublish(current, rate.isPresent());
            if (missing.isEmpty()) {
                doPublish(current, rate.orElseThrow());
                published.add(current.vehicle().code());
            } else {
                pending.add(new BatchResult.Pending(current.vehicle().code(), missing));
            }
        }
        return new BatchResult(published, pending);
    }

    @Transactional
    public InventoryVehicle pause(String code) {
        Assembled current = find(code);
        if (!"publicado".equals(current.publication().state())) {
            throw ApiException.conflict("No está publicado", "Solo se puede pausar un vehículo publicado.");
        }
        publications.pause(current.publication().id());
        audit.record("publicacion.pausada", "vehiculo", current.vehicle().id(), null, AuditDetail.of("codigo", code));
        return get(code);
    }

    @Transactional
    public InventoryVehicle changeAvailability(String code, String target, String reason) {
        Availability to = Availability.fromCode(target)
                .orElseThrow(() -> ApiException.badRequest("Disponibilidad no válida",
                        "La disponibilidad debe ser disponible, cita_agendada o vendido."));
        Assembled current = find(code);
        Availability from = current.availability();
        String cleanReason = blankToNull(reason);
        Optional<String> error = Availability.transitionError(from, to, CurrentUser.hasAuthority(MANAGE), cleanReason);
        if (error.isPresent()) {
            throw ApiException.conflict("Cambio no permitido", error.get());
        }
        if (from != to) {
            vehicles.setState(current.vehicle().id(), to.dbState());
            audit.record("vehiculo.disponibilidad_cambiada", "vehiculo", current.vehicle().id(),
                    AuditDetail.of("disponibilidad", from.code()),
                    AuditDetail.of("codigo", code, "disponibilidad", to.code(), "motivo", cleanReason));
        }
        return get(code);
    }

    private void doPublish(Assembled current, BcvRate rate) {
        Instant now = clock.instant();
        publications.publish(current.publication().id(), rate.vesPerUnit(), rate.date(), now);
        audit.record("publicacion.publicada", "vehiculo", current.vehicle().id(), null,
                AuditDetail.of("codigo", current.vehicle().code(),
                        "precio", current.publication().price().toPlainString(), "moneda", "EUR",
                        "tasa", rate.vesPerUnit().toPlainString(), "fechaTasa", rate.date().toString()));
    }

    private static List<String> missingToPublish(Assembled current, boolean rateAvailable) {
        return PublicationRules.missing(new PublicationRules.Candidate(current.vehicle().demo(), current.photos().size(),
                current.availability() == Availability.SOLD, rateAvailable));
    }

    private Assembled find(String code) {
        if (!InventoryCode.isValid(code)) {
            throw ApiException.notFound("El vehículo no existe.");
        }
        return queries.byCode(code).orElseThrow(() -> ApiException.notFound("El vehículo no existe."));
    }

    private static <T> T guardUnique(Supplier<T> action) {
        try {
            return action.get();
        } catch (DuplicateKeyException e) {
            String message = String.valueOf(e.getMostSpecificCause().getMessage());
            if (message.contains("placa")) {
                throw ApiException.conflict("Placa duplicada", "Ya existe un vehículo con esa placa.");
            }
            if (message.contains("vin")) {
                throw ApiException.conflict("VIN duplicado", "Ya existe un vehículo con ese VIN.");
            }
            throw ApiException.conflict("Vehículo duplicado", "Ya existe un vehículo con esos datos.");
        }
    }

    private static List<VehicleInput.Imperfection> normalized(List<VehicleInput.Imperfection> imperfections) {
        if (imperfections == null) {
            return List.of();
        }
        return imperfections.stream()
                .map(i -> new VehicleInput.Imperfection(i.zona(), i.tipo().trim(), blankToNull(i.descripcion()),
                        i.severidad(), blankToNull(i.ubicacion()), scale(i.x()), scale(i.y())))
                .toList();
    }

    private static boolean sameImperfections(List<ImperfectionRecord> stored, List<VehicleInput.Imperfection> incoming) {
        if (stored.size() != incoming.size()) {
            return false;
        }
        for (int i = 0; i < stored.size(); i++) {
            ImperfectionRecord s = stored.get(i);
            VehicleInput.Imperfection n = incoming.get(i);
            if (!Objects.equals(s.zone(), n.zona()) || !Objects.equals(s.type(), n.tipo())
                    || !Objects.equals(s.description(), n.descripcion()) || !Objects.equals(s.severity(), n.severidad())
                    || !Objects.equals(s.location(), n.ubicacion()) || scale(s.x()).compareTo(n.x()) != 0
                    || scale(s.y()).compareTo(n.y()) != 0) {
                return false;
            }
        }
        return true;
    }

    private static String inspectionState(boolean certified) {
        return certified ? "certificada" : "en_progreso";
    }

    private static String inspectionResult(boolean certified, List<VehicleInput.Imperfection> imperfections) {
        if (!certified) {
            return null;
        }
        return imperfections.isEmpty() ? "apto" : "con_observaciones";
    }

    private Instant finishedAt(boolean certified) {
        return certified ? clock.instant() : null;
    }

    private static void diff(Map<String, Object> before, Map<String, Object> after, String key, Object old, Object now) {
        if (!Objects.equals(old, now)) {
            before.put(key, old);
            after.put(key, now);
        }
    }

    private static String plain(BigDecimal value) {
        return value == null ? null : value.stripTrailingZeros().toPlainString();
    }

    private static BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    static String blankToNull(String value) {
        return VehicleFields.blankToNull(value);
    }
}
