package com.wamma.crm.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Catálogo cerrado de motivos de pérdida, con las filas de la base (spec 010 §8.2). */
public final class LossReasonCatalog {

    private final Map<String, LossReason> byCode;

    private LossReasonCatalog(Map<String, LossReason> byCode) {
        this.byCode = byCode;
    }

    public static LossReasonCatalog of(List<LossReason> reasons) {
        Map<String, LossReason> byCode = new LinkedHashMap<>();
        for (LossReason reason : reasons) {
            if (byCode.putIfAbsent(reason.code(), reason) != null) {
                throw new IllegalArgumentException("Motivo de pérdida repetido en el catálogo: " + reason.code());
            }
        }
        return new LossReasonCatalog(byCode);
    }

    public Optional<LossReason> find(String code) {
        return Optional.ofNullable(code).map(byCode::get);
    }

    public List<LossReason> all() {
        return List.copyOf(byCode.values());
    }
}
