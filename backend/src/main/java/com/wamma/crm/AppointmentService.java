package com.wamma.crm;

import com.wamma.crm.domain.CedulaNormalizer;
import com.wamma.crm.domain.LossReasonCatalog;
import com.wamma.crm.domain.PhoneNormalizer;
import com.wamma.exchangerate.BcvRate;
import com.wamma.exchangerate.ExchangeRateService;
import com.wamma.inventory.PublicationRepository;
import com.wamma.inventory.VehicleRepository;
import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.auth.CurrentUser;
import com.wamma.platform.crypto.BlindIndex;
import com.wamma.platform.web.ApiException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class AppointmentService {

    public record ScheduleResult(UUID id, LocalDate preferredDate, String slot, String status) {
    }

    public record ConfirmResult(boolean ok, String clientName, String clientPhone, String clientEmail,
                                 LocalDate date, String slot) {
    }

    private final AppointmentRepository appointments;
    private final OpportunityRepository opportunities;
    private final OpportunityService opportunityService;
    private final IdentityResolver identityResolver;
    private final PersonRepository persons;
    private final VehicleRepository vehicles;
    private final PublicationRepository publications;
    private final ExchangeRateService rates;
    private final CaptureRateLimiter rateLimiter;
    private final BlindIndex blindIndex;
    private final AuditLog audit;
    private final Clock clock;

    public AppointmentService(AppointmentRepository appointments, OpportunityRepository opportunities,
                              OpportunityService opportunityService, IdentityResolver identityResolver,
                              PersonRepository persons, VehicleRepository vehicles,
                              PublicationRepository publications, ExchangeRateService rates,
                              CaptureRateLimiter rateLimiter, BlindIndex blindIndex,
                              AuditLog audit, Clock clock) {
        this.appointments = appointments;
        this.opportunities = opportunities;
        this.opportunityService = opportunityService;
        this.identityResolver = identityResolver;
        this.persons = persons;
        this.vehicles = vehicles;
        this.publications = publications;
        this.rates = rates;
        this.rateLimiter = rateLimiter;
        this.blindIndex = blindIndex;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public ScheduleResult schedule(String fullName, String phone, String email, LocalDate preferredDate,
                                   String slot, String paymentMethod, UUID vehicleId, String clientIp) {
        return schedule(fullName, phone, email, preferredDate, slot, paymentMethod, vehicleId, null, clientIp);
    }

    @Transactional
    public ScheduleResult schedule(String fullName, String phone, String email, LocalDate preferredDate,
                                   String slot, String paymentMethod, UUID vehicleId, String vehicleCode, String clientIp) {
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, clock.getZone());

        if (preferredDate == null || preferredDate.isBefore(today)) {
            throw ApiException.unprocessable("Fecha inválida", "La fecha preferida debe ser hoy o una fecha futura.");
        }
        if (slot == null || (!slot.equalsIgnoreCase("manana") && !slot.equalsIgnoreCase("tarde"))) {
            throw ApiException.unprocessable("Franja inválida", "La franja horaria debe ser manana o tarde.");
        }

        String normalizedPhone;
        try {
            normalizedPhone = PhoneNormalizer.mobileE164(phone);
        } catch (IllegalArgumentException e) {
            throw ApiException.unprocessable("Teléfono inválido", e.getMessage());
        }

        if (clientIp != null && !rateLimiter.tryAcquire(clientIp, normalizedPhone, now)) {
            throw ApiException.tooManyRequests("Límite de solicitudes",
                    "Has alcanzado el límite de solicitudes de citas permitidas por hoy.");
        }

        UUID resolvedVehicleId = vehicleId;
        if (resolvedVehicleId == null && vehicleCode != null && !vehicleCode.isBlank()) {
            resolvedVehicleId = vehicles.findByCode(vehicleCode.trim())
                    .map(VehicleRepository.VehicleRecord::id)
                    .orElse(null);
        }

        if (resolvedVehicleId == null) {
            throw ApiException.badRequest("Vehículo no especificado", "Debes indicar el vehículo mediante ID o código.");
        }
        vehicleId = resolvedVehicleId;

        // Reserva atómica del vehículo en exhibición
        final UUID targetVehicleId = vehicleId;
        var vehicle = vehicles.findAll().stream().filter(v -> v.id().equals(targetVehicleId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Vehículo no encontrado", "No existe el vehículo indicado."));

        if (!"exhibicion".equals(vehicle.state())) {
            throw ApiException.conflict("Vehículo no disponible",
                    "Este vehículo ya tiene una cita agendada o no está disponible en catálogo.");
        }

        vehicles.setState(vehicleId, "reservado");

        // Resolver la persona por teléfono
        var resolution = identityResolver.resolve(fullName, normalizedPhone, null, email, "catalogo_web", null);
        PersonRecord person = resolution.person();

        // Oportunidad nueva o reutilizada
        Optional<OpportunityRecord> existingOpp = opportunities.findLatestOpenByPersonAndVehicle(person.id(), vehicleId);
        UUID oppId;
        if (existingOpp.isPresent()) {
            oppId = existingOpp.get().id();
        } else {
            BigDecimal price = publications.findByVehicle(vehicleId)
                    .map(PublicationRepository.PublicationRecord::price)
                    .orElse(BigDecimal.valueOf(10000));
            var maybeRate = rates.currentEuroRate();
            BigDecimal vesRate = maybeRate.map(BcvRate::vesPerUnit).orElse(BigDecimal.valueOf(45));
            LocalDate rateDate = maybeRate.map(BcvRate::date).orElse(today);

            String modality = paymentMethod != null && paymentMethod.equalsIgnoreCase("contado")
                    ? "contado"
                    : "financiamiento";
            oppId = opportunities.insert(person.id(), vehicleId, modality, price, "EUR", vesRate, rateDate, null);
        }

        Instant reservationExpiresAt = now.plus(Duration.ofHours(24));
        UUID appointmentId = appointments.insert(person.id(), oppId, vehicleId, null, preferredDate,
                slot.toLowerCase(), reservationExpiresAt, "Cita agendada desde catálogo web");

        audit.record("cita.agendada", "cita", appointmentId,
                Map.of("vehiculo_id", vehicleId.toString(), "fecha", preferredDate.toString(), "franja", slot.toLowerCase()));

        return new ScheduleResult(appointmentId, preferredDate, slot.toLowerCase(), "pendiente");
    }

    @Transactional
    public ConfirmResult confirm(UUID appointmentId, String rawCedula, String email, LocalDate date, String slot) {
        AppointmentRecord app = appointments.findById(appointmentId)
                .orElseThrow(() -> ApiException.notFound("Cita no encontrada", "No existe la cita " + appointmentId));

        if (!"pendiente".equals(app.status())) {
            throw ApiException.unprocessable("Estado inválido", "Solo se pueden confirmar citas pendientes.");
        }

        String normalizedCedula;
        try {
            normalizedCedula = CedulaNormalizer.canonical(rawCedula);
        } catch (IllegalArgumentException e) {
            throw ApiException.unprocessable("Cédula inválida", e.getMessage());
        }

        PersonRecord person = persons.findById(app.personId())
                .orElseThrow(() -> ApiException.notFound("Persona no encontrada", "No existe la persona de la cita."));

        String cedulaIdx = blindIndex.of(normalizedCedula, PersonRepository.CONTEXT_CEDULA);
        Optional<PersonRecord> existingWithCedula = persons.findByBlindIndexCedula(cedulaIdx);

        UUID effectivePersonId = person.id();
        if (existingWithCedula.isPresent() && !existingWithCedula.get().id().equals(person.id())) {
            // Fusión de personas: sobrevive la más antigua
            PersonRecord other = existingWithCedula.get();
            PersonRecord survivor = other.createdAt().isBefore(person.createdAt()) ? other : person;
            PersonRecord absorbed = survivor.id().equals(other.id()) ? person : other;

            UUID actorId = CurrentUser.id().orElse(null);
            String snapshotJson = "{\"id\":\"" + absorbed.id() + "\",\"nombre\":\"" + absorbed.fullName() + "\"}";

            persons.absorbPerson(survivor.id(), absorbed.id(), snapshotJson,
                    new UUID[]{app.opportunityId()}, new UUID[]{appointmentId}, new UUID[0], actorId);

            audit.record("persona.fusionada", "persona", survivor.id(),
                    Map.of("absorbida_id", absorbed.id().toString(), "criterio", "cedula"));

            effectivePersonId = survivor.id();
            person = persons.findById(effectivePersonId).orElse(survivor);
        } else {
            if (person.cedula() == null) {
                persons.updateCedula(person.id(), normalizedCedula);
            }
        }

        if (email != null && !email.isBlank()) {
            persons.updateEmail(effectivePersonId, email.trim().toLowerCase());
        }

        LocalDate effectiveDate = date != null ? date : app.preferredDate();
        String effectiveSlot = slot != null ? slot.toLowerCase() : app.slot();

        if (date != null || slot != null) {
            appointments.updateSchedule(appointmentId, effectiveDate, effectiveSlot);
        }

        appointments.updateStatus(appointmentId, "confirmada");
        appointments.clearReservation(appointmentId);

        OpportunityRecord opp = opportunities.findById(app.opportunityId()).orElseThrow();
        if ("nuevo".equals(opp.stage()) || "contactado".equals(opp.stage())) {
            opportunityService.changeStage(opp.id(), "cita_confirmada", null, null,
                    "Cita confirmada por asesor", opp.version());
        }

        audit.record("cita.confirmada", "cita", appointmentId,
                Map.of("fecha", effectiveDate.toString(), "franja", effectiveSlot));

        PersonRecord finalPerson = persons.findById(effectivePersonId).orElse(person);
        return new ConfirmResult(true, finalPerson.fullName(), finalPerson.primaryPhone(),
                finalPerson.email(), effectiveDate, effectiveSlot);
    }

    @Transactional
    public void discard(UUID appointmentId, String lossReason, String lossDetail) {
        AppointmentRecord app = appointments.findById(appointmentId)
                .orElseThrow(() -> ApiException.notFound("Cita no encontrada", "No existe la cita " + appointmentId));

        if ("descartada".equals(app.status())) {
            return;
        }

        if (lossReason == null || lossReason.isBlank()) {
            throw ApiException.unprocessable("Motivo requerido", "Indica el motivo de descarte.");
        }

        appointments.updateStatus(appointmentId, "descartada");
        appointments.clearReservation(appointmentId);

        OpportunityRecord opp = opportunities.findById(app.opportunityId()).orElseThrow();
        if (!"cerrado_ganado".equals(opp.stage()) && !"cerrado_perdido".equals(opp.stage())) {
            opportunityService.changeStage(opp.id(), "cerrado_perdido", lossReason, lossDetail,
                    "Cita descartada", opp.version());
        }

        // Si nadie más reclama el vehículo, liberarlo
        long otherOpen = opportunities.countOpenByVehicleIdExcluding(app.vehicleId(), app.opportunityId());
        if (otherOpen == 0) {
            vehicles.setState(app.vehicleId(), "exhibicion");
        }

        audit.record("cita.descartada", "cita", appointmentId, Map.of("motivo", lossReason));
    }

    @Transactional
    public void attend(UUID appointmentId) {
        AppointmentRecord app = appointments.findById(appointmentId)
                .orElseThrow(() -> ApiException.notFound("Cita no encontrada", "No existe la cita " + appointmentId));

        OpportunityRecord opp = opportunities.findById(app.opportunityId()).orElseThrow();
        if (!"cerrado_ganado".equals(opp.stage()) && !"cerrado_perdido".equals(opp.stage())) {
            opportunityService.changeStage(opp.id(), "visito", null, null,
                    "Cliente asistió a la cita", opp.version());
        }

        audit.record("cita.asistencia", "cita", appointmentId, Map.of("oportunidad_id", opp.id().toString()));
    }

    @Scheduled(fixedRate = 900_000) // Cada 15 minutos
    @Transactional
    public void expireReservations() {
        Instant now = clock.instant();
        List<AppointmentRecord> expired = appointments.findExpiredReservations(now);
        for (AppointmentRecord app : expired) {
            appointments.clearReservation(app.id());
            long otherOpen = opportunities.countOpenByVehicleIdExcluding(app.vehicleId(), app.opportunityId());
            if (otherOpen == 0) {
                vehicles.setState(app.vehicleId(), "exhibicion");
            }
            audit.record("cita.reserva_vencida", "cita", app.id(),
                    Map.of("vehiculo_id", app.vehicleId().toString()));
        }
    }
}
