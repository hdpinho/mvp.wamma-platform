package com.wamma.crm;

import com.wamma.crm.CrmDtos.AppointmentDto;
import com.wamma.crm.CrmDtos.InteractionDto;
import com.wamma.crm.CrmDtos.MergeDto;
import com.wamma.crm.CrmDtos.OpportunityDto;
import com.wamma.crm.CrmDtos.PersonSummaryDto;
import com.wamma.crm.CrmDtos.StageEventDto;
import com.wamma.inventory.photos.PhotoStorage;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/** Convierte lo que leen los repositorios en el contrato de la API ({@link CrmDtos}). */
@Component
public class CrmMapper {

    private final PhotoStorage photos;

    public CrmMapper(PhotoStorage photos) {
        this.photos = photos;
    }

    public OpportunityDto opportunity(OpportunityView v) {
        return new OpportunityDto(
                v.id(), v.personId(), v.personName(),
                v.vehicleId(), v.vehicleCode(), v.vehicleBrand(), v.vehicleModel(),
                v.vehicleVersion(), v.vehicleYear(),
                v.vehiclePhotoKey() != null ? photos.publicUrl(v.vehiclePhotoKey()) : null,
                v.paymentMethod(), v.estimatedValue(), v.currency(), v.bcvRate(), v.rateDate(),
                v.stage(), v.lossReason(), v.lossDetail(),
                v.advisorId(), v.advisorName(), v.nextAction(), v.nextActionDate(),
                v.creditApplicationId(), v.creditApplicationNumber(), v.creditStatus(),
                v.hasFinancingLink(), v.financingLinkIssuedAt(), v.financingLinkExpiresAt(), v.financingLinkUsedAt(),
                v.closedAt(), v.version(), v.createdAt(), v.updatedAt(), v.lastActivityAt(), v.enteredStageAt());
    }

    public AppointmentDto appointment(AppointmentView a) {
        return new AppointmentDto(
                a.id(), a.personId(), a.personName(), a.opportunityId(), a.vehicleId(), a.vehicleCode(),
                a.vehicleBrand() + " " + a.vehicleModel() + " " + a.vehicleYear(),
                a.preferredDate(), a.slot(), a.status(), a.notes(), a.reservationExpiresAt(), a.createdAt());
    }

    public InteractionDto interaction(InteractionRecord r) {
        return new InteractionDto(r.id(), r.personId(), r.opportunityId(), r.channel(), r.direction(), r.note(),
                r.authorId(), r.occurredAt(), r.createdAt(), r.correctsInteractionId());
    }

    public StageEventDto stageEvent(StageHistoryRecord h) {
        return new StageEventDto(h.id(), h.opportunityId(), h.previousStage(), h.newStage(), h.note(), h.actorId(),
                h.createdAt());
    }

    public MergeDto merge(PersonRepository.MergeRecord m) {
        return new MergeDto(m.absorbedId(), m.fullName(), m.phones(), m.email(), m.createdAt(), m.mergedAt(),
                m.opportunityIds(), m.appointmentIds(), m.interactionIds());
    }

    public PersonSummaryDto personSummary(PersonRecord p, Instant lastActivity) {
        List<String> phones = p.phones().stream().map(PhoneRecord::phone).toList();
        return new PersonSummaryDto(p.id(), p.fullName(), p.cedula(), p.primaryPhone(), phones, p.email(),
                p.channel(), p.state(), p.resolutionCriterion(), p.createdAt(),
                lastActivity != null ? lastActivity : p.createdAt());
    }
}
