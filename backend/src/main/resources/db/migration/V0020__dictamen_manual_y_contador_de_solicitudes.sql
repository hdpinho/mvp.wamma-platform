-- ==============================================================================
-- WAMMA PLATFORM — V0020: dictamen manual, moneda base en euros y número de solicitud atómico
-- Remediación R3 (plan 30-sep-2026): D-63 (sin scoring ni puntaje obligatorio), Constitución v3.0.0
-- (el euro es la moneda base) y hallazgo C-11 (el número de solicitud se calculaba con MAX()+1).
-- ==============================================================================

-- ── 1. El dictamen del analista no exige puntaje ni nivel de riesgo (D-63) ────────────────
-- Los CHECK de rango siguen vigentes: un valor nulo los cumple y uno informado debe estar en rango.
ALTER TABLE decision_riesgo ALTER COLUMN score_interno DROP NOT NULL;
ALTER TABLE decision_riesgo ALTER COLUMN riesgo_nivel DROP NOT NULL;

-- ── 2. La política de financiamiento se expresa en euros ──────────────────────────────────
-- V0015 sembró la política con USD; la Constitución v3.0.0 (Principio V) fija el euro.
ALTER TABLE parametros_financiamiento ALTER COLUMN moneda_base SET DEFAULT 'EUR';
UPDATE parametros_financiamiento SET moneda_base = 'EUR' WHERE moneda_base = 'USD';

-- ── 3. Número de solicitud: un contador por año, incrementado de forma atómica ────────────
CREATE TABLE IF NOT EXISTS contador_solicitud (
    anio INT PRIMARY KEY CHECK (anio BETWEEN 2000 AND 9999),
    ultimo BIGINT NOT NULL CHECK (ultimo >= 0)
);

-- Arranca desde lo ya emitido, para no repetir ningún número existente.
INSERT INTO contador_solicitud (anio, ultimo)
SELECT CAST(SPLIT_PART(numero_solicitud, '-', 2) AS INT),
       MAX(CAST(SPLIT_PART(numero_solicitud, '-', 3) AS BIGINT))
FROM solicitud_credito
WHERE numero_solicitud ~ '^SOL-[0-9]{4}-[0-9]+$'
GROUP BY 1
ON CONFLICT (anio) DO NOTHING;

ALTER TABLE contador_solicitud ENABLE ROW LEVEL SECURITY;
