package com.wamma.crm;

import com.wamma.crm.domain.FinancingLinkToken;
import com.wamma.inventory.PublicationRepository;
import com.wamma.inventory.VehicleRepository;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class FinancingLinkService {

    public record VehicleSummary(
            UUID id,
            String code,
            String brand,
            String model,
            int year,
            String version,
            BigDecimal price,
            String photoKey
    ) {
    }

    public record LinkDetails(
            boolean valid,
            String invalidReason,
            VehicleSummary vehicle,
            String paymentMethod,
            BigDecimal estimatedValue,
            UUID opportunityId
    ) {
    }

    private final OpportunityRepository opportunities;
    private final VehicleRepository vehicles;
    private final PublicationRepository publications;
    private final Clock clock;

    public FinancingLinkService(OpportunityRepository opportunities, VehicleRepository vehicles,
                                PublicationRepository publications, Clock clock) {
        this.opportunities = opportunities;
        this.vehicles = vehicles;
        this.publications = publications;
        this.clock = clock;
    }

    public LinkDetails validate(String token) {
        if (!FinancingLinkToken.hasValidShape(token)) {
            throw ApiException.notFound("Enlace no encontrado", "El enlace no existe o es inválido.");
        }

        String hash = FinancingLinkToken.hash(token);
        Optional<OpportunityRecord> oppOpt = opportunities.findByFinancingLinkHash(hash);
        if (oppOpt.isEmpty()) {
            throw ApiException.notFound("Enlace no encontrado", "El enlace no existe o es inválido.");
        }

        OpportunityRecord opp = oppOpt.get();
        Instant now = clock.instant();

        if (opp.financingLinkUsedAt() != null) {
            return new LinkDetails(false, "usado", null, opp.paymentMethod(), opp.estimatedValue(), opp.id());
        }
        if (opp.financingLinkExpiresAt() != null && opp.financingLinkExpiresAt().isBefore(now)) {
            return new LinkDetails(false, "vencido", null, opp.paymentMethod(), opp.estimatedValue(), opp.id());
        }

        var vehicleOpt = vehicles.findAll().stream().filter(v -> v.id().equals(opp.vehicleId())).findFirst();
        var pubOpt = publications.findByVehicle(opp.vehicleId());

        VehicleSummary summary = null;
        if (vehicleOpt.isPresent()) {
            var v = vehicleOpt.get();
            String photoKey = pubOpt.flatMap(pub -> publications.photos(pub.id()).stream()
                            .filter(PublicationRepository.PhotoRecord::main)
                            .findFirst())
                    .map(PublicationRepository.PhotoRecord::key)
                    .orElse(null);

            summary = new VehicleSummary(
                    v.id(), v.code(), v.brand(), v.model(), v.year(), v.version(),
                    pubOpt.map(PublicationRepository.PublicationRecord::price).orElse(opp.estimatedValue()),
                    photoKey
            );
        }

        return new LinkDetails(true, null, summary, opp.paymentMethod(), opp.estimatedValue(), opp.id());
    }
}
