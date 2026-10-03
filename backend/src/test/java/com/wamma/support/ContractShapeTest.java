package com.wamma.support;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** El comparador de contratos tiene que fallar cuando debe: si no, las pruebas de contrato no prueban nada. */
@SuppressWarnings("unchecked")
class ContractShapeTest {

    @Test
    void aResponseWithTheFixtureShapeMatches() {
        Object actual = ContractShape.fixture("crm-cita-publica");
        assertThatCode(() -> ContractShape.assertMatches("crm-cita-publica", actual)).doesNotThrowAnyException();
    }

    @Test
    void aMissingKeyIsReported() {
        Map<String, Object> actual = Map.of("id", "x", "diaPreferencia", "2026-10-03", "estado", "pendiente");
        assertThatThrownBy(() -> ContractShape.assertMatches("crm-cita-publica", actual))
                .hasMessageContaining("franjaHoraria: falta en la respuesta");
    }

    @Test
    void anExtraKeyIsReported() {
        Map<String, Object> actual = Map.of("id", "x", "diaPreferencia", "2026-10-03", "franjaHoraria", "manana",
                "estado", "pendiente", "campoNuevo", 1);
        assertThatThrownBy(() -> ContractShape.assertMatches("crm-cita-publica", actual))
                .hasMessageContaining("campoNuevo: sobra en la respuesta");
    }

    @Test
    void aChangedTypeIsReported() {
        Map<String, Object> actual = Map.of("id", "x", "diaPreferencia", 20261003, "franjaHoraria", "manana",
                "estado", "pendiente");
        assertThatThrownBy(() -> ContractShape.assertMatches("crm-cita-publica", actual))
                .hasMessageContaining("diaPreferencia: es numero en la respuesta y texto en el contrato");
    }

    @Test
    void aNullValueOnlyRequiresTheKey() {
        Map<String, Object> actual = new java.util.HashMap<>((Map<String, Object>) ContractShape.fixture("crm-cita"));
        actual.put("notas", null);
        assertThatCode(() -> ContractShape.assertMatches("crm-cita", actual)).doesNotThrowAnyException();
    }

    @Test
    void nestedShapesAreComparedThroughTheFirstElementOfAList() {
        Map<String, Object> detail = new java.util.HashMap<>((Map<String, Object>) ContractShape.fixture("crm-persona-detalle"));
        @SuppressWarnings("unchecked")
        Map<String, Object> firstHistory = new java.util.HashMap<>(
                (Map<String, Object>) ((List<Object>) detail.get("historial")).getFirst());
        firstHistory.remove("ts");
        detail.put("historial", List.of(firstHistory));
        assertThatThrownBy(() -> ContractShape.assertMatches("crm-persona-detalle", detail))
                .hasMessageContaining("historial[].ts: falta en la respuesta");
    }

    @Test
    void opaquePathsAreOnlyRequiredToBeObjects() {
        Map<String, Object> actual = new java.util.HashMap<>(
                (Map<String, Object>) ContractShape.fixture("credito-solicitud-detalle"));
        actual.put("datosPersonales", Map.of("cualquierClave", "cualquierValor"));
        assertThatCode(() -> ContractShape.assertMatches("credito-solicitud-detalle", actual,
                Set.of("datosPersonales", "datosContacto", "datosLaborales", "datosFinancieros", "datosBancarios",
                        "declaraciones", "evidenciaAceptacion"))).doesNotThrowAnyException();
    }
}
