package com.wamma.credit.application;

import java.util.List;
import java.util.Map;

/**
 * Expediente WMA-F-FIN-001 de una solicitud de crédito. Se guarda entero y cifrado en
 * {@code solicitud_credito.expediente_cifrado} (V0019): ninguna de sus partes queda legible en la
 * base, y solo lo descifra el backend para los roles de crédito (Principio I).
 */
public record CreditDossier(
        Map<String, Object> datosPersonales,
        Map<String, Object> datosContacto,
        Map<String, Object> datosLaborales,
        Map<String, Object> datosFinancieros,
        List<Map<String, Object>> referencias,
        Map<String, Object> datosBancarios,
        Map<String, Object> declaraciones,
        Map<String, Object> evidenciaAceptacion
) {

    public CreditDossier {
        datosPersonales = datosPersonales != null ? datosPersonales : Map.of();
        datosContacto = datosContacto != null ? datosContacto : Map.of();
        datosLaborales = datosLaborales != null ? datosLaborales : Map.of();
        datosFinancieros = datosFinancieros != null ? datosFinancieros : Map.of();
        referencias = referencias != null ? referencias : List.of();
        datosBancarios = datosBancarios != null ? datosBancarios : Map.of();
        declaraciones = declaraciones != null ? declaraciones : Map.of();
        evidenciaAceptacion = evidenciaAceptacion != null ? evidenciaAceptacion : Map.of();
    }
}
