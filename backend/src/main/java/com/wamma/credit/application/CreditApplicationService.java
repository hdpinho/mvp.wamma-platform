package com.wamma.credit.application;

import com.wamma.crm.FinancingLinkService;
import com.wamma.crm.OpportunityRecord;
import com.wamma.crm.OpportunityRepository;
import com.wamma.crm.PersonRecord;
import com.wamma.crm.PersonRepository;
import com.wamma.crm.domain.FinancingLinkToken;
import com.wamma.exchangerate.BcvRate;
import com.wamma.exchangerate.ExchangeRateService;
import com.wamma.financing.FinancingParameters;
import com.wamma.financing.FinancingParametersService;
import com.wamma.inventory.PublicationRepository;
import com.wamma.inventory.VehicleRepository;
import com.wamma.inventory.photos.PhotoStorage;
import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CreditApplicationService {

    private final CreditApplicationRepository creditApplications;
    private final FinancingLinkService financingLinkService;
    private final OpportunityRepository opportunities;
    private final PersonRepository persons;
    private final VehicleRepository vehicles;
    private final PublicationRepository publications;
    private final FinancingParametersService financingParameters;
    private final ExchangeRateService exchangeRates;
    private final PhotoStorage photoStorage;
    private final AuditLog audit;
    private final Clock clock;
    private final ObjectMapper json;

    public CreditApplicationService(
            CreditApplicationRepository creditApplications,
            FinancingLinkService financingLinkService,
            OpportunityRepository opportunities,
            PersonRepository persons,
            VehicleRepository vehicles,
            PublicationRepository publications,
            FinancingParametersService financingParameters,
            ExchangeRateService exchangeRates,
            PhotoStorage photoStorage,
            AuditLog audit,
            Clock clock,
            ObjectMapper json) {
        this.creditApplications = creditApplications;
        this.financingLinkService = financingLinkService;
        this.opportunities = opportunities;
        this.persons = persons;
        this.vehicles = vehicles;
        this.publications = publications;
        this.financingParameters = financingParameters;
        this.exchangeRates = exchangeRates;
        this.photoStorage = photoStorage;
        this.audit = audit;
        this.clock = clock;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public CreditApplicationDtos.CreditLinkDetailsDto validateLink(String token) {
        FinancingLinkService.LinkDetails details = financingLinkService.validate(token);
        if (!details.valid()) {
            return new CreditApplicationDtos.CreditLinkDetailsDto(
                    false, details.invalidReason(), details.opportunityId(), null, null, null, null, null);
        }

        UUID oppId = details.opportunityId();
        OpportunityRecord opp = opportunities.findById(oppId)
                .orElseThrow(() -> ApiException.notFound("Oportunidad no encontrada", "No existe"));

        PersonRecord person = persons.findById(opp.personId()).orElse(null);
        CreditApplicationDtos.ApplicantPrefillDto applicantDto = null;
        if (person != null) {
            String fullName = person.fullName() != null ? person.fullName() : "";
            String[] parts = fullName.split("\\s+");
            String firstName = parts.length > 0 ? parts[0] : "";
            String lastName = parts.length > 1 ? parts[1] : "";
            applicantDto = new CreditApplicationDtos.ApplicantPrefillDto(
                    person.id(),
                    firstName,
                    lastName,
                    person.cedula(),
                    person.primaryPhone(),
                    person.email()
            );
        }

        FinancingParameters params = financingParameters.getActiveParameters();
        CreditApplicationDtos.FinancingParamsSummaryDto paramsDto = new CreditApplicationDtos.FinancingParamsSummaryDto(
                params.monthlyRate().multiply(BigDecimal.valueOf(12)),
                params.monthlyRate(),
                params.minimumDownPayment(),
                params.termMonths(),
                params.paymentToIncomeRatio()
        );

        BcvRate rate = exchangeRates.currentEuroRate().orElse(null);
        BigDecimal bcvValue = rate != null ? rate.vesPerUnit() : new BigDecimal("54.25000000");
        LocalDate bcvDate = rate != null ? rate.date() : exchangeRates.today();

        CreditApplicationDtos.VehicleDetailDto vehicleDto = null;
        if (details.vehicle() != null) {
            var v = details.vehicle();
            BigDecimal priceEur = v.price();
            BigDecimal priceVes = priceEur.multiply(bcvValue).setScale(2, RoundingMode.HALF_UP);
            String photoUrl = v.photoKey() != null ? photoStorage.publicUrl(v.photoKey()) : null;
            vehicleDto = new CreditApplicationDtos.VehicleDetailDto(
                    v.id(), v.code(), v.brand(), v.model(), v.year(), v.version(), priceEur, priceVes, photoUrl
            );
        }

        return new CreditApplicationDtos.CreditLinkDetailsDto(
                true, null, oppId, vehicleDto, applicantDto, paramsDto, bcvValue, bcvDate
        );
    }

    public CreditApplicationDtos.DocumentSubmissionDto uploadDocument(String token, String tipoDocumento, MultipartFile file) {
        if (!FinancingLinkToken.hasValidShape(token)) {
            throw ApiException.badRequest("Token inválido", "El formato del token no es válido.");
        }
        if (file.isEmpty()) {
            throw ApiException.badRequest("Archivo vacío", "Debe subir un archivo válido.");
        }

        String safeType = tipoDocumento != null ? tipoDocumento.replaceAll("[^a-zA-Z0-9_-]", "") : "otro";
        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "documento";
        String ext = "jpg";
        int dotIdx = originalFilename.lastIndexOf('.');
        if (dotIdx > 0 && dotIdx < originalFilename.length() - 1) {
            String candidate = originalFilename.substring(dotIdx + 1).toLowerCase();
            if (candidate.matches("[a-z0-9]{2,5}")) {
                ext = candidate;
            }
        }

        String key = "recaudos/" + token + "/" + safeType + "-" + UUID.randomUUID() + "." + ext;
        try {
            photoStorage.put(key, file.getBytes(), file.getContentType());
        } catch (IOException e) {
            throw ApiException.unprocessable("Error de almacenamiento", "No se pudo guardar el archivo del recaudo.");
        }

        String url = photoStorage.publicUrl(key);
        return new CreditApplicationDtos.DocumentSubmissionDto(
                safeType, url, originalFilename, file.getSize(), file.getContentType()
        );
    }

    @Transactional
    public CreditApplicationDtos.SubmitCreditApplicationResponse submitApplication(
            CreditApplicationDtos.SubmitCreditApplicationRequest req,
            String ipAddress,
            String userAgent) {
        if (req.token() == null || !FinancingLinkToken.hasValidShape(req.token())) {
            throw ApiException.badRequest("Enlace inválido", "El enlace no es válido o ha expirado.");
        }

        String hash = FinancingLinkToken.hash(req.token());
        OpportunityRecord opp = opportunities.findByFinancingLinkHash(hash)
                .orElseThrow(() -> ApiException.notFound("Enlace no encontrado", "El enlace no existe o es inválido."));

        Instant now = clock.instant();
        if (opp.financingLinkUsedAt() != null) {
            throw ApiException.unprocessable("Enlace ya utilizado", "Esta solicitud ya fue enviada con este enlace.");
        }
        if (opp.financingLinkExpiresAt() != null && opp.financingLinkExpiresAt().isBefore(now)) {
            throw ApiException.unprocessable("Enlace vencido", "El enlace ha caducado. Contacte a su asesor para recibir uno nuevo.");
        }

        BcvRate rate = exchangeRates.currentEuroRate().orElse(null);
        BigDecimal bcvRate = rate != null ? rate.vesPerUnit() : new BigDecimal("54.25000000");
        LocalDate bcvDate = rate != null ? rate.date() : exchangeRates.today();

        int year = bcvDate.getYear();
        String applicationNumber = creditApplications.generateNextApplicationNumber(year);
        UUID applicationId = UUID.randomUUID();

        BigDecimal requested = req.montoSolicitado() != null ? req.montoSolicitado() : BigDecimal.ZERO;
        BigDecimal downPayment = req.cuotaInicial() != null ? req.cuotaInicial() : BigDecimal.ZERO;
        int term = req.plazoMeses() > 0 ? req.plazoMeses() : 24;
        BigDecimal monthlyCapacity = req.capacidadPagoMensual() != null ? req.capacidadPagoMensual() : BigDecimal.ZERO;
        BigDecimal estimatedPayment = req.cuotaEstimada() != null ? req.cuotaEstimada() : BigDecimal.ZERO;

        Map<String, Object> evidence = new HashMap<>();
        evidence.put("ip", ipAddress != null ? ipAddress : "127.0.0.1");
        evidence.put("userAgent", userAgent != null ? userAgent : "Browser");
        evidence.put("otpVerificado", req.otpVerificado());
        evidence.put("codigoOtpIngresado", req.codigoOtp() != null ? "VERIFICADO" : "OMITIDO");
        evidence.put("timestampAceptacion", now.toString());

        String personalJson = toJson(req.datosPersonales());
        String contactJson = toJson(req.datosContacto());
        String employmentJson = toJson(req.datosLaborales());
        String financialJson = toJson(req.datosFinancieros());
        String referencesJson = toJson(req.referencias());
        String bankingJson = toJson(req.datosBancarios());
        String declarationsJson = toJson(req.declaraciones());
        String evidenceJson = toJson(evidence);

        CreditApplicationRecord record = new CreditApplicationRecord(
                applicationId,
                applicationNumber,
                opp.id(),
                opp.personId(),
                opp.vehicleId(),
                requested,
                downPayment,
                term,
                "EUR",
                bcvRate,
                bcvDate,
                personalJson,
                contactJson,
                employmentJson,
                financialJson,
                referencesJson,
                bankingJson,
                declarationsJson,
                evidenceJson,
                monthlyCapacity,
                estimatedPayment,
                req.frecuenciaPago() != null ? req.frecuenciaPago() : "Mensual",
                "enviada",
                now,
                now,
                now
        );

        creditApplications.insert(record);

        if (req.recaudos() != null) {
            for (CreditApplicationDtos.DocumentSubmissionDto doc : req.recaudos()) {
                if (doc.fileUrl() != null && !doc.fileUrl().isBlank()) {
                    CreditDocumentRecord docRecord = new CreditDocumentRecord(
                            UUID.randomUUID(),
                            applicationId,
                            doc.documentType() != null ? doc.documentType() : "otro",
                            doc.fileUrl(),
                            doc.fileName(),
                            doc.fileSizeBytes(),
                            doc.mimeType(),
                            "pendiente",
                            null,
                            now
                    );
                    creditApplications.insertDocument(docRecord);
                }
            }
        }

        opportunities.markFinancingLinkUsed(opp.id(), applicationId, now);

        if ("visito".equals(opp.stage())) {
            opportunities.updateStage(opp.id(), "negociacion", null, null, null, opp.version());
        }

        audit.record("solicitud_credito.creada", "solicitud_credito", applicationId,
                Map.of(
                        "numero_solicitud", applicationNumber,
                        "oportunidad_id", opp.id().toString(),
                        "persona_id", opp.personId().toString(),
                        "monto_solicitado", requested.toString(),
                        "plazo_meses", term
                ));

        return new CreditApplicationDtos.SubmitCreditApplicationResponse(
                applicationId,
                applicationNumber,
                "enviada",
                now,
                "Tu solicitud de financiamiento " + applicationNumber + " ha sido recibida satisfactoriamente."
        );
    }

    @Transactional(readOnly = true)
    public List<CreditApplicationDtos.CreditApplicationSummaryDto> listApplications(String status, int page, int size) {
        int limit = Math.clamp(size, 1, 100);
        int offset = Math.max(0, page) * limit;

        List<CreditApplicationRecord> records = creditApplications.listAll(status, limit, offset);
        List<CreditApplicationDtos.CreditApplicationSummaryDto> summaries = new ArrayList<>();

        for (CreditApplicationRecord r : records) {
            PersonRecord p = persons.findById(r.personId()).orElse(null);
            var vehOpt = vehicles.findAll().stream().filter(v -> v.id().equals(r.vehicleId())).findFirst();
            String vehDesc = vehOpt.map(v -> v.year() + " " + v.brand() + " " + v.model()).orElse("Vehículo");

            Map<String, Object> personal = fromJson(r.personalDataJson());
            Map<String, Object> contact = fromJson(r.contactDataJson());

            String name = (personal.get("primerNombre") != null ? personal.get("primerNombre") + " " : "")
                    + (personal.get("primerApellido") != null ? personal.get("primerApellido") : "");
            if (name.isBlank() && p != null) name = p.fullName();

            String doc = personal.get("numeroDocumento") != null ? String.valueOf(personal.get("numeroDocumento")) : (p != null ? p.cedula() : "");
            String phone = contact.get("telefonoCelular") != null ? String.valueOf(contact.get("telefonoCelular")) : (p != null ? p.primaryPhone() : "");
            String email = contact.get("correo") != null ? String.valueOf(contact.get("correo")) : (p != null ? p.email() : "");

            summaries.add(new CreditApplicationDtos.CreditApplicationSummaryDto(
                    r.id(),
                    r.applicationNumber(),
                    r.status(),
                    r.vehicleId(),
                    vehDesc,
                    r.requestedAmount(),
                    r.downPayment(),
                    r.termMonths(),
                    r.estimatedPayment(),
                    name,
                    doc,
                    phone,
                    email,
                    r.createdAt()
            ));
        }

        return summaries;
    }

    @Transactional(readOnly = true)
    public CreditApplicationDtos.CreditApplicationDetailDto getApplication(UUID id) {
        CreditApplicationRecord r = creditApplications.findById(id)
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada", "No existe solicitud con ID " + id));

        var vehOpt = vehicles.findAll().stream().filter(v -> v.id().equals(r.vehicleId())).findFirst();
        var pubOpt = publications.findByVehicle(r.vehicleId());

        CreditApplicationDtos.VehicleDetailDto vehDto = null;
        if (vehOpt.isPresent()) {
            var v = vehOpt.get();
            BigDecimal priceEur = pubOpt.map(PublicationRepository.PublicationRecord::price).orElse(r.requestedAmount().add(r.downPayment()));
            BigDecimal priceVes = priceEur.multiply(r.bcvRate()).setScale(2, RoundingMode.HALF_UP);
            String photoKey = pubOpt.flatMap(pub -> publications.photos(pub.id()).stream()
                            .filter(PublicationRepository.PhotoRecord::main)
                            .findFirst())
                    .map(PublicationRepository.PhotoRecord::key)
                    .orElse(null);
            vehDto = new CreditApplicationDtos.VehicleDetailDto(
                    v.id(), v.code(), v.brand(), v.model(), v.year(), v.version(),
                    priceEur, priceVes, photoKey != null ? photoStorage.publicUrl(photoKey) : null
            );
        }

        List<CreditDocumentRecord> docs = creditApplications.listDocuments(id);
        List<CreditApplicationDtos.DocumentDetailDto> docDtos = docs.stream()
                .map(d -> new CreditApplicationDtos.DocumentDetailDto(
                        d.id(), d.documentType(), d.fileUrl(), d.fileName(), d.fileSizeBytes(),
                        d.mimeType(), d.validationStatus(), d.notes(), d.createdAt()
                ))
                .toList();

        CreditApplicationDtos.RiskDecisionDto decisionDto = creditApplications.findRiskDecision(id)
                .map(d -> new CreditApplicationDtos.RiskDecisionDto(
                        d.id(), d.internalScore(), d.bureauScore(), d.riskLevel(), d.result(),
                        d.approvedLimit(), d.maxAllowedPayment(), d.justification(), d.evaluatedBy(), d.evaluatedAt()
                ))
                .orElse(null);

        return new CreditApplicationDtos.CreditApplicationDetailDto(
                r.id(),
                r.applicationNumber(),
                r.status(),
                r.opportunityId(),
                r.personId(),
                r.vehicleId(),
                vehDto,
                r.requestedAmount(),
                r.downPayment(),
                r.termMonths(),
                r.currency(),
                r.bcvRate(),
                r.bcvRateDate(),
                r.estimatedPayment(),
                r.monthlyCapacity(),
                r.paymentFrequency(),
                fromJson(r.personalDataJson()),
                fromJson(r.contactDataJson()),
                fromJson(r.employmentDataJson()),
                fromJson(r.financialDataJson()),
                fromListJson(r.referencesJson()),
                fromJson(r.bankingDataJson()),
                fromJson(r.declarationsJson()),
                fromJson(r.acceptanceEvidenceJson()),
                docDtos,
                decisionDto,
                r.submittedAt(),
                r.createdAt(),
                r.updatedAt()
        );
    }

    @Transactional(readOnly = true)
    public CreditApplicationDtos.StatusLookupResponse lookupStatus(String numeroSolicitud) {
        CreditApplicationRecord r = creditApplications.findByApplicationNumber(numeroSolicitud)
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada", "El número " + numeroSolicitud + " no fue encontrado."));

        var vehOpt = vehicles.findAll().stream().filter(v -> v.id().equals(r.vehicleId())).findFirst();
        String vehDesc = vehOpt.map(v -> v.year() + " " + v.brand() + " " + v.model()).orElse("Vehículo");

        String mensaje;
        switch (r.status()) {
            case "enviada", "borrador" -> mensaje = "Tu solicitud está en cola de revisión por el equipo de crédito.";
            case "en_evaluacion" -> mensaje = "El analista de crédito está verificando tus recaudos y capacidad de pago.";
            case "aprobada" -> mensaje = "¡Felicidades! Tu financiamiento ha sido aprobado. Tu asesor se comunicará para la firma.";
            case "condicionada" -> mensaje = "Solicitud condicionada. Revisa los recaudos pendientes solicitados.";
            case "rechazada" -> mensaje = "En este momento no ha sido posible aprobar el financiamiento solicitado.";
            case "desembolsada" -> mensaje = "Crédito liquidado y vehículo listo para entrega.";
            default -> mensaje = "Estado: " + r.status();
        }

        return new CreditApplicationDtos.StatusLookupResponse(
                r.applicationNumber(),
                r.status(),
                r.submittedAt(),
                vehDesc,
                r.requestedAmount(),
                r.termMonths(),
                r.estimatedPayment(),
                mensaje
        );
    }

    @Transactional
    public void evaluateApplication(UUID id, CreditApplicationDtos.EvaluateCreditApplicationRequest req, UUID evaluatorUserId) {
        CreditApplicationRecord app = creditApplications.findById(id)
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada", "No existe solicitud con ID " + id));

        String rawOutcome = req.effectiveOutcome();
        String newStatus;
        String decisionOutcome;
        if ("aprobado".equalsIgnoreCase(rawOutcome) || "aprobada".equalsIgnoreCase(rawOutcome)) {
            newStatus = "aprobada";
            decisionOutcome = "aprobado";
        } else if ("rechazado".equalsIgnoreCase(rawOutcome) || "rechazada".equalsIgnoreCase(rawOutcome)) {
            newStatus = "rechazada";
            decisionOutcome = "rechazado";
        } else if ("condicionado".equalsIgnoreCase(rawOutcome) || "condicionada".equalsIgnoreCase(rawOutcome) || "devuelta".equalsIgnoreCase(rawOutcome)) {
            newStatus = "condicionada";
            decisionOutcome = "condicionado";
        } else if ("en_analisis".equalsIgnoreCase(rawOutcome) || "en_evaluacion".equalsIgnoreCase(rawOutcome)) {
            newStatus = "en_evaluacion";
            decisionOutcome = "condicionado";
        } else {
            throw ApiException.badRequest("Resultado inválido", "El resultado debe ser aprobado, rechazado o condicionado.");
        }

        Instant now = clock.instant();
        CreditApplicationRepository.RiskDecisionRecord decision = new CreditApplicationRepository.RiskDecisionRecord(
                UUID.randomUUID(),
                id,
                req.effectiveScore(),
                req.scoreBuro(),
                req.effectiveRiskLevel(),
                decisionOutcome,
                req.limiteAprobado() != null ? req.limiteAprobado() : app.requestedAmount(),
                req.cuotaMaximaPermitida() != null ? req.cuotaMaximaPermitida() : app.estimatedPayment(),
                req.effectiveJustification(),
                evaluatorUserId,
                now,
                app.currency(),
                app.bcvRate(),
                app.bcvRateDate()
        );

        creditApplications.insertRiskDecision(decision);
        creditApplications.updateStatus(id, newStatus);

        Map<String, Object> auditDetails = new HashMap<>();
        auditDetails.put("resultado", decisionOutcome);
        auditDetails.put("score_interno", req.effectiveScore());
        auditDetails.put("evaluado_por", evaluatorUserId != null ? evaluatorUserId.toString() : "sistema");
        audit.record("solicitud_credito.evaluada", "solicitud_credito", id, auditDetails);
    }

    @Transactional
    public void validateDocument(UUID applicationId, UUID documentId, String status, String notes) {
        creditApplications.updateDocumentStatus(documentId, status, notes);
        audit.record("solicitud_recaudo.validado", "solicitud_recaudo", documentId,
                Map.of("solicitud_id", applicationId.toString(), "estado", status));
    }

    private String toJson(Object obj) {
        if (obj == null) return "{}";
        return json.writeValueAsString(obj);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fromJson(String jsonStr) {
        if (jsonStr == null || jsonStr.isBlank()) return Collections.emptyMap();
        return json.readValue(jsonStr, Map.class);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fromListJson(String jsonStr) {
        if (jsonStr == null || jsonStr.isBlank()) return Collections.emptyList();
        return json.readValue(jsonStr, List.class);
    }
}
