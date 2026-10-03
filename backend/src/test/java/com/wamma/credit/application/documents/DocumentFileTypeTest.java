package com.wamma.credit.application.documents;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentFileTypeTest {

    @Test
    void recognizesTheAdmittedTypesByTheirContent() {
        assertThat(DocumentFileType.detect("%PDF-1.7\n...".getBytes(StandardCharsets.US_ASCII))).contains(DocumentFileType.PDF);
        assertThat(DocumentFileType.detect(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0}))
                .contains(DocumentFileType.JPEG);
        assertThat(DocumentFileType.detect(new byte[]{(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0}))
                .contains(DocumentFileType.PNG);
    }

    @Test
    void rejectsAnythingElseWhateverItsName() {
        assertThat(DocumentFileType.detect("MZ\u0090\u0000ejecutable".getBytes(StandardCharsets.ISO_8859_1))).isEmpty();
        assertThat(DocumentFileType.detect("<svg onload=alert(1)>".getBytes(StandardCharsets.US_ASCII))).isEmpty();
        assertThat(DocumentFileType.detect("%PD".getBytes(StandardCharsets.US_ASCII))).as("cabecera incompleta").isEmpty();
        assertThat(DocumentFileType.detect(new byte[0])).isEmpty();
        assertThat(DocumentFileType.detect(null)).isEmpty();
    }

    @Test
    void keysLiveUnderTheOpportunityAndCarryNoPathOrUrl() {
        UUID opportunity = UUID.randomUUID();
        String key = DocumentStorage.keyFor(opportunity, UUID.randomUUID(), DocumentFileType.PDF);
        assertThat(key).startsWith(DocumentStorage.prefixFor(opportunity)).endsWith(".pdf");
        assertThat(DocumentStorage.isValidKey(key)).isTrue();
        assertThat(DocumentStorage.isValidKey("recaudos/" + opportunity + "/../otra/archivo.pdf")).isFalse();
        assertThat(DocumentStorage.isValidKey("https://ejemplo.invalid/" + key)).isFalse();
        assertThat(DocumentStorage.isValidKey(key.replace(".pdf", ".exe"))).isFalse();
        assertThat(DocumentStorage.isValidKey(null)).isFalse();
    }
}
