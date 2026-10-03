package com.wamma.credit.application;

import com.wamma.credit.application.documents.DocumentFileType;
import com.wamma.credit.application.documents.DocumentStorage;
import com.wamma.credit.application.documents.DocumentStorageProperties;
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
import com.wamma.financing.LoanCalculator;
import com.wamma.inventory.PublicationRepository;
import com.wamma.inventory.VehicleRepository;
import com.wamma.inventory.photos.PhotoStorage;
import com.wamma.platform.audit.AuditLog;
import com.wamma.platform.crypto.SignedLinks;
import com.wamma.platform.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class CreditApplicationService {

    /** Estados de validación de un recaudo (CHECK de solicitud_recaudo, V0006). */
    private static final Set<String> DOCUMENT_STATUSES = Set.of("pendiente", "conforme", "ilegible", "rechazado");

    /** Estados con dictamen final: ya no se vuelve a dictaminar la solicitud. */
    private static final Set<String> FINAL_STATUSES = Set.of("aprobada", "rechazada", "desembolsada");

    /** Estados con dictamen que se pueden reabrir (D-71). «Desembolsada» no: ya tiene consecuencias de dinero. */
    private static final Set<String> REOPENABLE_STATUSES = Set.of("aprobada", "rechazada");

    /** Única puerta de salida de un recaudo: pública, pero solo abre con una firma vigente (D-59). */
    public static final String SIGNED_DOCUMENT_PATH = "/v1/recaudos/archivo";

    /** Un recaudo abierto por su enlace firmado, con el tipo reconocido por su contenido. */
    public record SignedDocument(byte[] content, DocumentFileType type) {
    }

    private final CreditApplicationRepository creditApplications;
    private final FinancingLinkService financingLinkService;
    private final OpportunityRepository opportunities;
    private final PersonRepository persons;
    private final VehicleRepository vehicles;
    private final PublicationRepository publications;
    private final FinancingParametersService financingParameters;
    private final ExchangeRateService exchangeRates;
    private final PhotoStorage photoStorage;
    private final DocumentStorage documents;
    private final DocumentStorageProperties documentProperties;
    private final SignedLinks signedLinks;
    private final AuditLog audit;
    private final Clock clock;

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
            DocumentStorage documents,
            DocumentStorageProperties documentProperties,
            SignedLinks signedLinks,
            AuditLog audit,
            Clock clock) {
        this.creditApplications = creditApplications;
        this.financingLinkService = financingLinkService;
        this.opportunities = opportunities;
        this.persons = persons;
        this.vehicles = vehicles;
        this.publications = publications;
        this.financingParameters = financingParameters;
        this.exchangeRates = exchangeRates;
        this.photoStorage = photoStorage;
        this.documents = documents;
        this.documentProperties = documentProperties;
        this.signedLinks = signedLinks;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CreditApplicationDtos.CreditLinkDetailsDto validateLink(String token) {
        FinancingLinkService.LinkDetails details = financingLinkService.validate(token);
        if (!details.valid()) {
            return new CreditApplicationDtos.CreditLinkDetailsDto(
                    false, details.invalidReason(), details.opportunityId(), null, null, null, null, null, null);
        }

        UUID oppId = details.opportunityId();
        OpportunityRecord opp = opportunities.findById(oppId)
                .orElseThrow(() -> ApiException.notFound("Oportunidad no encontrada", "No existe"));

        PersonRecord person = persons.findById(opp.personId()).orElse(null);
        CreditApplicationDtos.ApplicantPrefillDto applicantDto = null;
        if (person != null) {
            applicantDto = new CreditApplicationDtos.ApplicantPrefillDto(
                    person.id(),
                    person.fullName(),
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

        // Sin tasa registrada no se inventa una: el enlace se informa sin equivalencia en bolívares.
        BcvRate rate = exchangeRates.currentEuroRate().orElse(null);
        BigDecimal bcvValue = rate != null ? rate.vesPerUnit() : null;
        LocalDate bcvDate = rate != null ? rate.date() : null;

        CreditApplicationDtos.VehicleDetailDto vehicleDto = null;
        if (details.vehicle() != null) {
            var v = details.vehicle();
            BigDecimal priceEur = v.price();
            BigDecimal priceVes = bcvValue != null ? priceEur.multiply(bcvValue).setScale(2, RoundingMode.HALF_UP) : null;
            String photoUrl = v.photoKey() != null ? photoStorage.publicUrl(v.photoKey()) : null;
            vehicleDto = new CreditApplicationDtos.VehicleDetailDto(
                    v.id(), v.code(), v.brand(), v.model(), v.year(), v.version(), priceEur, priceVes, photoUrl
            );
        }

        // Un enlace vigente de una oportunidad que ya tiene solicitud es un enlace para completar recaudos (D-70).
        CreditApplicationDtos.ComplementDto complement = null;
        if (opp.creditApplicationId() != null) {
            complement = creditApplications.findById(opp.creditApplicationId())
                    .map(app -> new CreditApplicationDtos.ComplementDto(
                            app.applicationNumber(),
                            creditApplications.listDocuments(app.id()).stream()
                                    .map(CreditDocumentRecord::documentType).distinct().toList()))
                    .orElse(null);
        }

        return new CreditApplicationDtos.CreditLinkDetailsDto(
                true, null, oppId, vehicleDto, applicantDto, paramsDto, bcvValue, bcvDate, complement
        );
    }

    /**
     * Carga pública de un recaudo, solo con un enlace de financiamiento vigente y sin usar. El
     * archivo va al contenedor PRIVADO (D-59) bajo la oportunidad del enlace; su tipo se reconoce
     * por el contenido, no por el nombre ni por lo que declara el navegador.
     */
    public CreditApplicationDtos.DocumentSubmissionDto uploadDocument(String token, String tipoDocumento, MultipartFile file) {
        OpportunityRecord opp = requireOpenLink(token);
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Archivo vacío", "Debe subir un archivo válido.");
        }
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw ApiException.unprocessable("Archivo ilegible", "No se pudo leer el archivo del recaudo.");
        }
        DocumentFileType type = DocumentFileType.detect(content)
                .orElseThrow(() -> ApiException.unprocessable("Tipo de archivo no admitido",
                        "El recaudo debe ser un PDF, JPG o PNG."));

        String key = DocumentStorage.keyFor(opp.id(), UUID.randomUUID(), type);
        documents.put(key, content, type.mimeType());
        audit.record("solicitud_recaudo.cargado", "oportunidad", opp.id(),
                Map.of("clave", key, "tipo", type.mimeType(), "tamano_bytes", content.length));

        return new CreditApplicationDtos.DocumentSubmissionDto(
                CreditApplicationRepository.normalizeDocType(tipoDocumento), key,
                displayName(file.getOriginalFilename(), type), (long) content.length, type.mimeType());
    }

    /**
     * Precio de lista sobre el que se calcula el crédito: el de la publicación, que es el que vio la persona al validar
     * su enlace; si ya no hay publicación, el que fijó la oportunidad.
     */
    private BigDecimal listPrice(OpportunityRecord opp) {
        return publications.findByVehicle(opp.vehicleId())
                .map(PublicationRepository.PublicationRecord::price)
                .orElse(opp.estimatedValue());
    }

    /** Un monto libre del expediente (número o texto numérico); lo que no se puede leer cuenta como cero. */
    private static BigDecimal decimalOf(Object value) {
        try {
            if (value instanceof Number number) {
                return new BigDecimal(number.toString());
            }
            if (value instanceof String text && !text.isBlank()) {
                return new BigDecimal(text.trim());
            }
        } catch (NumberFormatException ignored) {
            // Se trata como no informado.
        }
        return BigDecimal.ZERO;
    }

    /** La oportunidad del enlace, si está vigente y sin usar (spec 010 §8.8). */
    private OpportunityRecord requireOpenLink(String token) {
        if (token == null || !FinancingLinkToken.hasValidShape(token)) {
            throw ApiException.badRequest("Enlace inválido", "El enlace no es válido o ha expirado.");
        }
        OpportunityRecord opp = opportunities.findByFinancingLinkHash(FinancingLinkToken.hash(token))
                .orElseThrow(() -> ApiException.notFound("Enlace no encontrado", "El enlace no existe o es inválido."));
        if (opp.financingLinkUsedAt() != null) {
            throw ApiException.unprocessable("Enlace ya utilizado", "Esta solicitud ya fue enviada con este enlace.");
        }
        if (opp.financingLinkExpiresAt() != null && opp.financingLinkExpiresAt().isBefore(clock.instant())) {
            throw ApiException.unprocessable("Enlace vencido", "El enlace ha caducado. Contacte a su asesor para recibir uno nuevo.");
        }
        return opp;
    }

    /**
     * Cada recaudo tiene que haberse cargado con este mismo enlace: la clave empieza por la oportunidad del enlace y el
     * archivo existe en el contenedor privado.
     */
    private void requireOwnDocuments(OpportunityRecord opp, List<CreditApplicationDtos.DocumentSubmissionDto> docs) {
        String ownPrefix = DocumentStorage.prefixFor(opp.id());
        for (CreditApplicationDtos.DocumentSubmissionDto doc : docs) {
            String key = doc.fileKey();
            if (!DocumentStorage.isValidKey(key) || !key.startsWith(ownPrefix) || !documents.exists(key)) {
                throw ApiException.unprocessable("Recaudo no válido",
                        "Uno de los recaudos no se cargó con este enlace. Vuelve a adjuntarlo.");
            }
        }
    }

    /** Nombre para mostrar: sin rutas ni caracteres de control, y con la extensión del tipo real. */
    private static String displayName(String original, DocumentFileType type) {
        String name = original == null ? "" : original.replaceAll(".*[/\\\\]", "").replaceAll("\\p{Cntrl}", "").trim();
        if (name.isEmpty()) {
            name = "documento." + type.extension();
        }
        return name.length() > 120 ? name.substring(0, 120) : name;
    }

    @Transactional
    public CreditApplicationDtos.SubmitCreditApplicationResponse submitApplication(
            CreditApplicationDtos.SubmitCreditApplicationRequest req,
            String ipAddress,
            String userAgent) {
        OpportunityRecord opp = requireOpenLink(req.token());
        if (opp.creditApplicationId() != null) {
            throw ApiException.conflict("Solicitud ya enviada",
                    "Este enlace sirve para completar los recaudos de la solicitud que ya enviaste, no para enviar otra.");
        }
        Instant now = clock.instant();

        List<CreditApplicationDtos.DocumentSubmissionDto> submittedDocs =
                req.recaudos() != null ? req.recaudos() : List.of();
        requireOwnDocuments(opp, submittedDocs);

        // La tasa BCV de la operación es la vigente; si no hay, la que ya tenía la oportunidad (real, del día de la
        // publicación). Sin ninguna de las dos no se inventa un valor: el envío se rechaza (Principio V).
        BcvRate rate = exchangeRates.currentEuroRate().orElse(null);
        BigDecimal bcvRate = rate != null ? rate.vesPerUnit() : opp.bcvRate();
        LocalDate bcvDate = rate != null ? rate.date() : opp.rateDate();
        if (bcvRate == null || bcvDate == null) {
            throw ApiException.conflict("Sin tasa BCV registrada",
                    "No hay una tasa BCV registrada para esta operación. Inténtalo más tarde o avisa a tu asesor.");
        }

        // D-55: el plazo es el de la política vigente (24 meses), sin selector y sin otro valor.
        FinancingParameters policy = financingParameters.getActiveParameters();
        int term = policy.termMonths();
        if (req.plazoMeses() != term) {
            throw ApiException.unprocessable("Plazo no admitido", "El financiamiento es a " + term + " meses.");
        }

        // Las cifras las calcula el servidor (hallazgos C-01, C-02, C-08): del navegador solo se toma la inicial y lo
        // que la persona declaró. El monto, la cuota y la capacidad que él mande se ignoran.
        BigDecimal price = listPrice(opp);
        BigDecimal downPayment = req.cuotaInicial() != null ? req.cuotaInicial().setScale(2, RoundingMode.HALF_UP) : null;
        if (downPayment == null || downPayment.signum() <= 0) {
            throw ApiException.unprocessable("Inicial no válida", "Indica la cuota inicial que vas a aportar.");
        }
        if (downPayment.compareTo(price) >= 0) {
            throw ApiException.unprocessable("Inicial no válida", "La inicial debe ser menor que el precio del vehículo.");
        }
        BigDecimal minimumDown = LoanCalculator.minimumDownPayment(price, policy.minimumDownPayment());
        if (downPayment.compareTo(minimumDown) < 0) {
            throw ApiException.unprocessable("Inicial insuficiente",
                    "La inicial mínima es el " + policy.minimumDownPayment().movePointRight(2).stripTrailingZeros().toPlainString()
                            + " % del precio: " + minimumDown.toPlainString() + " EUR.");
        }
        Map<String, Object> financial = req.datosFinancieros() != null ? req.datosFinancieros() : Map.of();
        BigDecimal monthlyIncome = decimalOf(financial.get("sueldoMensual")).add(decimalOf(financial.get("otrosIngresos")));
        if (decimalOf(financial.get("sueldoMensual")).signum() <= 0) {
            throw ApiException.unprocessable("Ingreso no válido", "El ingreso mensual es obligatorio.");
        }
        BigDecimal requested = price.subtract(downPayment);
        BigDecimal estimatedPayment = LoanCalculator.monthlyPayment(requested, policy.monthlyRate(), term);
        BigDecimal monthlyCapacity = LoanCalculator.paymentCapacity(monthlyIncome, policy.paymentToIncomeRatio());

        int year = bcvDate.getYear();
        String applicationNumber = creditApplications.generateNextApplicationNumber(year);
        UUID applicationId = UUID.randomUUID();

        // Evidencia de la aceptación (D-57): lo que el servidor vio, sin valores de relleno ni «verificados» inventados.
        Map<String, Object> evidence = new LinkedHashMap<>();
        evidence.put("aceptadoEn", now.toString());
        evidence.put("ip", ipAddress);
        evidence.put("userAgent", userAgent);
        evidence.put("versionTexto", req.versionTexto());

        CreditDossier dossier = new CreditDossier(
                req.datosPersonales(),
                req.datosContacto(),
                req.datosLaborales(),
                req.datosFinancieros(),
                req.referencias(),
                req.datosBancarios(),
                req.declaraciones(),
                evidence);

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
                dossier,
                monthlyCapacity,
                estimatedPayment,
                // El financiamiento es de cuotas mensuales (sistema francés): no hay otra frecuencia.
                "Mensual",
                "enviada",
                now,
                now,
                now
        );

        creditApplications.insert(record);

        for (CreditApplicationDtos.DocumentSubmissionDto doc : submittedDocs) {
            creditApplications.insertDocument(new CreditDocumentRecord(
                    UUID.randomUUID(),
                    applicationId,
                    doc.documentType() != null ? doc.documentType() : "otro",
                    doc.fileKey(),
                    doc.fileName(),
                    doc.fileSizeBytes(),
                    doc.mimeType(),
                    "pendiente",
                    null,
                    now
            ));
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
        // Una sola lectura de vehículos y de recaudos para toda la bandeja, no una por solicitud.
        Map<UUID, VehicleRepository.VehicleRecord> vehiclesById = new HashMap<>();
        for (VehicleRepository.VehicleRecord v : vehicles.findAll()) {
            vehiclesById.put(v.id(), v);
        }
        Map<UUID, Integer> documentCounts = creditApplications.countDocuments(records.stream().map(CreditApplicationRecord::id).toList());

        for (CreditApplicationRecord r : records) {
            PersonRecord p = persons.findById(r.personId()).orElse(null);
            var vehOpt = Optional.ofNullable(vehiclesById.get(r.vehicleId()));
            String vehDesc = vehOpt.map(v -> v.year() + " " + v.brand() + " " + v.model()).orElse("Vehículo");

            Map<String, Object> personal = r.dossier().datosPersonales();
            Map<String, Object> contact = r.dossier().datosContacto();

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
                    vehOpt.map(VehicleRepository.VehicleRecord::code).orElse(null),
                    vehDesc,
                    documentCounts.getOrDefault(r.id(), 0),
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

    /**
     * Expediente completo. Leerlo deja huella en la bitácora —quién lo abrió y cuándo—, porque contiene datos
     * personales y financieros: por eso no es una transacción de solo lectura.
     */
    @Transactional
    public CreditApplicationDtos.CreditApplicationDetailDto getApplication(UUID id) {
        CreditApplicationRecord r = creditApplications.findById(id)
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada", "No existe solicitud con ID " + id));
        audit.record("solicitud_credito.consultada", "solicitud_credito", id,
                Map.of("numero_solicitud", r.applicationNumber()));

        var vehOpt = vehicles.findById(r.vehicleId());
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
                        d.id(), d.documentType(), d.fileName(), d.fileSizeBytes(),
                        d.mimeType(), d.validationStatus(), d.notes(), d.createdAt()
                ))
                .toList();
        CreditDossier dossier = r.dossier();

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
                dossier.datosPersonales(),
                dossier.datosContacto(),
                dossier.datosLaborales(),
                dossier.datosFinancieros(),
                dossier.referencias(),
                dossier.datosBancarios(),
                dossier.declaraciones(),
                dossier.evidenciaAceptacion(),
                docDtos,
                decisionDto,
                r.submittedAt(),
                r.createdAt(),
                r.updatedAt()
        );
    }

    @Transactional
    public void evaluateApplication(UUID id, CreditApplicationDtos.EvaluateCreditApplicationRequest req, UUID evaluatorUserId) {
        CreditApplicationRecord app = creditApplications.findById(id)
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada", "No existe solicitud con ID " + id));

        // Un dictamen final no se cambia con un nuevo dictamen: aprobar o rechazar es una decisión con consecuencias (la
        // venta, el desembolso). Cambiarlo exige reabrir el expediente, con justificación y en la bitácora (D-71).
        if (FINAL_STATUSES.contains(app.status())) {
            throw ApiException.conflict("Dictamen final",
                    "La solicitud " + app.applicationNumber() + " ya fue " + app.status()
                            + ". Para cambiarlo, primero reabre el expediente con su justificación.");
        }

        String outcome = req.normalizedOutcome();
        String newStatus = switch (outcome) {
            case "aprobado" -> "aprobada";
            case "rechazado" -> "rechazada";
            case "condicionado" -> "condicionada";
            default -> throw ApiException.badRequest("Resultado inválido",
                    "El resultado debe ser aprobado, rechazado o condicionado.");
        };

        // Sin justificación no hay dictamen (D-63): queda con el usuario del analista en la bitácora.
        String justification = req.trimmedJustification();
        if (justification.length() < CreditApplicationDtos.EvaluateCreditApplicationRequest.MIN_JUSTIFICATION) {
            throw ApiException.unprocessable("Justificación obligatoria",
                    "Escribe la justificación del dictamen (al menos "
                            + CreditApplicationDtos.EvaluateCreditApplicationRequest.MIN_JUSTIFICATION + " caracteres).");
        }

        // Lo aprobado se dice expresamente: no se completa con lo solicitado ni con la cuota estimada.
        BigDecimal approvedLimit = null;
        BigDecimal maxPayment = null;
        if ("aprobado".equals(outcome)) {
            approvedLimit = req.limiteAprobado();
            maxPayment = req.cuotaMaximaPermitida();
            if (approvedLimit == null || approvedLimit.signum() <= 0 || maxPayment == null || maxPayment.signum() <= 0) {
                throw ApiException.unprocessable("Condiciones de la aprobación",
                        "Indica el límite aprobado y la cuota máxima permitida, mayores que cero.");
            }
            if (approvedLimit.compareTo(app.requestedAmount()) > 0) {
                throw ApiException.unprocessable("Condiciones de la aprobación",
                        "El límite aprobado no puede superar el monto solicitado (" + app.requestedAmount().toPlainString()
                                + " " + app.currency() + ").");
            }
        }

        String decisionOutcome = outcome;
        Instant now = clock.instant();
        CreditApplicationRepository.RiskDecisionRecord decision = new CreditApplicationRepository.RiskDecisionRecord(
                UUID.randomUUID(),
                id,
                null,
                null,
                null,
                decisionOutcome,
                approvedLimit,
                maxPayment,
                justification,
                evaluatorUserId,
                now,
                app.currency(),
                app.bcvRate(),
                app.bcvRateDate()
        );

        // La tabla guarda el dictamen vigente; el historial de cambios (condicionada → aprobada, por ejemplo) vive en la
        // bitácora, que es de solo agregar: por eso se anota aquí lo que había antes.
        String previousOutcome = creditApplications.findRiskDecision(id)
                .map(CreditApplicationRepository.RiskDecisionRecord::result).orElse("ninguno");
        creditApplications.insertRiskDecision(decision);
        creditApplications.updateStatus(id, newStatus);

        Map<String, Object> auditDetails = new HashMap<>();
        auditDetails.put("resultado", decisionOutcome);
        auditDetails.put("resultado_anterior", previousOutcome);
        auditDetails.put("estado_anterior", app.status());
        auditDetails.put("estado_nuevo", newStatus);
        auditDetails.put("justificacion", justification);
        auditDetails.put("evaluado_por", evaluatorUserId != null ? evaluatorUserId.toString() : "sistema");
        audit.record("solicitud_credito.evaluada", "solicitud_credito", id, auditDetails);
    }

    /**
     * Reabre un expediente con dictamen para que el analista lo vuelva a dictaminar (D-71). Pide justificación y deja
     * en la bitácora de dónde se vuelve. No procede si el crédito ya se desembolsó ni si la venta se cerró: eso ya
     * tiene consecuencias fuera de la solicitud.
     */
    @Transactional
    public void reopenApplication(UUID id, CreditApplicationDtos.ReopenApplicationRequest req, UUID userId) {
        CreditApplicationRecord app = creditApplications.findById(id)
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada", "No existe solicitud con ID " + id));
        if (!REOPENABLE_STATUSES.contains(app.status())) {
            throw ApiException.conflict("Solicitud no reabrible",
                    "Solo se reabre un expediente aprobado o rechazado. La solicitud " + app.applicationNumber()
                            + " está " + app.status() + ".");
        }
        String justification = req.trimmedJustification();
        if (justification.length() < CreditApplicationDtos.EvaluateCreditApplicationRequest.MIN_JUSTIFICATION) {
            throw ApiException.unprocessable("Justificación obligatoria",
                    "Escribe por qué se reabre el expediente (al menos "
                            + CreditApplicationDtos.EvaluateCreditApplicationRequest.MIN_JUSTIFICATION + " caracteres).");
        }
        OpportunityRecord opp = opportunities.findById(app.opportunityId()).orElse(null);
        if (opp != null && opp.stage() != null && opp.stage().startsWith("cerrado")) {
            throw ApiException.conflict("Venta cerrada",
                    "La venta de este vehículo ya se cerró: el expediente no se puede reabrir.");
        }

        creditApplications.updateStatus(id, "en_evaluacion");

        Map<String, Object> details = new HashMap<>();
        details.put("numero_solicitud", app.applicationNumber());
        details.put("estado_anterior", app.status());
        details.put("estado_nuevo", "en_evaluacion");
        details.put("resultado_anterior", creditApplications.findRiskDecision(id)
                .map(CreditApplicationRepository.RiskDecisionRecord::result).orElse("ninguno"));
        details.put("justificacion", justification);
        details.put("reabierto_por", userId != null ? userId.toString() : "sistema");
        audit.record("solicitud_credito.reabierta", "solicitud_credito", id, details);
    }

    /**
     * Emite el enlace con el que el cliente completa los recaudos de una solicitud condicionada (D-70). El enlace
     * anterior deja de servir. El texto completo solo existe en esta respuesta: el servidor guarda su huella.
     */
    @Transactional
    public CreditApplicationDtos.DocumentsLinkDto issueDocumentsLink(UUID applicationId, UUID userId) {
        CreditApplicationRecord app = creditApplications.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada", "No existe solicitud con ID " + applicationId));
        if (!"condicionada".equals(app.status())) {
            throw ApiException.conflict("Solicitud no condicionada",
                    "Solo se piden más recaudos en una solicitud condicionada. La solicitud "
                            + app.applicationNumber() + " está " + app.status() + ".");
        }
        OpportunityRecord opp = opportunities.findById(app.opportunityId())
                .orElseThrow(() -> ApiException.notFound("Oportunidad no encontrada", "La solicitud no tiene oportunidad."));

        FinancingLinkToken.Issued issued = FinancingLinkToken.issue(new SecureRandom());
        Instant now = clock.instant();
        Instant expiresAt = now.plus(Duration.ofDays(7));
        opportunities.reopenFinancingLink(opp.id(), issued.hash(), now, expiresAt);

        audit.record("solicitud_credito.enlace_recaudos_emitido", "solicitud_credito", applicationId,
                Map.of("numero_solicitud", app.applicationNumber(),
                        "expira_en", expiresAt.toString(),
                        "emitido_por", userId != null ? userId.toString() : "sistema"));
        return new CreditApplicationDtos.DocumentsLinkDto(issued.token(), expiresAt);
    }

    /**
     * El cliente completa los recaudos de su solicitud condicionada con el enlace del analista (D-70). Es la misma
     * solicitud, con el mismo número: los recaudos nuevos se suman y uno del mismo tipo reemplaza al anterior. La
     * solicitud vuelve a la bandeja del analista y el enlace queda usado.
     */
    @Transactional
    public CreditApplicationDtos.SubmitCreditApplicationResponse submitComplement(
            CreditApplicationDtos.ComplementSubmitRequest req) {
        OpportunityRecord opp = requireOpenLink(req.token());
        if (opp.creditApplicationId() == null) {
            throw ApiException.conflict("Enlace sin solicitud",
                    "Este enlace es para enviar una solicitud nueva, no para completar recaudos.");
        }
        CreditApplicationRecord app = creditApplications.findById(opp.creditApplicationId())
                .orElseThrow(() -> ApiException.notFound("Solicitud no encontrada", "La solicitud del enlace no existe."));
        if (!"condicionada".equals(app.status())) {
            throw ApiException.conflict("Solicitud no condicionada",
                    "La solicitud " + app.applicationNumber() + " ya no espera recaudos.");
        }
        List<CreditApplicationDtos.DocumentSubmissionDto> docs = req.recaudos() != null ? req.recaudos() : List.of();
        if (docs.isEmpty()) {
            throw ApiException.unprocessable("Faltan recaudos", "Adjunta al menos un documento para completar la solicitud.");
        }
        requireOwnDocuments(opp, docs);

        Instant now = clock.instant();
        Set<String> replacedTypes = new HashSet<>();
        List<String> replacedFiles = new ArrayList<>();
        List<String> keysToDelete = new ArrayList<>();
        List<String> newTypes = new ArrayList<>();
        for (CreditApplicationDtos.DocumentSubmissionDto doc : docs) {
            String type = CreditApplicationRepository.normalizeDocType(doc.documentType());
            // «otro» suma; los demás tipos se reemplazan, una sola vez por envío (no se borra lo recién subido).
            if (!"otro".equals(type) && replacedTypes.add(type)) {
                for (CreditDocumentRecord old : creditApplications.deleteDocumentsOfType(app.id(), type)) {
                    keysToDelete.add(old.fileKey());
                    replacedFiles.add(old.documentType() + ": " + old.fileName());
                }
            }
            creditApplications.insertDocument(new CreditDocumentRecord(
                    UUID.randomUUID(), app.id(), type, doc.fileKey(), doc.fileName(), doc.fileSizeBytes(),
                    doc.mimeType(), "pendiente", null, now));
            newTypes.add(type);
        }

        opportunities.markFinancingLinkUsed(opp.id(), app.id(), now);
        creditApplications.updateStatus(app.id(), "en_evaluacion");

        // Los archivos reemplazados se borran al final y sin tumbar el envío: si alguno no se puede borrar, queda
        // anotado en la bitácora para limpiarlo, en lugar de perder el recaudo nuevo.
        List<String> notDeleted = new ArrayList<>();
        for (String key : keysToDelete) {
            try {
                documents.delete(key);
            } catch (RuntimeException e) {
                notDeleted.add(key);
            }
        }

        Map<String, Object> details = new HashMap<>();
        details.put("numero_solicitud", app.applicationNumber());
        details.put("estado_anterior", app.status());
        details.put("estado_nuevo", "en_evaluacion");
        details.put("recaudos_nuevos", newTypes);
        details.put("recaudos_reemplazados", replacedFiles);
        if (!notDeleted.isEmpty()) {
            details.put("archivos_sin_borrar", notDeleted);
        }
        audit.record("solicitud_credito.recaudos_completados", "solicitud_credito", app.id(), details);

        return new CreditApplicationDtos.SubmitCreditApplicationResponse(
                app.id(), app.applicationNumber(), "en_evaluacion", now,
                "Recibimos tus documentos. Tu solicitud " + app.applicationNumber() + " vuelve a análisis.");
    }

    @Transactional
    public void validateDocument(UUID applicationId, UUID documentId, String status, String notes) {
        if (status == null || !DOCUMENT_STATUSES.contains(status)) {
            throw ApiException.unprocessable("Estado de recaudo no válido",
                    "El estado debe ser pendiente, conforme, ilegible o rechazado.");
        }
        if (creditApplications.updateDocumentStatus(applicationId, documentId, status, notes) == 0) {
            throw ApiException.notFound("Recaudo no encontrado", "La solicitud no tiene ese recaudo.");
        }
        audit.record("solicitud_recaudo.validado", "solicitud_recaudo", documentId,
                Map.of("solicitud_id", applicationId.toString(), "estado", status));
    }

    /**
     * Enlace firmado para abrir un recaudo (D-59): vale solo para ese archivo y vence a los pocos
     * minutos. Queda en la bitácora quién lo pidió.
     */
    @Transactional
    public CreditApplicationDtos.DocumentLinkDto issueDocumentLink(UUID applicationId, UUID documentId) {
        CreditDocumentRecord doc = creditApplications.findDocument(applicationId, documentId)
                .orElseThrow(() -> ApiException.notFound("Recaudo no encontrado", "La solicitud no tiene ese recaudo."));
        Instant expiresAt = clock.instant().plus(documentProperties.vigenciaEnlace()).truncatedTo(ChronoUnit.SECONDS);
        long expires = expiresAt.getEpochSecond();
        String path = UriComponentsBuilder.fromPath(SIGNED_DOCUMENT_PATH)
                .queryParam("clave", doc.fileKey())
                .queryParam("vence", expires)
                .queryParam("firma", signedLinks.sign(doc.fileKey(), expires))
                .encode()
                .build()
                .toUriString();
        audit.record("solicitud_recaudo.enlace_emitido", "solicitud_recaudo", documentId,
                Map.of("solicitud_id", applicationId.toString(), "vence_en", expiresAt.toString()));
        return new CreditApplicationDtos.DocumentLinkDto(path, expiresAt);
    }

    /** Abre un recaudo por su enlace firmado. Una firma alterada o vencida no abre nada. */
    @Transactional
    public SignedDocument openSignedDocument(String key, long expires, String signature) {
        if (!DocumentStorage.isValidKey(key) || !signedLinks.verify(key, expires, signature, clock.instant())) {
            throw ApiException.forbidden("Enlace vencido o no válido",
                    "El enlace del recaudo venció o fue alterado. Ábrelo de nuevo desde el expediente.");
        }
        CreditDocumentRecord doc = creditApplications.findDocumentByKey(key)
                .orElseThrow(() -> ApiException.notFound("Recaudo no encontrado", "Ninguna solicitud tiene ese recaudo."));
        byte[] content = documents.read(key)
                .orElseThrow(() -> ApiException.notFound("Recaudo no encontrado", "El archivo ya no está en el almacén."));
        DocumentFileType type = DocumentFileType.detect(content)
                .orElseThrow(() -> ApiException.unprocessable("Tipo de archivo no admitido",
                        "El archivo guardado no es un PDF, JPG ni PNG."));
        audit.record("solicitud_recaudo.abierto", "solicitud_recaudo", doc.id(),
                Map.of("solicitud_id", doc.applicationId().toString()));
        return new SignedDocument(content, type);
    }
}
