package com.wamma.credit.application.documents;

import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Almacén PRIVADO de los recaudos de la solicitud de crédito (D-59), separado del de las fotos.
 * <p>
 * Nada de lo que se guarda aquí tiene URL pública: se lee solo a través del backend, con un
 * enlace firmado de corta duración que emite el backoffice. La base guarda la clave del objeto,
 * nunca una dirección (V0019).
 */
public interface DocumentStorage {

    /** {@code recaudos/<oportunidad>/<archivo>.<pdf|jpg|png>}: sin rutas relativas ni URL. */
    Pattern KEY = Pattern.compile(
            "recaudos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
                    + "/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(pdf|jpg|png)");

    void put(String key, byte[] content, String contentType);

    Optional<byte[]> read(String key);

    boolean exists(String key);

    /** Borra un recaudo que el cliente reemplazó. Si ya no está, no hace nada. */
    void delete(String key);

    /** Clave de un archivo nuevo de la oportunidad: la oportunidad la fija el enlace, no el cliente. */
    static String keyFor(UUID opportunityId, UUID fileId, DocumentFileType type) {
        return prefixFor(opportunityId) + fileId + "." + type.extension();
    }

    static String prefixFor(UUID opportunityId) {
        return "recaudos/" + opportunityId + "/";
    }

    static boolean isValidKey(String key) {
        return key != null && KEY.matcher(key).matches();
    }

    static void requireValidKey(String key) {
        if (!isValidKey(key)) {
            throw new IllegalArgumentException("Clave de recaudo no válida");
        }
    }
}
