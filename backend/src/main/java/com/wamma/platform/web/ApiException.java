package com.wamma.platform.web;

import org.springframework.http.HttpStatus;

/**
 * Error de negocio con estado HTTP, título y detalle en español, listos para mostrar.
 * {@link GlobalExceptionHandler} lo convierte en Problem Details.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String title;

    public ApiException(HttpStatus status, String title, String detail) {
        super(detail);
        this.status = status;
        this.title = title;
    }

    public static ApiException badRequest(String title, String detail) {
        return new ApiException(HttpStatus.BAD_REQUEST, title, detail);
    }

    public static ApiException notFound(String detail) {
        return new ApiException(HttpStatus.NOT_FOUND, "No encontrado", detail);
    }

    public static ApiException conflict(String title, String detail) {
        return new ApiException(HttpStatus.CONFLICT, title, detail);
    }

    public HttpStatus status() {
        return status;
    }

    public String title() {
        return title;
    }
}
