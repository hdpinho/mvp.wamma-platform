-- ==============================================================================
-- WAMMA PLATFORM — V0018: Solicitud de Crédito Digital EUR (WMA-F-FIN-001)
-- Conforme a Constitución v3.0.0 (EUR moneda base) y decisión PO D-50
-- ==============================================================================

-- ── 1. Moneda EUR en Solicitud de Crédito y Decisión de Riesgo ────────────────
ALTER TABLE solicitud_credito ALTER COLUMN moneda SET DEFAULT 'EUR';
ALTER TABLE solicitud_credito DROP CONSTRAINT IF EXISTS solicitud_credito_moneda_check;
ALTER TABLE solicitud_credito ADD CONSTRAINT solicitud_credito_moneda_check CHECK (moneda IN ('EUR', 'VES', 'USD'));

ALTER TABLE decision_riesgo DROP CONSTRAINT IF EXISTS decision_riesgo_moneda_check;
ALTER TABLE decision_riesgo ADD CONSTRAINT decision_riesgo_moneda_check CHECK (moneda IN ('EUR', 'VES', 'USD'));

-- ── 2. Campos complementarios para expediente WMA-F-FIN-001 ───────────────────
ALTER TABLE solicitud_credito ADD COLUMN IF NOT EXISTS datos_personales_json JSONB;
ALTER TABLE solicitud_credito ADD COLUMN IF NOT EXISTS datos_contacto_json JSONB;
ALTER TABLE solicitud_credito ADD COLUMN IF NOT EXISTS referencias_json JSONB;
ALTER TABLE solicitud_credito ADD COLUMN IF NOT EXISTS datos_bancarios_json JSONB;
ALTER TABLE solicitud_credito ADD COLUMN IF NOT EXISTS declaraciones_json JSONB;
ALTER TABLE solicitud_credito ADD COLUMN IF NOT EXISTS evidencia_aceptacion_json JSONB;
ALTER TABLE solicitud_credito ADD COLUMN IF NOT EXISTS cuota_estimada NUMERIC(18, 2);
ALTER TABLE solicitud_credito ADD COLUMN IF NOT EXISTS frecuencia_pago VARCHAR(20) DEFAULT 'Mensual';

-- ── 3. Tipos de recaudos del asistente digital y metadatos de archivo ─────────
ALTER TABLE solicitud_recaudo DROP CONSTRAINT IF EXISTS solicitud_recaudo_tipo_documento_check;
ALTER TABLE solicitud_recaudo ADD CONSTRAINT solicitud_recaudo_tipo_documento_check
    CHECK (tipo_documento IN (
        'cedula', 'rif', 'ingresos', 'bancario', 'domicilio', 'referencias',
        'cedula_identidad', 'constancia_trabajo', 'extracto_bancario', 'otro'
    ));

ALTER TABLE solicitud_recaudo ADD COLUMN IF NOT EXISTS nombre_archivo VARCHAR(255);
ALTER TABLE solicitud_recaudo ADD COLUMN IF NOT EXISTS tamano_bytes BIGINT;
ALTER TABLE solicitud_recaudo ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_solicitud_recaudo_tipo ON solicitud_recaudo(tipo_documento);
