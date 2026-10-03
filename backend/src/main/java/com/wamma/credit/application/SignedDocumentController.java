package com.wamma.credit.application;

import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Abre un recaudo con su enlace firmado (D-59). No pide sesión porque el enlace ya la acredita:
 * lo emite el backoffice a un rol de crédito, vale para un solo archivo y vence en minutos.
 * Nadie guarda copia: ni el navegador ni un intermediario.
 */
@RestController
public class SignedDocumentController {

    private final CreditApplicationService creditApplicationService;

    public SignedDocumentController(CreditApplicationService creditApplicationService) {
        this.creditApplicationService = creditApplicationService;
    }

    @GetMapping(CreditApplicationService.SIGNED_DOCUMENT_PATH)
    public ResponseEntity<byte[]> open(
            @RequestParam("clave") String key,
            @RequestParam("vence") long expires,
            @RequestParam("firma") String signature) {
        CreditApplicationService.SignedDocument document =
                creditApplicationService.openSignedDocument(key, expires, signature);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(document.type().mimeType()))
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename("recaudo." + document.type().extension())
                        .build()
                        .toString())
                .header("Referrer-Policy", "no-referrer")
                .body(document.content());
    }
}
