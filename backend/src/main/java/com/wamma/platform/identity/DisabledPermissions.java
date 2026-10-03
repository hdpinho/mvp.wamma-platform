package com.wamma.platform.identity;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Permisos que existen en el código y en la matriz de roles pero están apagados en esta entrega.
 * <p>
 * «Tomar» y «repartir» oportunidades no entran en el MVP (D-73). En lugar de borrar el permiso de la base —lo que
 * pediría una migración para volver atrás—, se apaga con {@code wamma.crm.asignacion-habilitada=false} (por defecto):
 * la sesión del coordinador deja de traer {@code crm.asignar} y el servidor rechaza la asignación. Encender la
 * bandera lo devuelve todo sin tocar la base.
 */
@Component
public class DisabledPermissions {

    private final Set<String> disabled;

    public DisabledPermissions(@Value("${wamma.crm.asignacion-habilitada:false}") boolean crmAssignmentEnabled) {
        this.disabled = crmAssignmentEnabled ? Set.of() : Set.of(Permission.CRM_ASSIGN.code());
    }

    /** Los permisos de una sesión, sin los que están apagados. */
    public Set<String> filter(Set<String> permissions) {
        Set<String> kept = new LinkedHashSet<>(permissions);
        kept.removeAll(disabled);
        return kept;
    }

    public boolean crmAssignmentEnabled() {
        return !disabled.contains(Permission.CRM_ASSIGN.code());
    }
}
