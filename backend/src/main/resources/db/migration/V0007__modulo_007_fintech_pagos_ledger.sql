-- ==============================================================================
-- WAMMA PLATFORM — V0007: Módulo 007 (Fintech, Pagos, Cartera y Ledger Sagrado)
-- Conforme a la Constitución (Principio V: Ledger Sagrado y Partida Doble) y specs/007-fintech-pagos-ledger
-- ==============================================================================

-- 29. Plan Contable / Cuentas Contables
CREATE TABLE IF NOT EXISTS cuenta_contable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    tipo VARCHAR(25) NOT NULL CHECK (tipo IN ('activo', 'pasivo', 'patrimonio', 'ingreso', 'egreso')),
    naturaleza VARCHAR(10) NOT NULL CHECK (naturaleza IN ('deudora', 'acreedora')),
    nivel SMALLINT NOT NULL CHECK (nivel >= 1 AND nivel <= 5),
    cuenta_padre_id UUID REFERENCES cuenta_contable(id) ON DELETE RESTRICT,
    moneda VARCHAR(3) NOT NULL DEFAULT 'VES',
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cuenta_codigo ON cuenta_contable(codigo);

-- Cargar plan de cuentas base
INSERT INTO cuenta_contable (codigo, nombre, tipo, naturaleza, nivel) VALUES
('1', 'ACTIVO', 'activo', 'deudora', 1),
('1.1', 'Activo Corriente', 'activo', 'deudora', 2),
('1.1.1', 'Disponibilidades Bancarias', 'activo', 'deudora', 3),
('1.1.1.01', 'Bancos Nacionales (Pago Móvil / C2P)', 'activo', 'deudora', 4),
('1.1.2', 'Cartera de Créditos WAMMA', 'activo', 'deudora', 3),
('1.1.2.01', 'Créditos Vigentes por Cobrar', 'activo', 'deudora', 4),
('1.1.2.02', 'Créditos en Mora por Cobrar', 'activo', 'deudora', 4),
('2', 'PASIVO', 'pasivo', 'acreedora', 1),
('2.1', 'Pasivo Corriente', 'pasivo', 'acreedora', 2),
('2.1.1', 'Fondos de Clientes por Aplicar', 'pasivo', 'acreedora', 3),
('4', 'INGRESOS', 'ingreso', 'acreedora', 1),
('4.1', 'Ingresos Financieros', 'ingreso', 'acreedora', 2),
('4.1.1', 'Intereses Ganados sobre Financiamiento', 'ingreso', 'acreedora', 3),
('4.1.2', 'Intereses de Mora', 'ingreso', 'acreedora', 3)
ON CONFLICT (codigo) DO NOTHING;

-- 30. Asientos Contables (INMUTABLE / APPEND-ONLY)
CREATE TABLE IF NOT EXISTS asiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_asiento BIGSERIAL UNIQUE NOT NULL,
    transaccion_ref VARCHAR(100) NOT NULL,
    modulo_origen VARCHAR(40) NOT NULL CHECK (modulo_origen IN ('pagos', 'cartera', 'tesoreria', 'compras', 'ajuste')),
    descripcion TEXT NOT NULL,
    fecha_asiento DATE NOT NULL,
    compensa_asiento_id UUID REFERENCES asiento(id) ON DELETE RESTRICT,
    creado_por UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_asiento_inmutable
BEFORE UPDATE OR DELETE ON asiento
FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE INDEX idx_asiento_numero ON asiento(numero_asiento);
CREATE INDEX idx_asiento_fecha ON asiento(fecha_asiento);
CREATE INDEX idx_asiento_transaccion_ref ON asiento(transaccion_ref);

-- 31. Líneas del Asiento (INMUTABLE / APPEND-ONLY)
CREATE TABLE IF NOT EXISTS linea_asiento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asiento_id UUID NOT NULL REFERENCES asiento(id) ON DELETE RESTRICT,
    cuenta_id UUID NOT NULL REFERENCES cuenta_contable(id) ON DELETE RESTRICT,
    debe NUMERIC(18, 2) NOT NULL DEFAULT 0.00 CHECK (debe >= 0),
    haber NUMERIC(18, 2) NOT NULL DEFAULT 0.00 CHECK (haber >= 0),
    moneda VARCHAR(3) NOT NULL,
    tasa_bcv NUMERIC(14, 4) NOT NULL CHECK (tasa_bcv > 0),
    fecha_tasa TIMESTAMPTZ NOT NULL,
    descripcion_linea VARCHAR(200),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (debe > 0 OR haber > 0)
);

CREATE TRIGGER trg_linea_asiento_inmutable
BEFORE UPDATE OR DELETE ON linea_asiento
FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE INDEX idx_linea_asiento_asiento ON linea_asiento(asiento_id);
CREATE INDEX idx_linea_asiento_cuenta ON linea_asiento(cuenta_id);

-- 32. Crédito Activo
CREATE TABLE IF NOT EXISTS credito (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_credito VARCHAR(30) NOT NULL UNIQUE,
    solicitud_id UUID NOT NULL UNIQUE REFERENCES solicitud_credito(id) ON DELETE RESTRICT,
    persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    vehiculo_id UUID NOT NULL REFERENCES vehiculo(id) ON DELETE RESTRICT,
    principal NUMERIC(18, 2) NOT NULL CHECK (principal > 0),
    tasa_interes_anual NUMERIC(6, 4) NOT NULL DEFAULT 0.4800,
    tasa_interes_mensual NUMERIC(6, 4) NOT NULL DEFAULT 0.0400,
    plazo_meses SMALLINT NOT NULL CHECK (plazo_meses IN (6, 12, 18, 24)),
    fecha_inicio DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(25) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'en_mora', 'liquidado', 'castigado')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_credito_actualizado_en
BEFORE UPDATE ON credito
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE INDEX idx_credito_numero ON credito(numero_credito);
CREATE INDEX idx_credito_persona ON credito(persona_id);
CREATE INDEX idx_credito_estado ON credito(estado);

-- 33. Cuotas de la Tabla de Amortización
CREATE TABLE IF NOT EXISTS cuota (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credito_id UUID NOT NULL REFERENCES credito(id) ON DELETE RESTRICT,
    numero_cuota SMALLINT NOT NULL CHECK (numero_cuota >= 1),
    fecha_vencimiento DATE NOT NULL,
    capital NUMERIC(18, 2) NOT NULL CHECK (capital >= 0),
    interes NUMERIC(18, 2) NOT NULL CHECK (interes >= 0),
    mora NUMERIC(18, 2) NOT NULL DEFAULT 0.00 CHECK (mora >= 0),
    cuota_total NUMERIC(18, 2) NOT NULL CHECK (cuota_total > 0),
    saldo_remanente NUMERIC(18, 2) NOT NULL CHECK (saldo_remanente >= 0),
    moneda VARCHAR(3) NOT NULL DEFAULT 'USD',
    tasa_bcv NUMERIC(14, 4) NOT NULL CHECK (tasa_bcv > 0),
    estado VARCHAR(25) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'en_mora', 'anulada')),
    pagado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (credito_id, numero_cuota)
);

CREATE TRIGGER trg_cuota_actualizado_en
BEFORE UPDATE ON cuota
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE INDEX idx_cuota_credito_vencimiento ON cuota(credito_id, fecha_vencimiento);
CREATE INDEX idx_cuota_estado ON cuota(estado);

-- 34. Pagos Recibidos (C2P y Pago Móvil)
CREATE TABLE IF NOT EXISTS pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credito_id UUID NOT NULL REFERENCES credito(id) ON DELETE RESTRICT,
    cuota_id UUID REFERENCES cuota(id) ON DELETE SET NULL,
    monto_pagado NUMERIC(18, 2) NOT NULL CHECK (monto_pagado > 0),
    moneda VARCHAR(3) NOT NULL CHECK (moneda IN ('VES', 'USD')),
    tasa_bcv NUMERIC(14, 4) NOT NULL CHECK (tasa_bcv > 0),
    fecha_tasa TIMESTAMPTZ NOT NULL,
    canal_pago VARCHAR(30) NOT NULL CHECK (canal_pago IN ('c2p', 'pago_movil', 'transferencia')),
    referencia_bancaria VARCHAR(100) NOT NULL,
    origen_telefono VARCHAR(30),
    origen_banco VARCHAR(10),
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    estado VARCHAR(25) NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('confirmado', 'pendiente_conciliacion', 'rechazado')),
    asiento_id UUID REFERENCES asiento(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pago_credito ON pago(credito_id);
CREATE INDEX idx_pago_idempotency ON pago(idempotency_key);
CREATE INDEX idx_pago_referencia ON pago(referencia_bancaria);

-- 35. Conciliación Bancaria
CREATE TABLE IF NOT EXISTS conciliacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pago_id UUID NOT NULL UNIQUE REFERENCES pago(id) ON DELETE RESTRICT,
    extracto_bancario_ref VARCHAR(120) NOT NULL,
    monto_extracto NUMERIC(18, 2) NOT NULL CHECK (monto_extracto > 0),
    fecha_banco DATE NOT NULL,
    estado VARCHAR(25) NOT NULL DEFAULT 'conciliado' CHECK (estado IN ('conciliado', 'discrepancia')),
    conciliado_por UUID REFERENCES usuario(id) ON DELETE SET NULL,
    conciliado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conciliacion_pago ON conciliacion(pago_id);
