-- ==============================================================================
-- WAMMA PLATFORM — V0017: CRM moneda EUR/VES y reserva con vencimiento
-- Conforme a specs/010-crm-comercial/plan.md §3 y tareas B1
-- ==============================================================================

-- ── 1. Moneda de la oportunidad en EUR o VES ──────────────────────────────────
-- Falla si encuentra oportunidades en USD, en vez de convertirlas en silencio.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM oportunidad WHERE moneda = 'USD') THEN
        RAISE EXCEPTION 'Hay oportunidades en USD. No se pueden migrar automáticamente a EUR/VES.';
    END IF;
END $$;

ALTER TABLE oportunidad ALTER COLUMN moneda SET DEFAULT 'EUR';
ALTER TABLE oportunidad DROP CONSTRAINT IF EXISTS oportunidad_moneda_check;
ALTER TABLE oportunidad ADD CONSTRAINT oportunidad_moneda_check CHECK (moneda IN ('EUR', 'VES'));

-- ── 2. Cita de inspección: reserva temporal de 24 horas (E4-A) ─────────────────
ALTER TABLE cita_inspeccion ADD COLUMN IF NOT EXISTS reserva_vence_en TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_cita_reserva_activa
    ON cita_inspeccion (reserva_vence_en) WHERE reserva_vence_en IS NOT NULL;

-- Sede opcional en citas: si no se especifica, se vincula a la sede del vehículo
ALTER TABLE cita_inspeccion ALTER COLUMN sede_id DROP NOT NULL;
