-- ==============================================================================
-- WAMMA PLATFORM — V0015: Parámetros Oficiales de Financiamiento
-- Conforme a la política comercial aprobada (plazo 24m, 4% mensual, cuota fija)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS parametros_financiamiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tasa_mensual NUMERIC(6, 4) NOT NULL CHECK (tasa_mensual >= 0),
    plazo_meses INT NOT NULL CHECK (plazo_meses > 0),
    ratio_cuota_ingreso NUMERIC(4, 2) NOT NULL CHECK (ratio_cuota_ingreso > 0 AND ratio_cuota_ingreso <= 1),
    opciones_inicial NUMERIC(4, 2)[] NOT NULL,
    inicial_minima NUMERIC(4, 2) NOT NULL CHECK (inicial_minima > 0 AND inicial_minima <= 1),
    moneda_base VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (moneda_base IN ('USD', 'EUR', 'VES')),
    vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Disparador para mantener actualizado_en
CREATE OR REPLACE TRIGGER trg_parametros_financiamiento_actualizado_en
BEFORE UPDATE ON parametros_financiamiento
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- Inserción de la política comercial aprobada
INSERT INTO parametros_financiamiento (
    tasa_mensual,
    plazo_meses,
    ratio_cuota_ingreso,
    opciones_inicial,
    inicial_minima,
    moneda_base,
    vigente_desde,
    activo
) VALUES (
    0.0400,
    24,
    0.30,
    ARRAY[0.20, 0.30, 0.40],
    0.20,
    'USD',
    now(),
    true
);

-- Habilitar RLS
ALTER TABLE parametros_financiamiento ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública: cualquier cliente puede leer los parámetros activos
CREATE POLICY parametros_financiamiento_lectura_publica
    ON parametros_financiamiento
    FOR SELECT
    USING (activo = true);
