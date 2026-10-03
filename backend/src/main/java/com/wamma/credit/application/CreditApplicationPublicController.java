package com.wamma.credit.application;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class CreditApplicationPublicController {

    private final CreditApplicationService creditApplicationService;

    public CreditApplicationPublicController(CreditApplicationService creditApplicationService) {
        this.creditApplicationService = creditApplicationService;
    }

    @GetMapping("/v1/solicitudes-credito/enlace/{token}")
    public ResponseEntity<CreditApplicationDtos.CreditLinkDetailsDto> validateLink(@PathVariable String token) {
        return ResponseEntity.ok(creditApplicationService.validateLink(token));
    }

    @PostMapping(value = "/v1/solicitudes-credito/recaudos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CreditApplicationDtos.DocumentSubmissionDto> uploadRecaudo(
            @RequestParam("token") String token,
            @RequestParam("tipoDocumento") String tipoDocumento,
            @RequestParam("archivo") MultipartFile file) {
        return ResponseEntity.ok(creditApplicationService.uploadDocument(token, tipoDocumento, file));
    }

    /** El cliente completa los recaudos de su solicitud condicionada con el enlace del analista (D-70). */
    @PostMapping("/v1/solicitudes-credito/complemento")
    public ResponseEntity<CreditApplicationDtos.SubmitCreditApplicationResponse> submitComplement(
            @RequestBody CreditApplicationDtos.ComplementSubmitRequest request) {
        return ResponseEntity.ok(creditApplicationService.submitComplement(request));
    }

    @PostMapping("/v1/solicitudes-credito")
    public ResponseEntity<CreditApplicationDtos.SubmitCreditApplicationResponse> submitApplication(
            @RequestBody CreditApplicationDtos.SubmitCreditApplicationRequest request,
            HttpServletRequest servletRequest) {
        String ip = servletRequest.getRemoteAddr();
        String userAgent = servletRequest.getHeader("User-Agent");
        return ResponseEntity.ok(creditApplicationService.submitApplication(request, ip, userAgent));
    }
}
