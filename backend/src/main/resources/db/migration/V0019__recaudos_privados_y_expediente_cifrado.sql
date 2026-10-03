-- ==============================================================================
-- WAMMA PLATFORM — V0019: recaudos en contenedor privado y expediente cifrado
-- Plan de remediación QA del 30-sep-2026, fase R1 (hallazgos S-05 y S-06), D-59.
--
-- 1. solicitud_recaudo guarda la CLAVE del objeto en el contenedor privado de recaudos, nunca
--    una URL: el backoffice lo abre con un enlace firmado de corta duración. Es el mismo nombre
--    de columna que usa la V0018 del PR #1 (spec 011, D-43). Al mezclar el PR #1, su migración
--    de renombrado debe omitir solicitud_recaudo, porque esta ya lo hizo.
-- 2. solicitud_credito deja de guardar el expediente WMA-F-FIN-001 en JSON legible: la
--    aplicación lo cifra entero con AES-256-GCM (plan 001 §7) en expediente_cifrado. Quien lea
--    la base sin la clave no ve ingresos, empleador, cuenta bancaria ni referencias.
-- ==============================================================================

-- ── Guarda: no transformar a ciegas datos existentes ─────────────────────────
-- Una URL pública no se convierte en clave privada, ni el JSON en claro se puede cifrar desde
-- SQL: la clave vive fuera de la base. Si hubiera filas, se aborta. El fallo de una migración
-- se ve; un expediente perdido o un recaudo huérfano, no.
DO $$
DECLARE
    solicitudes BIGINT;
    recaudos BIGINT;
BEGIN
    SELECT count(*) INTO solicitudes FROM solicitud_credito;
    SELECT count(*) INTO recaudos FROM solicitud_recaudo;

    IF solicitudes > 0 OR recaudos > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'raise_exception',
            MESSAGE = format(
                'V0019 no puede migrar a ciegas: hay %s solicitud(es) de crédito y %s recaudo(s).',
                solicitudes, recaudos),
            HINT = 'Antes de aplicarla hay que cifrar esos expedientes con la clave de la aplicación '
                   'y mover los archivos al contenedor privado. Ver el plan de remediación QA, fase R1.';
    END IF;
END $$;

-- ── 1. Recaudos: clave del contenedor privado ─────────────────────────────────
ALTER TABLE solicitud_recaudo RENAME COLUMN archivo_url TO archivo_clave;

ALTER TABLE solicitud_recaudo ADD CONSTRAINT solicitud_recaudo_archivo_clave_check
    CHECK (archivo_clave ~ '^recaudos/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$');

COMMENT ON COLUMN solicitud_recaudo.archivo_clave IS
    'Clave del objeto en el contenedor PRIVADO de recaudos, no una URL. Se abre con un enlace firmado de corta duración (D-59).';

-- ── 2. Expediente cifrado ─────────────────────────────────────────────────────
ALTER TABLE solicitud_credito ADD COLUMN expediente_cifrado BYTEA NOT NULL;

ALTER TABLE solicitud_credito
    DROP COLUMN datos_personales_json,
    DROP COLUMN datos_contacto_json,
    DROP COLUMN datos_laborales_json,
    DROP COLUMN datos_financieros_json,
    DROP COLUMN referencias_json,
    DROP COLUMN datos_bancarios_json,
    DROP COLUMN declaraciones_json,
    DROP COLUMN evidencia_aceptacion_json;

COMMENT ON COLUMN solicitud_credito.expediente_cifrado IS
    'Expediente WMA-F-FIN-001 completo, cifrado por la aplicación con AES-256-GCM: datos personales, contacto, laborales, financieros, referencias, bancarios, declaraciones y evidencia de aceptación.';
