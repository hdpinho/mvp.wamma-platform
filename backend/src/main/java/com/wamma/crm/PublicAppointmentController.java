package com.wamma.crm;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
public class PublicAppointmentController {

    public record CreateAppointmentRequest(
            String nombreApellido,
            String telefonoWhatsApp,
            String correo,
            LocalDate diaPreferencia,
            String franjaHoraria,
            String modalidadPago,
            UUID vehiculoId,
            String vehiculoCodigo
    ) {
    }

    private final AppointmentService appointmentService;

    public PublicAppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @PostMapping("/v1/citas")
    public ResponseEntity<AppointmentService.ScheduleResult> createAppointment(
            @RequestBody CreateAppointmentRequest request,
            HttpServletRequest servletRequest) {
        String clientIp = servletRequest.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = servletRequest.getRemoteAddr();
        } else if (clientIp.contains(",")) {
            clientIp = clientIp.split(",")[0].trim();
        }

        AppointmentService.ScheduleResult result = appointmentService.schedule(
                request.nombreApellido(),
                request.telefonoWhatsApp(),
                request.correo(),
                request.diaPreferencia(),
                request.franjaHoraria(),
                request.modalidadPago(),
                request.vehiculoId(),
                request.vehiculoCodigo(),
                clientIp
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }
}
