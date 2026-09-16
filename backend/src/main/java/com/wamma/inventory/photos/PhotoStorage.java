package com.wamma.inventory.photos;

/**
 * Almacén de las fotos de la vitrina (plan 005 §5, D-09). Es público: lo que se guarda aquí
 * lo puede ver cualquiera que tenga la dirección.
 */
public interface PhotoStorage {

    void put(String key, byte[] content, String contentType);

    void delete(String key);

    String publicUrl(String key);

    /** Claves con caracteres seguros y sin rutas relativas. */
    static void requireSafeKey(String key) {
        if (key == null || !key.matches("[A-Za-z0-9][A-Za-z0-9/_.-]*") || key.contains("..") || key.contains("//")) {
            throw new IllegalArgumentException("Clave de foto no válida: " + key);
        }
    }

    static String joinUrl(String base, String key) {
        return (base.endsWith("/") ? base.substring(0, base.length() - 1) : base) + "/" + key;
    }
}
