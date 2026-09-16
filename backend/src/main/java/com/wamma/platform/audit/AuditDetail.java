package com.wamma.platform.audit;

import java.util.LinkedHashMap;
import java.util.Map;

/** Detalle de un evento de la bitácora: pares clave-valor en orden, sin los valores nulos. */
public final class AuditDetail {

    private AuditDetail() {
    }

    public static Map<String, Object> of(Object... keysAndValues) {
        if (keysAndValues.length % 2 != 0) {
            throw new IllegalArgumentException("Se esperan pares clave-valor");
        }
        Map<String, Object> detail = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            if (keysAndValues[i + 1] != null) {
                detail.put((String) keysAndValues[i], keysAndValues[i + 1]);
            }
        }
        return detail;
    }
}
