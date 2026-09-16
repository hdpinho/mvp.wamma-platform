package com.wamma.platform.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Datos de la petición en curso para la bitácora y el límite por IP. Tras Render, la IP
 * del cliente la resuelve {@code server.forward-headers-strategy: framework}.
 */
public final class RequestInfo {

    private RequestInfo() {
    }

    public static String clientIp() {
        HttpServletRequest request = current();
        return request == null ? null : truncate(request.getRemoteAddr(), 45);
    }

    public static String userAgent() {
        HttpServletRequest request = current();
        return request == null ? null : truncate(request.getHeader("User-Agent"), 300);
    }

    public static String method() {
        HttpServletRequest request = current();
        return request == null ? null : request.getMethod();
    }

    public static String path() {
        HttpServletRequest request = current();
        return request == null ? null : truncate(request.getRequestURI(), 300);
    }

    private static HttpServletRequest current() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
                ? attributes.getRequest()
                : null;
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
