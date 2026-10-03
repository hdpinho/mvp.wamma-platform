package com.wamma.support;

import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.fail;

/**
 * Compara la forma de una respuesta real de la API con un archivo de {@code src/test/resources/contratos/}, el mismo
 * que la web pasa por sus adaptadores. «Forma» es el conjunto de claves (con su ruta) y el tipo de cada una: texto,
 * número, booleano, objeto o lista. Los valores no cuentan.
 * <p>
 * Un {@code null} no dice su tipo, así que en ese lado solo cuenta que la clave exista. Las listas se comparan por su
 * primer elemento, y solo si las dos lo tienen. Las rutas {@code opacas} son mapas libres (el expediente del crédito):
 * se exige que sean objetos, pero no se mira su contenido.
 */
public final class ContractShape {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ContractShape() {
    }

    /** Carga un archivo de contrato como mapas, listas y valores simples. */
    public static Object fixture(String name) {
        try (InputStream in = ContractShape.class.getResourceAsStream("/contratos/" + name + ".json")) {
            if (in == null) {
                throw new IllegalArgumentException("Falta el contrato contratos/" + name + ".json");
            }
            return MAPPER.readValue(in, Object.class);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer el contrato " + name, e);
        }
    }

    /** Falla con la lista de claves que faltan, sobran o cambiaron de tipo. */
    public static void assertMatches(String name, Object actual, Set<String> opaquePaths) {
        List<String> problems = new ArrayList<>();
        compare(actual, fixture(name), "", opaquePaths, problems);
        if (!problems.isEmpty()) {
            fail("La respuesta no coincide con el contrato «" + name + "»:\n  - " + String.join("\n  - ", problems));
        }
    }

    public static void assertMatches(String name, Object actual) {
        assertMatches(name, actual, Set.of());
    }

    private static void compare(Object actual, Object expected, String path, Set<String> opaque, List<String> problems) {
        if (expected instanceof Map<?, ?> expectedMap) {
            if (!(actual instanceof Map<?, ?> actualMap)) {
                problems.add(label(path) + ": la respuesta no es un objeto");
                return;
            }
            for (Object key : expectedMap.keySet()) {
                if (!actualMap.containsKey(key)) {
                    problems.add(child(path, key) + ": falta en la respuesta");
                }
            }
            for (Object key : actualMap.keySet()) {
                if (!expectedMap.containsKey(key)) {
                    problems.add(child(path, key) + ": sobra en la respuesta");
                }
            }
            for (Map.Entry<?, ?> entry : expectedMap.entrySet()) {
                if (!actualMap.containsKey(entry.getKey())) {
                    continue;
                }
                String childPath = child(path, entry.getKey());
                Object actualChild = actualMap.get(entry.getKey());
                Object expectedChild = entry.getValue();
                String actualType = typeOf(actualChild);
                String expectedType = typeOf(expectedChild);
                if (!"?".equals(actualType) && !"?".equals(expectedType) && !actualType.equals(expectedType)) {
                    problems.add(childPath + ": es " + actualType + " en la respuesta y " + expectedType + " en el contrato");
                    continue;
                }
                if (!opaque.contains(childPath)) {
                    compare(actualChild, expectedChild, childPath, opaque, problems);
                }
            }
        } else if (expected instanceof List<?> expectedList && actual instanceof List<?> actualList
                && !expectedList.isEmpty() && !actualList.isEmpty()) {
            compare(actualList.getFirst(), expectedList.getFirst(), path + "[]", opaque, problems);
        }
    }

    private static String child(String path, Object key) {
        return path.isEmpty() ? String.valueOf(key) : path + "." + key;
    }

    private static String label(String path) {
        return path.isEmpty() ? "(raíz)" : path;
    }

    private static String typeOf(Object value) {
        if (value == null) return "?";
        if (value instanceof Map<?, ?>) return "objeto";
        if (value instanceof List<?>) return "lista";
        if (value instanceof Number) return "numero";
        if (value instanceof Boolean) return "booleano";
        return "texto";
    }
}
