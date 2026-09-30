package com.wamma.crm;

import com.wamma.inventory.VehicleRepository;
import com.wamma.platform.auth.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
public class CrmAppointmentController {

    public record CrmAppointmentDto(
            UUID id,
            UUID personaId,
            String nombrePersona,
            String telefonoPersona,
            String correoPersona,
            UUID oportunidadId,
            UUID vehiculoId,
            String vehiculoCodigo,
            String vehiculoTitulo,
            LocalDate diaPreferencia,
            String franjaHoraria,
            String estado,
            String notas,
            java.time.Instant creadoEn
    ) {
    }

    public record ConfirmAppointmentRequest(
            String cedula,
            String correo,
            LocalDate dia,
            String franja
    ) {
    }

    public record DiscardAppointmentRequest(
            String motivo,
            String detalle
    ) {
    }

    private final AppointmentService appointmentService;
    private final AppointmentRepository appointments;
    private final PersonRepository persons;
    private final VehicleRepository vehicles;

    public CrmAppointmentController(AppointmentService appointmentService, AppointmentRepository appointments,
                                    PersonRepository persons, VehicleRepository vehicles) {
        this.appointmentService = appointmentService;
        this.appointments = appointments;
        this.persons = persons;
        this.vehicles = vehicles;
    }

    @GetMapping("/v1/crm/citas")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<List<CrmAppointmentDto>> listAppointments(
            @RequestParam(required = false) String estado) {
        boolean viewAll = CurrentUser.hasAuthority("crm.ver_todas");
        UUID advisorId = CurrentUser.id().orElse(null);

        List<AppointmentRecord> list = appointments.list(estado, advisorId, viewAll);
        Map<UUID, VehicleRepository.VehicleRecord> vehicleMap = vehicles.findAll().stream()
                .collect(Collectors.toMap(VehicleRepository.VehicleRecord::id, v -> v, (a, b) -> a));

        List<CrmAppointmentDto> dtos = new ArrayList<>();
        for (AppointmentRecord a : list) {
            PersonRecord p = persons.findById(a.personId()).orElse(null);
            VehicleRepository.VehicleRecord v = vehicleMap.get(a.vehicleId());

            String personName = p != null ? p.fullName() : "Desconocido";
            String personPhone = p != null ? p.primaryPhone() : null;
            String personEmail = p != null ? p.email() : null;
            String vehicleCode = v != null ? v.code() : null;
            String vehicleTitle = v != null ? (v.brand() + " " + v.model() + " " + v.year()) : null;

            dtos.add(new CrmAppointmentDto(
                    a.id(),
                    a.personId(),
                    personName,
                    personPhone,
                    personEmail,
                    a.opportunityId(),
                    a.vehicleId(),
                    vehicleCode,
                    vehicleTitle,
                    a.preferredDate(),
                    a.slot(),
                    a.status(),
                    a.notes(),
                    a.createdAt()
            ));
        }

        return ResponseEntity.ok(dtos);
    }

    @PostMapping("/v1/crm/citas/{id}/confirmacion")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<AppointmentService.ConfirmResult> confirmAppointment(
            @PathVariable UUID id,
            @RequestBody ConfirmAppointmentRequest request) {
        return ResponseEntity.ok(appointmentService.confirm(
                id,
                request.cedula(),
                request.correo(),
                request.dia(),
                request.franja()
        ));
    }

    @PostMapping("/v1/crm/citas/{id}/descarte")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<Void> discardAppointment(
            @PathVariable UUID id,
            @RequestBody DiscardAppointmentRequest request) {
        appointmentService.discard(id, request.motivo(), request.detalle());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/v1/crm/citas/{id}/asistencia")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<Void> attendAppointment(@PathVariable UUID id) {
        appointmentService.attend(id);
        return ResponseEntity.noContent().build();
    }
}
