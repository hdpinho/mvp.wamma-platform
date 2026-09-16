package com.wamma.platform.identity;

import java.util.EnumSet;
import java.util.Set;

import static com.wamma.platform.identity.Permission.AUDIT_VIEW;
import static com.wamma.platform.identity.Permission.BCV_RATE_RECORD;
import static com.wamma.platform.identity.Permission.CREDIT_REVIEW;
import static com.wamma.platform.identity.Permission.CREDIT_VIEW;
import static com.wamma.platform.identity.Permission.CRM_ASSIGN;
import static com.wamma.platform.identity.Permission.CRM_OPERATE;
import static com.wamma.platform.identity.Permission.CRM_VIEW_ALL;
import static com.wamma.platform.identity.Permission.CRM_VIEW_OWN;
import static com.wamma.platform.identity.Permission.INVENTORY_MANAGE;
import static com.wamma.platform.identity.Permission.INVENTORY_VIEW;
import static com.wamma.platform.identity.Permission.PARAMETERS_MANAGE;
import static com.wamma.platform.identity.Permission.QUOTE_USE;
import static com.wamma.platform.identity.Permission.USERS_MANAGE;

/**
 * Roles del backoffice (D-03) y su matriz de permisos (plan 001 §9, D-24).
 * <p>
 * La siembra de V0013 y esta matriz deben coincidir; una prueba de integración lo verifica.
 * El administrador no opera inventario, CRM ni crédito salvo que reciba también ese rol
 * (Principio I).
 */
public enum Role {

    ADMINISTRADOR(EnumSet.of(USERS_MANAGE, AUDIT_VIEW, PARAMETERS_MANAGE, BCV_RATE_RECORD, INVENTORY_VIEW)),
    ASESOR_COMERCIAL(EnumSet.of(INVENTORY_VIEW, CRM_VIEW_OWN, CRM_OPERATE, QUOTE_USE)),
    COORDINADOR_COMERCIAL(EnumSet.of(INVENTORY_VIEW, CRM_VIEW_ALL, CRM_OPERATE, CRM_ASSIGN, QUOTE_USE)),
    INVENTARIO(EnumSet.of(INVENTORY_VIEW, INVENTORY_MANAGE)),
    ANALISTA_CREDITO(EnumSet.of(BCV_RATE_RECORD, INVENTORY_VIEW, QUOTE_USE, CREDIT_REVIEW, CREDIT_VIEW)),
    AUDITOR(EnumSet.of(AUDIT_VIEW, INVENTORY_VIEW, CRM_VIEW_ALL, CREDIT_VIEW));

    private final Set<Permission> permissions;

    Role(Set<Permission> permissions) {
        this.permissions = permissions;
    }

    public Set<Permission> permissions() {
        return EnumSet.copyOf(permissions);
    }
}
