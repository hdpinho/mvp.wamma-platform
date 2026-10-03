package com.wamma.crm;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * El límite de citas por IP usa la IP que resuelve el servidor (la misma de la bitácora y del
 * ingreso), no la que el cliente declara en X-Forwarded-For: si no, cada petición con una
 * cabecera distinta estrenaría un cupo nuevo.
 */
class PublicAppointmentControllerTest {

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void theRateLimitKeyIsNotTakenFromAClientHeader() {
        AppointmentService service = mock(AppointmentService.class);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/v1/citas");
        request.setRemoteAddr("10.0.0.9");
        request.addHeader("X-Forwarded-For", "203.0.113.7, 10.0.0.9");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        new PublicAppointmentController(service).createAppointment(
                new PublicAppointmentController.CreateAppointmentRequest("Ana Prueba", "+584141234567", null,
                        LocalDate.now().plusDays(1), "manana", "contado", null, "WAM-00001"));

        verify(service).schedule(any(), any(), any(), any(), any(), any(), any(), any(), eq("10.0.0.9"));
    }
}
