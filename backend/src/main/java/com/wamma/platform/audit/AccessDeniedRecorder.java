package com.wamma.platform.audit;

import com.wamma.platform.web.RequestInfo;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Deja en la bitácora cada acceso denegado (CA-001.1), venga del filtro de seguridad o de un
 * {@code @PreAuthorize}. Se escribe fuera de cualquier transacción de negocio, así que el
 * registro queda aunque la operación se haya revertido.
 */
@Component
public class AccessDeniedRecorder {

    private final AuditLog audit;

    public AccessDeniedRecorder(AuditLog audit) {
        this.audit = audit;
    }

    public void record() {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("metodo", RequestInfo.method());
        detail.put("ruta", RequestInfo.path());
        audit.record("acceso.denegado", "endpoint", null, null, detail);
    }
}
