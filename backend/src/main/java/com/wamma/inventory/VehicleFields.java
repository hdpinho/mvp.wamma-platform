package com.wamma.inventory;

import com.wamma.platform.web.ApiException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Locale;

/** Datos físicos de un vehículo ya normalizados, listos para la base. */
record VehicleFields(String vin, String plate, String brand, String model, String version, int year, String color,
                     int mileage, String bodyType, String transmission, String fuel, String traction, int seats,
                     BigDecimal acquisitionPrice, String acquisitionCurrency, BigDecimal acquisitionRate,
                     LocalDate acquisitionRateDate) {

    static VehicleFields from(VehicleInput input, LocalDate today) {
        String vin = input.vin().trim().toUpperCase(Locale.ROOT);
        if (!vin.matches("[A-Z0-9]{1,17}")) {
            throw ApiException.badRequest("VIN no válido", "El VIN o serial solo admite letras y números, hasta 17.");
        }
        int maxYear = today.getYear() + 1;
        if (input.anio() > maxYear) {
            throw ApiException.badRequest("Año no válido", "El año no puede ser posterior a " + maxYear + ".");
        }
        VehicleInput.Acquisition acquisition = input.adquisicion();
        if (acquisition != null && acquisition.fecha().isAfter(today)) {
            throw ApiException.badRequest("Fecha no válida", "La fecha de la tasa de adquisición no puede ser futura.");
        }
        String plate = blankToNull(input.placa());
        return new VehicleFields(
                vin,
                plate == null ? null : plate.toUpperCase(Locale.ROOT),
                input.marca().trim(),
                input.modelo().trim(),
                blankToNull(input.version()),
                input.anio(),
                input.color().trim(),
                input.kilometraje(),
                input.carroceria(),
                input.transmision(),
                input.combustible(),
                input.traccion(),
                input.puestos(),
                acquisition == null ? null : acquisition.precio(),
                acquisition == null ? null : acquisition.moneda(),
                acquisition == null ? null : acquisition.tasaBcv(),
                acquisition == null ? null : acquisition.fecha());
    }

    /** Título de la publicación: marca, modelo, versión y año. */
    String title() {
        String title = String.join(" ", brand, model, version == null ? "" : version, String.valueOf(year))
                .replaceAll("\\s+", " ").trim();
        return title.length() > 150 ? title.substring(0, 150) : title;
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
