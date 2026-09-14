-- ==============================================================================
-- WAMMA PLATFORM — V0011: Trazabilidad monetaria y cifras sin confirmar
-- Constitución: Principio V (multi-moneda USD/VES con tasa BCV y su fecha; sin float)
-- y la regla de no inventar cifras (CLAUDE.md, AGENTS.md).
-- ==============================================================================

-- ── 1. Precisión de la tasa ────────────────────────────────────────────────────
-- NUMERIC(14,4) redondearía cualquier tasa publicada con más de cuatro decimales.
-- NUMERIC(18,8) la conserva tal como se publique; redondear es decisión de la aplicación.
ALTER TABLE tasa_cambio_bcv   ALTER COLUMN tasa_usd_ves         TYPE NUMERIC(18, 8);
ALTER TABLE vehiculo          ALTER COLUMN tasa_bcv_adquisicion TYPE NUMERIC(18, 8);
ALTER TABLE oportunidad       ALTER COLUMN tasa_bcv             TYPE NUMERIC(18, 8);
ALTER TABLE publicacion       ALTER COLUMN tasa_bcv             TYPE NUMERIC(18, 8);
ALTER TABLE reserva           ALTER COLUMN tasa_bcv             TYPE NUMERIC(18, 8);
ALTER TABLE solicitud_credito ALTER COLUMN tasa_bcv             TYPE NUMERIC(18, 8);
ALTER TABLE cuota             ALTER COLUMN tasa_bcv             TYPE NUMERIC(18, 8);
ALTER TABLE pago              ALTER COLUMN tasa_bcv             TYPE NUMERIC(18, 8);
ALTER TABLE linea_asiento     ALTER COLUMN tasa_bcv             TYPE NUMERIC(18, 8);

-- ── 2. Fecha de la tasa donde faltaba, siempre como DATE ───────────────────────
-- La tasa BCV es un valor diario (tasa_cambio_bcv.fecha es DATE): la fecha de la tasa
-- aplicada se guarda igual en todas las tablas.
ALTER TABLE vehiculo    ADD COLUMN IF NOT EXISTS fecha_tasa_adquisicion DATE NOT NULL;
ALTER TABLE oportunidad ADD COLUMN IF NOT EXISTS fecha_tasa DATE NOT NULL;
ALTER TABLE reserva     ADD COLUMN IF NOT EXISTS fecha_tasa DATE NOT NULL;
ALTER TABLE cuota       ADD COLUMN IF NOT EXISTS fecha_tasa DATE NOT NULL;

ALTER TABLE publicacion       ALTER COLUMN fecha_tasa TYPE DATE USING fecha_tasa::date;
ALTER TABLE solicitud_credito ALTER COLUMN fecha_tasa TYPE DATE USING fecha_tasa::date;
ALTER TABLE pago              ALTER COLUMN fecha_tasa TYPE DATE USING fecha_tasa::date;
ALTER TABLE linea_asiento     ALTER COLUMN fecha_tasa TYPE DATE USING fecha_tasa::date;

-- ── 3. Montos que no registraban moneda ni tasa ────────────────────────────────
ALTER TABLE credito
    ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) NOT NULL,
    ADD COLUMN IF NOT EXISTS tasa_bcv NUMERIC(18, 8) NOT NULL,
    ADD COLUMN IF NOT EXISTS fecha_tasa DATE NOT NULL;
ALTER TABLE credito DROP CONSTRAINT IF EXISTS credito_tasa_bcv_check;
ALTER TABLE credito ADD CONSTRAINT credito_tasa_bcv_check CHECK (tasa_bcv > 0);

ALTER TABLE conciliacion
    ADD COLUMN IF NOT EXISTS moneda VARCHAR(3) NOT NULL,
    ADD COLUMN IF NOT EXISTS tasa_bcv NUMERIC(18, 8) NOT NULL,
    ADD COLUMN IF NOT EXISTS fecha_tasa DATE NOT NULL;
ALTER TABLE conciliacion DROP CONSTRAINT IF EXISTS conciliacion_tasa_bcv_check;
ALTER TABLE conciliacion ADD CONSTRAINT conciliacion_tasa_bcv_check CHECK (tasa_bcv > 0);

-- Límite y cuota máxima son opcionales; si hay monto, hay moneda, tasa y fecha.
ALTER TABLE decision_riesgo
    ADD COLUMN IF NOT EXISTS moneda VARCHAR(3),
    ADD COLUMN IF NOT EXISTS tasa_bcv NUMERIC(18, 8),
    ADD COLUMN IF NOT EXISTS fecha_tasa DATE;
ALTER TABLE decision_riesgo DROP CONSTRAINT IF EXISTS decision_riesgo_trazabilidad_check;
ALTER TABLE decision_riesgo ADD CONSTRAINT decision_riesgo_trazabilidad_check CHECK (
    (limite_aprobado IS NULL AND cuota_maxima_permitida IS NULL)
    OR (moneda IS NOT NULL AND tasa_bcv IS NOT NULL AND tasa_bcv > 0 AND fecha_tasa IS NOT NULL)
);

-- ── 4. Solo USD o VES ───────────────────────────────────────────────────────────
-- pago ya lo tenía (pago_moneda_check).
ALTER TABLE vehiculo DROP CONSTRAINT IF EXISTS vehiculo_moneda_adquisicion_check;
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_moneda_adquisicion_check CHECK (moneda_adquisicion IN ('USD', 'VES'));
ALTER TABLE oportunidad DROP CONSTRAINT IF EXISTS oportunidad_moneda_check;
ALTER TABLE oportunidad ADD CONSTRAINT oportunidad_moneda_check CHECK (moneda IN ('USD', 'VES'));
ALTER TABLE publicacion DROP CONSTRAINT IF EXISTS publicacion_moneda_check;
ALTER TABLE publicacion ADD CONSTRAINT publicacion_moneda_check CHECK (moneda IN ('USD', 'VES'));
ALTER TABLE reserva DROP CONSTRAINT IF EXISTS reserva_moneda_check;
ALTER TABLE reserva ADD CONSTRAINT reserva_moneda_check CHECK (moneda IN ('USD', 'VES'));
ALTER TABLE solicitud_credito DROP CONSTRAINT IF EXISTS solicitud_credito_moneda_check;
ALTER TABLE solicitud_credito ADD CONSTRAINT solicitud_credito_moneda_check CHECK (moneda IN ('USD', 'VES'));
ALTER TABLE credito DROP CONSTRAINT IF EXISTS credito_moneda_check;
ALTER TABLE credito ADD CONSTRAINT credito_moneda_check CHECK (moneda IN ('USD', 'VES'));
ALTER TABLE cuota DROP CONSTRAINT IF EXISTS cuota_moneda_check;
ALTER TABLE cuota ADD CONSTRAINT cuota_moneda_check CHECK (moneda IN ('USD', 'VES'));
ALTER TABLE linea_asiento DROP CONSTRAINT IF EXISTS linea_asiento_moneda_check;
ALTER TABLE linea_asiento ADD CONSTRAINT linea_asiento_moneda_check CHECK (moneda IN ('USD', 'VES'));
ALTER TABLE conciliacion DROP CONSTRAINT IF EXISTS conciliacion_moneda_check;
ALTER TABLE conciliacion ADD CONSTRAINT conciliacion_moneda_check CHECK (moneda IN ('USD', 'VES'));
ALTER TABLE decision_riesgo DROP CONSTRAINT IF EXISTS decision_riesgo_moneda_check;
ALTER TABLE decision_riesgo ADD CONSTRAINT decision_riesgo_moneda_check CHECK (moneda IN ('USD', 'VES'));
ALTER TABLE cuenta_contable DROP CONSTRAINT IF EXISTS cuenta_contable_moneda_check;
ALTER TABLE cuenta_contable ADD CONSTRAINT cuenta_contable_moneda_check CHECK (moneda IN ('USD', 'VES'));

-- ── 5. Cifras y supuestos que nadie confirmó ───────────────────────────────────
-- Una semilla o un valor por defecto se usa en silencio: es la peor forma de inventar
-- un dato. Lo que falta queda como [NEEDS CLARIFICATION] en el spec de cada módulo.

-- Tasa BCV «oficial» de 40,5 fechada el día de la migración: no es una tasa real.
DELETE FROM tasa_cambio_bcv
WHERE tasa_usd_ves = 40.5 AND fuente = 'BCV_OFICIAL' AND capturado_por IS NULL;
-- Cada tasa declara su fuente.
ALTER TABLE tasa_cambio_bcv ALTER COLUMN fuente DROP DEFAULT;

-- Plan de cuentas: lo define contabilidad (spec 007). La propuesta sembrada en V0007
-- queda en specs/000-overview/database-schema-design.md para su revisión.
DELETE FROM cuenta_contable
WHERE codigo IN ('1', '1.1', '1.1.1', '1.1.1.01', '1.1.2', '1.1.2.01', '1.1.2.02',
                 '2', '2.1', '2.1.1', '4', '4.1', '4.1.1', '4.1.2');

-- Tasas de interés del 48 % anual y 4 % mensual por defecto: el spec 007 no las define.
ALTER TABLE credito ALTER COLUMN tasa_interes_anual DROP DEFAULT;
ALTER TABLE credito ALTER COLUMN tasa_interes_mensual DROP DEFAULT;

-- Plazos de 6/12/18/24 meses: [NEEDS CLARIFICATION: P6 — plazos de financiamiento].
ALTER TABLE credito DROP CONSTRAINT IF EXISTS credito_plazo_meses_check;
ALTER TABLE credito ADD CONSTRAINT credito_plazo_meses_check CHECK (plazo_meses > 0);
ALTER TABLE solicitud_credito DROP CONSTRAINT IF EXISTS solicitud_credito_plazo_meses_check;
ALTER TABLE solicitud_credito ADD CONSTRAINT solicitud_credito_plazo_meses_check CHECK (plazo_meses > 0);

-- Garantía de 3 meses / 5.000 km: [NEEDS CLARIFICATION: condiciones de garantía] (spec 005).
ALTER TABLE publicacion ALTER COLUMN garantia_meses DROP DEFAULT;
ALTER TABLE publicacion ALTER COLUMN kilometraje_garantia DROP DEFAULT;

-- Un pago o una reserva no nacen confirmados: su estado lo declara quien los registra,
-- después de verificarlos.
ALTER TABLE pago ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE reserva ALTER COLUMN estado DROP DEFAULT;

-- Atributos del vehículo: se registran, no se suponen. El rango 1990–2035 era una
-- regla de negocio inventada, y con fecha de caducidad.
ALTER TABLE vehiculo ALTER COLUMN puestos DROP DEFAULT;
ALTER TABLE vehiculo ALTER COLUMN traccion DROP DEFAULT;
ALTER TABLE vehiculo DROP CONSTRAINT IF EXISTS vehiculo_anio_check;
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_anio_check CHECK (anio >= 1900);
