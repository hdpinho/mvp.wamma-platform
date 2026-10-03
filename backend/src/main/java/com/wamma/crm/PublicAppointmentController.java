package com.wamma.crm;

import com.wamma.platform.web.RequestInfo;
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
            @RequestBody CreateAppointmentRequest request) {
        // La IP del límite es la misma de la bitácora y del ingreso: la que resuelve el servidor
        // tras el proxy. Leer X-Forwarded-For a mano dejaría al cliente elegir su propia IP.
        AppointmentService.ScheduleResult result = appointmentService.schedule(
                request.nombreApellido(),
                request.telefonoWhatsApp(),
                request.correo(),
                request.diaPreferencia(),
                request.franjaHoraria(),
                request.modalidadPago(),
                request.vehiculoId(),
                request.vehiculoCodigo(),
                RequestInfo.clientIp()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }
}
