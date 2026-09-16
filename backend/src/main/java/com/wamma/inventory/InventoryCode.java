package com.wamma.inventory;

import java.util.regex.Pattern;

/**
 * Código de inventario (plan 005 E3): estable, legible y el que va en la dirección de la
 * ficha. Los vehículos de demostración conservan {@code veh-001} a {@code veh-016} para no
 * romper los enlaces ni los datos del CRM que ya están en los navegadores. Los demás los
 * genera la base ({@code WAM-00017} en adelante, V0014).
 */
public final class InventoryCode {

    /** El mismo patrón que {@code vehiculo_codigo_check} (V0014). */
    public static final Pattern PATTERN = Pattern.compile("^(veh-[0-9]{3}|WAM-[0-9]{5,})$");

    private InventoryCode() {
    }

    public static boolean isValid(String code) {
        return code != null && PATTERN.matcher(code).matches();
    }
}
