-- ==============================================================================
-- WAMMA PLATFORM — V0006: Módulo 006 & FIN-001 (Solicitud de Crédito, Scoring y AML)
-- Conforme a specs/solicitud-credito y specs/006-motor-riesgo-scoring-aml
-- ==============================================================================

-- 25. Solicitud de Crédito Digital (Forma WMA-F-FIN-001)
CREATE TABLE IF NOT EXISTS solicitud_credito (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_solicitud VARCHAR(30) NOT NULL UNIQUE,
    oportunidad_id UUID NOT NULL REFERENCES oportunidad(id) ON DELETE RESTRICT,
    persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    vehiculo_id UUID NOT NULL REFERENCES vehiculo(id) ON DELETE RESTRICT,
    monto_solicitado NUMERIC(18, 2) NOT NULL CHECK (monto_solicitado > 0),
    cuota_inicial NUMERIC(18, 2) NOT NULL CHECK (cuota_inicial >= 0),
    plazo_meses SMALLINT NOT NULL CHECK (plazo_meses IN (6, 12, 18, 24)),
    moneda VARCHAR(3) NOT NULL DEFAULT 'USD',
    tasa_bcv NUMERIC(14, 4) NOT NULL CHECK (tasa_bcv > 0),
    fecha_tasa TIMESTAMPTZ NOT NULL,
    datos_laborales_json JSONB NOT NULL,
    datos_financieros_json JSONB NOT NULL,
    capacidad_pago_mensual NUMERIC(18, 2) NOT NULL CHECK (capacidad_pago_mensual >= 0),
    estado VARCHAR(30) NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviada', 'en_evaluacion', 'aprobada', 'rechazada', 'condicionada', 'desembolsada')),
    enviada_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_solicitud_credito_actualizado_en
BEFORE UPDATE ON solicitud_credito
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE INDEX idx_solicitud_numero ON solicitud_credito(numero_solicitud);
CREATE INDEX idx_solicitud_persona ON solicitud_credito(persona_id);
CREATE INDEX idx_solicitud_oportunidad ON solicitud_credito(oportunidad_id);
CREATE INDEX idx_solicitud_estado ON solicitud_credito(estado);

-- 26. Recaudos y Expediente Digital
CREATE TABLE IF NOT EXISTS solicitud_recaudo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES solicitud_credito(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(50) NOT NULL CHECK (tipo_documento IN ('cedula_identidad', 'rif', 'constancia_trabajo', 'extracto_bancario', 'otro')),
    archivo_url TEXT NOT NULL,
    estado_validacion VARCHAR(25) NOT NULL DEFAULT 'pendiente' CHECK (estado_validacion IN ('pendiente', 'conforme', 'ilegible', 'rechazado')),
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_solicitud_recaudo_solicitud ON solicitud_recaudo(solicitud_id);

-- 27. Decisión de Riesgo y Scoring
CREATE TABLE IF NOT EXISTS decision_riesgo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL UNIQUE REFERENCES solicitud_credito(id) ON DELETE RESTRICT,
    score_interno INT NOT NULL CHECK (score_interno >= 0 AND score_interno <= 1000),
    score_buro INT,
    riesgo_nivel VARCHAR(20) NOT NULL CHECK (riesgo_nivel IN ('bajo', 'medio', 'alto', 'no_asegurable')),
    resultado VARCHAR(25) NOT NULL CHECK (resultado IN ('aprobado', 'rechazado', 'condicionado')),
    limite_aprobado NUMERIC(18, 2),
    cuota_maxima_permitida NUMERIC(18, 2),
    justificacion TEXT NOT NULL,
    evaluado_por UUID REFERENCES usuario(id) ON DELETE SET NULL,
    evaluado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_decision_riesgo_solicitud ON decision_riesgo(solicitud_id);
CREATE INDEX idx_decision_riesgo_resultado ON decision_riesgo(resultado);

-- 28. Alertas AML y Prevención de Legitimación de Capitales
CREATE TABLE IF NOT EXISTS alerta_aml (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES solicitud_credito(id) ON DELETE RESTRICT,
    persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    regla_coincidencia VARCHAR(100) NOT NULL,
    severidad VARCHAR(20) NOT NULL CHECK (severidad IN ('informativa', 'media', 'bloqueante')),
    origen_lista VARCHAR(50) NOT NULL CHECK (origen_lista IN ('OFAC', 'PEP_NACIONAL', 'INTERPOL', 'INTERNO')),
    revisado_por UUID REFERENCES usuario(id) ON DELETE SET NULL,
    resolucion VARCHAR(25) DEFAULT 'pendiente' CHECK (resolucion IN ('pendiente', 'falso_positivo', 'confirmado_bloqueado')),
    notas TEXT,
    resuelto_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerta_aml_solicitud ON alerta_aml(solicitud_id);
CREATE INDEX idx_alerta_aml_persona ON alerta_aml(persona_id);
CREATE INDEX idx_alerta_aml_resolucion ON alerta_aml(resolucion);
