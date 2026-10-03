package com.wamma.crm;

import com.wamma.crm.CrmDtos.AppointmentDto;
import com.wamma.platform.web.ApiException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
public class CrmAppointmentController {

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
    private final CrmAccess access;
    private final CrmMapper mapper;

    public CrmAppointmentController(AppointmentService appointmentService, AppointmentRepository appointments,
                                    CrmAccess access, CrmMapper mapper) {
        this.appointmentService = appointmentService;
        this.appointments = appointments;
        this.access = access;
        this.mapper = mapper;
    }

    /** Se opera una cita si se ve su oportunidad: la del asesor o una sin dueño (plan §7). */
    private void requireVisibleAppointment(UUID id) {
        AppointmentRecord app = appointments.findById(id)
                .orElseThrow(() -> ApiException.notFound("Cita no encontrada", "No existe la cita " + id));
        access.visibleOpportunity(app.opportunityId());
    }

    /** La bandeja: con {@code crm.ver_propias}, las citas de sus oportunidades y las sin dueño (D-48). */
    @GetMapping("/v1/crm/citas")
    @PreAuthorize("hasAnyAuthority('crm.ver_propias', 'crm.ver_todas')")
    public ResponseEntity<List<AppointmentDto>> listAppointments(
            @RequestParam(required = false) String estado) {
        return ResponseEntity.ok(appointments.listViews(estado, access.advisorScope()).stream()
                .map(mapper::appointment)
                .toList());
    }

    @PostMapping("/v1/crm/citas/{id}/confirmacion")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<AppointmentService.ConfirmResult> confirmAppointment(
            @PathVariable UUID id,
            @RequestBody ConfirmAppointmentRequest request) {
        requireVisibleAppointment(id);
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
        requireVisibleAppointment(id);
        appointmentService.discard(id, request.motivo(), request.detalle());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/v1/crm/citas/{id}/asistencia")
    @PreAuthorize("hasAuthority('crm.operar')")
    public ResponseEntity<Void> attendAppointment(@PathVariable UUID id) {
        requireVisibleAppointment(id);
        appointmentService.attend(id);
        return ResponseEntity.noContent().build();
    }
}
