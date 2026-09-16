package com.wamma.platform.web;

import com.wamma.platform.audit.AccessDeniedRecorder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.TypeMismatchException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Formato único de errores de la API: Problem Details (RFC 9457) con textos en español.
 * <p>
 * Nunca expone trazas ni mensajes internos. Un error inesperado se registra en el log con
 * un código, y ese mismo código se devuelve al cliente para poder rastrearlo.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final ObjectProvider<AccessDeniedRecorder> accessDeniedRecorder;

    public GlobalExceptionHandler(ObjectProvider<AccessDeniedRecorder> accessDeniedRecorder) {
        this.accessDeniedRecorder = accessDeniedRecorder;
    }

    /** Errores de validación: un mensaje por campo, para que el formulario los marque. */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Revisa los campos marcados.");
        problem.setTitle("Datos inválidos");
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        problem.setProperty("errores", fieldErrors);
        return handleExceptionInternal(ex, problem, headers, HttpStatus.BAD_REQUEST, request);
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "El contenido de la solicitud no es válido.");
        problem.setTitle("Solicitud inválida");
        return handleExceptionInternal(ex, problem, headers, HttpStatus.BAD_REQUEST, request);
    }

    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status,
                "La foto supera los 10 MB. Redúcela o expórtala en menor calidad.");
        problem.setTitle("Archivo demasiado grande");
        return handleExceptionInternal(ex, problem, headers, status, request);
    }

    @Override
    protected ResponseEntity<Object> handleMissingServletRequestPart(
            MissingServletRequestPartException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status,
                "Adjunta el archivo en el campo «" + ex.getRequestPartName() + "».");
        problem.setTitle("Falta el archivo");
        return handleExceptionInternal(ex, problem, headers, status, request);
    }

    /** Por ejemplo, un identificador que no es un UUID en la dirección. */
    @Override
    protected ResponseEntity<Object> handleTypeMismatch(
            TypeMismatchException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, "Un valor de la solicitud no tiene el formato esperado.");
        problem.setTitle("Solicitud inválida");
        return handleExceptionInternal(ex, problem, headers, status, request);
    }

    @ExceptionHandler(ApiException.class)
    public ProblemDetail handleApi(ApiException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(ex.status(), ex.getMessage());
        problem.setTitle(ex.title());
        return problem;
    }

    /**
     * Denegación por permiso ({@code @PreAuthorize}): se registra en la bitácora (CA-001.1).
     * Sin esto, la regla genérica de abajo convertiría un 403 en un 500.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        accessDeniedRecorder.ifAvailable(AccessDeniedRecorder::record);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Tu rol no permite esta acción.");
        problem.setTitle("Acceso denegado");
        return problem;
    }

    @ExceptionHandler(AuthenticationException.class)
    public ProblemDetail handleAuthentication(AuthenticationException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Inicia sesión para continuar.");
        problem.setTitle("No autenticado");
        return problem;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
        String errorCode = UUID.randomUUID().toString();
        log.error("Error no controlado [{}]", errorCode, ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "Ocurrió un error inesperado. Si se repite, comunícalo indicando el código.");
        problem.setTitle("Error interno");
        problem.setProperty("codigo", errorCode);
        return problem;
    }
}
