-- ==============================================================================
-- WAMMA PLATFORM — V0022: la evidencia de inspección guarda la clave, no la URL
-- Spec 011 §6.5 y D-43. Paso 8 del orden de la sección 7 de ese spec.
-- Nació como V0018 en el PR #1; se portó a main con este número y sin la parte de
-- recaudos (D-66): V0019 ya renombró solicitud_recaudo.archivo_url a archivo_clave.
--
-- Sigue el precedente de V0014, que ya hizo lo mismo con las fotos de la vitrina
-- (`publicacion_foto.url` -> `clave`): la base guarda la clave del objeto y la URL se
-- arma al leer, con la configuración vigente. Así cambiar de proveedor de
-- almacenamiento no obliga a reescribir filas (Principio II).
-- ==============================================================================

-- ── Guarda: no renombrar a ciegas sobre datos existentes ──────────────────────
-- El backend todavía no guarda evidencias de inspección (los puntos sembrados no
-- llevan foto), así que la columna debería estar vacía. Si no lo estuviera, un
-- renombrado a secas dejaría URL completas en una columna que el código leerá como
-- clave, y las direcciones resultantes serían inválidas sin que nada lo avise.
--
-- Por eso esto aborta en vez de continuar: el fallo de una migración se ve, y una
-- columna mal interpretada no. Si llegara a saltar, hay que añadir aquí el paso de
-- transformación que recorte el prefijo público antes de renombrar (D-43).
DO $$
DECLARE
    evidencias BIGINT;
BEGIN
    SELECT count(*) INTO evidencias FROM inspeccion_punto WHERE evidencia_url IS NOT NULL;

    IF evidencias > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'raise_exception',
            MESSAGE = format('V0022 no puede renombrar a ciegas: hay %s evidencia(s) con valor.', evidencias),
            HINT = 'Añade a esta migración la transformación que extrae la clave de la URL '
                   '(recortar la base pública) y vuelve a aplicarla. Ver spec 011 §6.5, D-43.';
    END IF;
END $$;

-- ── Renombrado ────────────────────────────────────────────────────────────────
ALTER TABLE inspeccion_punto RENAME COLUMN evidencia_url TO evidencia_clave;

COMMENT ON COLUMN inspeccion_punto.evidencia_clave IS
    'Clave del objeto en el almacén, no la URL. La URL se arma al leer (spec 011 §6.5).';
