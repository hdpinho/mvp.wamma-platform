package com.wamma.platform.identity;

/**
 * Catálogo de permisos (plan 001 §9, aprobado en D-24). El código es el que se guarda en
 * la tabla {@code permiso} y el que se usa en {@code @PreAuthorize("hasAuthority('...')")}.
 */
public enum Permission {

    USERS_MANAGE("usuarios.gestionar"),
    AUDIT_VIEW("auditoria.ver"),
    PARAMETERS_MANAGE("parametros.gestionar"),
    BCV_RATE_RECORD("tasa_bcv.registrar"),
    INVENTORY_VIEW("inventario.ver"),
    INVENTORY_MANAGE("inventario.gestionar"),
    CRM_VIEW_OWN("crm.ver_propias"),
    CRM_VIEW_ALL("crm.ver_todas"),
    CRM_OPERATE("crm.operar"),
    CRM_ASSIGN("crm.asignar"),
    QUOTE_USE("cotizador.usar"),
    CREDIT_REVIEW("credito.revisar"),
    CREDIT_VIEW("credito.ver");

    private final String code;

    Permission(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }
}
