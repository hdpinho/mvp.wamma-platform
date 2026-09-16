package com.wamma.inventory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * Datos de un vehículo que envía el backoffice al darlo de alta o editarlo (spec 005 RF-005.7).
 * Los valores de las listas son los códigos de la base; el frontend los traduce a las
 * etiquetas de la maqueta.
 *
 * @param disponibilidad solo en el alta; después se cambia con su propio endpoint
 * @param actualizadoEn  solo en la edición: la marca de tiempo que se leyó, para detectar
 *                       cambios simultáneos
 */
public record VehicleInput(
        @NotBlank(message = "Indica el VIN o serial")
        @Size(max = 17, message = "El VIN tiene a lo sumo 17 caracteres") String vin,
        @Size(max = 10, message = "La placa tiene a lo sumo 10 caracteres") String placa,
        @NotBlank(message = "Indica la marca") @Size(max = 50, message = "La marca tiene a lo sumo 50 caracteres") String marca,
        @NotBlank(message = "Indica el modelo") @Size(max = 50, message = "El modelo tiene a lo sumo 50 caracteres") String modelo,
        @Size(max = 50, message = "La versión tiene a lo sumo 50 caracteres") String version,
        @NotNull(message = "Indica el año") @Min(value = 1900, message = "El año no es válido") Integer anio,
        @NotNull(message = "Indica el kilometraje") @Min(value = 0, message = "El kilometraje no puede ser negativo") Integer kilometraje,
        @NotNull(message = "Indica la transmisión")
        @Pattern(regexp = "automatica|manual|secuencial", message = "Transmisión no válida") String transmision,
        @NotNull(message = "Indica el combustible")
        @Pattern(regexp = "gasolina|diesel|hibrido|electrico|gas", message = "Combustible no válido") String combustible,
        @NotNull(message = "Indica la carrocería")
        @Pattern(regexp = "sedan|hatchback|suv|camioneta|pick_up|coupe", message = "Carrocería no válida") String carroceria,
        @NotNull(message = "Indica los puestos") @Min(value = 1, message = "Al menos 1 puesto")
        @Max(value = 99, message = "Puestos no válidos") Integer puestos,
        @NotNull(message = "Indica la tracción") @Pattern(regexp = "4x2|4x4", message = "Tracción no válida") String traccion,
        @NotBlank(message = "Indica el color") @Size(max = 40, message = "El color tiene a lo sumo 40 caracteres") String color,
        @NotNull(message = "Indica el precio")
        @DecimalMin(value = "0", inclusive = false, message = "El precio debe ser mayor que cero")
        @Digits(integer = 16, fraction = 2, message = "El precio admite hasta dos decimales") BigDecimal precio,
        @Pattern(regexp = "recien_ingresado|dificil_de_conseguir|listo_para_entrega", message = "Etiqueta no válida") String etiqueta,
        boolean certificado,
        @Size(max = 60, message = "A lo sumo 60 imperfecciones") List<@Valid Imperfection> imperfecciones,
        @Valid Acquisition adquisicion,
        @Pattern(regexp = "disponible|cita_agendada|vendido", message = "Disponibilidad no válida") String disponibilidad,
        Instant actualizadoEn) {

    /** Hallazgo cosmético sobre el diagrama del vehículo (plan 005 E7). */
    public record Imperfection(
            @NotNull(message = "Indica la zona") @Pattern(regexp = "exterior|interior", message = "La zona debe ser exterior o interior") String zona,
            @NotBlank(message = "Indica el tipo de imperfección") @Size(max = 150, message = "El tipo tiene a lo sumo 150 caracteres") String tipo,
            @Size(max = 500, message = "La descripción tiene a lo sumo 500 caracteres") String descripcion,
            @NotNull(message = "Indica la severidad") @Pattern(regexp = "leve|moderada", message = "La severidad debe ser leve o moderada") String severidad,
            @Size(max = 80, message = "La ubicación tiene a lo sumo 80 caracteres") String ubicacion,
            @NotNull(message = "Indica la posición") @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal x,
            @NotNull(message = "Indica la posición") @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal y) {
    }

    /** Adquisición: opcional (D-12), pero completa si se indica (Principio V). */
    public record Acquisition(
            @NotNull(message = "Indica el precio de adquisición")
            @DecimalMin(value = "0", inclusive = false, message = "El precio de adquisición debe ser mayor que cero")
            @Digits(integer = 16, fraction = 2, message = "El precio admite hasta dos decimales") BigDecimal precio,
            @NotNull(message = "Indica la moneda de adquisición")
            @Pattern(regexp = "EUR|USD|VES", message = "La moneda debe ser EUR, USD o VES") String moneda,
            @NotNull(message = "Indica la tasa BCV de la adquisición")
            @DecimalMin(value = "0", inclusive = false, message = "La tasa debe ser mayor que cero")
            @Digits(integer = 10, fraction = 8, message = "La tasa admite hasta 8 decimales") BigDecimal tasaBcv,
            @NotNull(message = "Indica la fecha de la tasa") LocalDate fecha) {
    }
}
