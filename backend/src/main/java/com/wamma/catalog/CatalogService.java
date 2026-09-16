package com.wamma.catalog;

import com.wamma.exchangerate.BcvRate;
import com.wamma.exchangerate.ExchangeRateService;
import com.wamma.exchangerate.PublicRate;
import com.wamma.inventory.InventoryCode;
import com.wamma.inventory.InventoryQueries;
import com.wamma.inventory.InventoryViews;
import com.wamma.inventory.InventoryViews.CatalogVehicle;
import com.wamma.inventory.photos.PhotoStorage;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Vitrina pública (spec 005 RF-005.1 y RF-005.3): los vehículos publicados y no vendidos,
 * con su precio en euros y la equivalencia en bolívares a la tasa BCV del euro vigente.
 */
@Service
public class CatalogService {

    /** {@code tasa} es nula si todavía no hay tasa del euro registrada. */
    public record CatalogPage(PublicRate tasa, List<CatalogVehicle> vehiculos) {
    }

    private final InventoryQueries queries;
    private final ExchangeRateService rates;
    private final PhotoStorage storage;

    public CatalogService(InventoryQueries queries, ExchangeRateService rates, PhotoStorage storage) {
        this.queries = queries;
        this.rates = rates;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public CatalogPage list() {
        Optional<BcvRate> rate = rates.currentEuroRate();
        List<CatalogVehicle> vehicles = queries.all().stream()
                .filter(InventoryQueries.Assembled::onShowcase)
                .map(a -> InventoryViews.catalog(a, storage, rate))
                .toList();
        return new CatalogPage(rate.map(PublicRate::of).orElse(null), vehicles);
    }

    /** Lo que no está en la vitrina responde igual que lo que no existe (CA-005.6). */
    @Transactional(readOnly = true)
    public CatalogVehicle detail(String code) {
        if (!InventoryCode.isValid(code)) {
            throw notOnShowcase();
        }
        return queries.byCode(code)
                .filter(InventoryQueries.Assembled::onShowcase)
                .map(a -> InventoryViews.catalog(a, storage, rates.currentEuroRate()))
                .orElseThrow(CatalogService::notOnShowcase);
    }

    private static ApiException notOnShowcase() {
        return ApiException.notFound("Este vehículo no está disponible.");
    }
}
