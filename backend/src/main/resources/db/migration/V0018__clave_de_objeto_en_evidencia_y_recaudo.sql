-- ==============================================================================
-- WAMMA PLATFORM — V0018: evidencia y recaudo guardan la clave, no la URL
-- Spec 011 §6.5 y D-43. Paso 8 del orden de la sección 7 de ese spec.
--
-- Sigue el precedente de V0014, que ya hizo lo mismo con las fotos de la vitrina
-- (`publicacion_foto.url` -> `clave`): la base guarda la clave del objeto y la URL se
-- arma al leer, con la configuración vigente. Así cambiar de proveedor de
-- almacenamiento no obliga a reescribir filas (Principio II).
-- ==============================================================================

-- ── Guarda: no renombrar a ciegas sobre datos existentes ──────────────────────
-- Los módulos 004 y de solicitud de crédito no están implementados, así que estas dos
-- columnas deberían estar vacías. Si no lo estuvieran, un renombrado a secas dejaría
-- URL completas en una columna que el código leerá como clave, y las direcciones
-- resultantes serían inválidas sin que nada lo avise.
--
-- Por eso esto aborta en vez de continuar: el fallo de una migración se ve, y una
-- columna mal interpretada no. Si llegara a saltar, hay que añadir aquí el paso de
-- transformación que recorte el prefijo público antes de renombrar (D-43).
DO $$
DECLARE
    evidencias BIGINT;
    recaudos BIGINT;
BEGIN
    SELECT count(*) INTO evidencias FROM inspeccion_punto WHERE evidencia_url IS NOT NULL;
    SELECT count(*) INTO recaudos FROM solicitud_recaudo WHERE archivo_url IS NOT NULL;

    IF evidencias > 0 OR recaudos > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'raise_exception',
            MESSAGE = format(
                'V0018 no puede renombrar a ciegas: hay %s evidencia(s) y %s recaudo(s) con valor.',
                evidencias, recaudos),
            HINT = 'Añade a esta migración la transformación que extrae la clave de la URL '
                   '(recortar la base pública) y vuelve a aplicarla. Ver spec 011 §6.5, D-43.';
    END IF;
END $$;

-- ── Renombrado ────────────────────────────────────────────────────────────────
ALTER TABLE inspeccion_punto RENAME COLUMN evidencia_url TO evidencia_clave;
ALTER TABLE solicitud_recaudo RENAME COLUMN archivo_url TO archivo_clave;

COMMENT ON COLUMN inspeccion_punto.evidencia_clave IS
    'Clave del objeto en el almacén, no la URL. La URL se arma al leer (spec 011 §6.5).';

-- Ojo al implementar el módulo: los recaudos van en contenedor PRIVADO (D-09), así que
-- esta clave NO se resuelve con la URL pública de las fotos, sino con una URL firmada.
COMMENT ON COLUMN solicitud_recaudo.archivo_clave IS
    'Clave del objeto en el almacén privado, no la URL. Se resuelve con URL firmada (D-09).';
