package com.wamma.crm;

import com.wamma.crm.domain.AppointmentSlot;
import com.wamma.crm.domain.CedulaNormalizer;
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

    /** Lo que el visitante recibe al agendar (contrato con la web; nombres en español como el resto de la API). */
    public record ScheduleResult(UUID id, LocalDate diaPreferencia, String franjaHoraria, String estado) {
    }

    /** Lo que el asesor recibe al confirmar, con el día y la franja que quedaron acordados. */
    public record ConfirmResult(boolean ok, String nombre, String telefono, String correo,
                                LocalDate dia, String franja) {
    }

    private final AppointmentRepository appointments;
    private final OpportunityRepository opportunities;
    private final OpportunityService opportunityService;
    private final StageHistoryRepository stageHistories;
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
                              OpportunityService opportunityService, StageHistoryRepository stageHistories,
                              IdentityResolver identityResolver, PersonRepository persons, VehicleRepository vehicles,
                              PublicationRepository publications, ExchangeRateService rates,
                              CaptureRateLimiter rateLimiter, BlindIndex blindIndex, AuditLog audit, Clock clock) {
        this.appointments = appointments;
        this.opportunities = opportunities;
        this.opportunityService = opportunityService;
        this.stageHistories = stageHistories;
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

    /**
     * Agenda pública de una cita (spec 010 §8.5, plan E3): resuelve o crea a la persona por teléfono, abre la
     * oportunidad en «nuevo», deja la cita «pendiente» y reserva el vehículo 24 horas.
     * <p>
     * La reserva es una sola sentencia condicionada al estado: si dos clientes piden el mismo vehículo a la vez,
     * uno lo reserva y el otro recibe 409. Un reenvío de la misma persona sobre el mismo vehículo devuelve su cita
     * en vez de duplicarla.
     */
    @Transactional
    public ScheduleResult schedule(String fullName, String phone, String email, LocalDate preferredDate,
                                   String slot, String paymentMethod, UUID vehicleId, String vehicleCode, String clientIp) {
        Instant now = clock.instant();
        LocalDate today = rates.today();

        if (preferredDate == null || preferredDate.isBefore(today)) {
            throw ApiException.unprocessable("Fecha inválida", "La fecha preferida debe ser hoy o una fecha futura.");
        }
        AppointmentSlot preferredSlot = AppointmentSlot.parse(slot)
                .orElseThrow(() -> ApiException.unprocessable("Franja inválida", "La franja horaria debe ser mañana o tarde."));

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
                    .orElseThrow(() -> ApiException.notFound("Vehículo no encontrado", "No existe el vehículo indicado."));
        }
        if (resolvedVehicleId == null) {
            throw ApiException.badRequest("Vehículo no especificado", "Debes indicar el vehículo mediante ID o código.");
        }
        final UUID targetVehicleId = resolvedVehicleId;
        vehicles.findById(targetVehicleId)
                .orElseThrow(() -> ApiException.notFound("Vehículo no encontrado", "No existe el vehículo indicado."));

        // Lo que el visitante vio: el precio publicado, con la tasa que la publicación fijó al publicarse.
        PublicationRepository.PublicationRecord publication = publications.findByVehicle(targetVehicleId)
                .filter(p -> "publicado".equals(p.state()))
                .orElseThrow(() -> ApiException.conflict("Vehículo no disponible",
                        "Este vehículo no está publicado en el catálogo."));

        var resolution = identityResolver.resolve(fullName, normalizedPhone, null, email, "catalogo_web", null);
        PersonRecord person = resolution.person();

        // Un reenvío de la misma persona sobre el mismo vehículo no duplica nada (plan E3).
        Optional<OpportunityRecord> existingOpp = opportunities.findLatestOpenByPersonAndVehicle(person.id(), targetVehicleId);
        if (existingOpp.isPresent()) {
            Optional<AppointmentRecord> existingAppointment = appointments.findLatestByOpportunityId(existingOpp.get().id())
                    .filter(a -> "pendiente".equals(a.status()) || "confirmada".equals(a.status()));
            if (existingAppointment.isPresent()) {
                AppointmentRecord a = existingAppointment.get();
                return new ScheduleResult(a.id(), a.preferredDate(), a.slot(), a.status());
            }
        }

        if (!vehicles.reserveIfOnDisplay(targetVehicleId)) {
            throw ApiException.conflict("Vehículo no disponible",
                    "Este vehículo ya tiene una cita agendada o no está disponible en catálogo.");
        }

        UUID oppId;
        if (existingOpp.isPresent()) {
            oppId = existingOpp.get().id();
        } else {
            BigDecimal vesRate = publication.rate();
            LocalDate rateDate = publication.rateDate();
            if (vesRate == null || rateDate == null) {
                BcvRate current = rates.currentEuroRate().orElseThrow(() -> ApiException.conflict(
                        "Tasa BCV no registrada", "No hay una tasa BCV registrada: no se puede agendar ahora."));
                vesRate = current.vesPerUnit();
                rateDate = current.date();
            }
            String modality = paymentMethod != null && paymentMethod.equalsIgnoreCase("contado")
                    ? "contado"
                    : "financiamiento";
            oppId = opportunities.insert(person.id(), targetVehicleId, modality, publication.price(),
                    publication.currency() != null ? publication.currency() : "EUR", vesRate, rateDate, null);
            stageHistories.insert(oppId, null, "nuevo", "Captura desde el catálogo público.", null);
        }

        Instant reservationExpiresAt = now.plus(Duration.ofHours(24));
        UUID appointmentId = appointments.insert(person.id(), oppId, targetVehicleId, null, preferredDate,
                preferredSlot.code(), reservationExpiresAt, "Cita agendada desde catálogo web");

        audit.record("cita.agendada", "cita", appointmentId,
                Map.of("vehiculo_id", targetVehicleId.toString(), "fecha", preferredDate.toString(),
                        "franja", preferredSlot.code()));

        return new ScheduleResult(appointmentId, preferredDate, preferredSlot.code(), "pendiente");
    }

    /**
     * Segundo paso de la captura (spec 010 §8.5): llega la cédula, que consolida a la persona. Si ya existía otra
     * persona con esa cédula, las dos se fusionan en la más antigua, con copia íntegra de lo absorbido.
     */
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
        if (date != null && date.isBefore(rates.today())) {
            throw ApiException.unprocessable("Fecha inválida", "El día acordado no puede ser anterior a hoy.");
        }
        AppointmentSlot agreedSlot = null;
        if (slot != null && !slot.isBlank()) {
            agreedSlot = AppointmentSlot.parse(slot)
                    .orElseThrow(() -> ApiException.unprocessable("Franja inválida", "La franja horaria debe ser mañana o tarde."));
        }

        PersonRecord person = persons.findById(app.personId())
                .orElseThrow(() -> ApiException.notFound("Persona no encontrada", "No existe la persona de la cita."));
        if (person.cedula() != null && !person.cedula().equals(normalizedCedula)) {
            // Fusionar dos cédulas distintas mezclaría a dos personas reales.
            throw ApiException.unprocessable("Cédula distinta",
                    "La persona de esta cita ya tiene registrada otra cédula. Verifícala con el cliente.");
        }

        String cedulaIdx = blindIndex.of(normalizedCedula, PersonRepository.CONTEXT_CEDULA);
        Optional<PersonRecord> existingWithCedula = persons.findByBlindIndexCedula(cedulaIdx);

        UUID effectivePersonId = person.id();
        if (existingWithCedula.isPresent() && !existingWithCedula.get().id().equals(person.id())) {
            // Fusión de personas: sobrevive la más antigua.
            PersonRecord other = existingWithCedula.get();
            PersonRecord survivor = other.createdAt().isBefore(person.createdAt()) ? other : person;
            PersonRecord absorbed = survivor.id().equals(other.id()) ? person : other;

            persons.absorbPerson(survivor.id(), absorbed.id(), CurrentUser.id().orElse(null));

            audit.record("persona.fusionada", "persona", survivor.id(),
                    Map.of("absorbida_id", absorbed.id().toString(), "criterio", "cedula"));

            effectivePersonId = survivor.id();
        } else if (person.cedula() == null) {
            persons.updateCedula(person.id(), normalizedCedula);
            persons.updateResolutionCriterion(person.id(), "cedula");
        }

        if (email != null && !email.isBlank()) {
            persons.updateEmail(effectivePersonId, email.trim().toLowerCase());
        }

        LocalDate effectiveDate = date != null ? date : app.preferredDate();
        String effectiveSlot = agreedSlot != null ? agreedSlot.code() : app.slot();

        if (date != null || agreedSlot != null) {
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
        if (otherOpen == 0 && !"cerrado_ganado".equals(opp.stage())) {
            vehicles.setState(app.vehicleId(), "exhibicion");
        }

        audit.record("cita.descartada", "cita", appointmentId, Map.of("motivo", lossReason));
    }

    /** «Asistió a la cita»: la oportunidad pasa a «visitó la sede». Solo de una cita confirmada. */
    @Transactional
    public void attend(UUID appointmentId) {
        AppointmentRecord app = appointments.findById(appointmentId)
                .orElseThrow(() -> ApiException.notFound("Cita no encontrada", "No existe la cita " + appointmentId));
        if (!"confirmada".equals(app.status())) {
            throw ApiException.unprocessable("Estado inválido",
                    "Solo se puede registrar la asistencia de una cita confirmada.");
        }

        OpportunityRecord opp = opportunities.findById(app.opportunityId()).orElseThrow();
        if ("cerrado_ganado".equals(opp.stage()) || "cerrado_perdido".equals(opp.stage())) {
            throw ApiException.unprocessable("Oportunidad cerrada", "La oportunidad de esta cita ya está cerrada.");
        }
        if ("cita_confirmada".equals(opp.stage()) || "nuevo".equals(opp.stage()) || "contactado".equals(opp.stage())) {
            opportunityService.changeStage(opp.id(), "visito", null, null,
                    "Cliente asistió a la cita", opp.version());
        }
        // Si ya está en «visitó» o más adelante, registrarlo otra vez no cambia nada.

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
