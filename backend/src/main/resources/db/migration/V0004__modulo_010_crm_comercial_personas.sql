-- ==============================================================================
-- WAMMA PLATFORM — V0004: Módulo 010 (CRM Comercial, Personas y Oportunidades)
-- Conforme a la Constitución (Principio I) y specs/010-crm-comercial
-- ==============================================================================

-- 13. Personas (Raíz comercial, deduplicada, PII cifrada con blind index)
CREATE TABLE IF NOT EXISTS persona (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_apellido VARCHAR(150) NOT NULL,
    cedula_cifrada VARCHAR(255),
    indice_ciego_cedula VARCHAR(64) UNIQUE,
    telefono_whatsapp_cifrado VARCHAR(255) NOT NULL,
    indice_ciego_telefono VARCHAR(64) NOT NULL,
    telefonos_adicionales TEXT[],
    correo_cifrado VARCHAR(255),
    indice_ciego_correo VARCHAR(64),
    canal_origen VARCHAR(40) NOT NULL CHECK (canal_origen IN ('vitrina_web', 'whatsapp', 'visita_sede', 'referido', 'otro')),
    asesor_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'fusionado', 'bloqueado')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_persona_actualizado_en
BEFORE UPDATE ON persona
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE INDEX idx_persona_ciego_telefono ON persona(indice_ciego_telefono);
CREATE INDEX idx_persona_ciego_correo ON persona(indice_ciego_correo);
CREATE INDEX idx_persona_asesor ON persona(asesor_id);

-- 14. Fusión de Personas (Inmutable / Append-Only)
CREATE TABLE IF NOT EXISTS fusion_persona (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_sobreviviente_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    copia_absorbida_json JSONB NOT NULL,
    oportunidad_ids UUID[] NOT NULL DEFAULT '{}',
    cita_ids UUID[] NOT NULL DEFAULT '{}',
    interaccion_ids UUID[] NOT NULL DEFAULT '{}',
    fusionada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    fusionada_por UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT
);

CREATE OR REPLACE TRIGGER trg_fusion_persona_inmutable
BEFORE UPDATE OR DELETE ON fusion_persona
FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE INDEX idx_fusion_persona_sobreviviente ON fusion_persona(persona_sobreviviente_id);

-- 15. Catálogo de Etapas del Embudo
CREATE TABLE IF NOT EXISTS catalogo_etapa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(40) NOT NULL UNIQUE,
    nombre VARCHAR(80) NOT NULL,
    orden SMALLINT NOT NULL,
    es_terminal BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true
);

-- Cargar etapas iniciales estándar del embudo WAMMA
INSERT INTO catalogo_etapa (codigo, nombre, orden, es_terminal) VALUES
('contacto_inicial', 'Contacto Inicial', 1, false),
('cita_agendada', 'Cita Agendada', 2, false),
('visita_realizada', 'Visita Realizada', 3, false),
('negociacion', 'En Negociación', 4, false),
('solicitud_credito', 'Solicitud de Crédito', 5, false),
('cerrado_ganado', 'Cerrado Ganado (Venta)', 6, true),
('cerrado_perdido', 'Cerrado Perdido', 7, true)
ON CONFLICT (codigo) DO NOTHING;

-- 16. Catálogo de Motivos de Pérdida
CREATE TABLE IF NOT EXISTS catalogo_motivo_perdida (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(40) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    exige_texto BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO catalogo_motivo_perdida (codigo, nombre, exige_texto) VALUES
('precio_alto', 'Precio Fuera de Presupuesto', false),
('credito_rechazado', 'No Calificó para Financiamiento', false),
('compro_otro_vehiculo', 'Compró Otro Vehículo', false),
('desistio_sin_motivo', 'Desistió / No Responde', true),
('vehiculo_no_gusto', 'Vehículo no Cumplió Expectativas', false)
ON CONFLICT (codigo) DO NOTHING;

-- 17. Oportunidades Comerciales
CREATE TABLE IF NOT EXISTS oportunidad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    vehiculo_id UUID NOT NULL REFERENCES vehiculo(id) ON DELETE RESTRICT,
    etapa_id UUID NOT NULL REFERENCES catalogo_etapa(id) ON DELETE RESTRICT,
    modalidad_pago VARCHAR(25) NOT NULL CHECK (modalidad_pago IN ('contado', 'financiamiento')),
    valor_estimado NUMERIC(18, 2) NOT NULL CHECK (valor_estimado > 0),
    moneda VARCHAR(3) NOT NULL DEFAULT 'USD',
    tasa_bcv NUMERIC(14, 4) NOT NULL CHECK (tasa_bcv > 0),
    asesor_id UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    proxima_accion VARCHAR(150),
    proxima_accion_fecha DATE,
    motivo_perdida_id UUID REFERENCES catalogo_motivo_perdida(id) ON DELETE RESTRICT,
    detalle_perdida TEXT,
    solicitud_credito_id UUID, -- Puntero desacoplado
    enlace_financiamiento_token VARCHAR(128),
    enlace_emitido_en TIMESTAMPTZ,
    cerrado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_oportunidad_actualizado_en
BEFORE UPDATE ON oportunidad
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE INDEX idx_oportunidad_persona ON oportunidad(persona_id);
CREATE INDEX idx_oportunidad_vehiculo ON oportunidad(vehiculo_id);
CREATE INDEX idx_oportunidad_asesor ON oportunidad(asesor_id);
CREATE INDEX idx_oportunidad_etapa ON oportunidad(etapa_id);

-- 18. Historial de Interacciones (Inmutable / Append-Only)
CREATE TABLE IF NOT EXISTS interaccion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    oportunidad_id UUID REFERENCES oportunidad(id) ON DELETE SET NULL,
    canal VARCHAR(30) NOT NULL CHECK (canal IN ('whatsapp', 'llamada', 'visita_sede', 'email')),
    direccion VARCHAR(20) NOT NULL CHECK (direccion IN ('entrante', 'saliente')),
    nota TEXT NOT NULL,
    autor_id UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    corrige_interaccion_id UUID REFERENCES interaccion(id) ON DELETE RESTRICT,
    ocurrido_en TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_interaccion_inmutable
BEFORE UPDATE OR DELETE ON interaccion
FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE INDEX idx_interaccion_persona ON interaccion(persona_id);
CREATE INDEX idx_interaccion_oportunidad ON interaccion(oportunidad_id);
CREATE INDEX idx_interaccion_ocurrido ON interaccion(ocurrido_en DESC);

-- 19. Historial de Etapas del Embudo (Inmutable / Append-Only)
CREATE TABLE IF NOT EXISTS etapa_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oportunidad_id UUID NOT NULL REFERENCES oportunidad(id) ON DELETE CASCADE,
    etapa_anterior_id UUID REFERENCES catalogo_etapa(id) ON DELETE RESTRICT,
    etapa_nueva_id UUID NOT NULL REFERENCES catalogo_etapa(id) ON DELETE RESTRICT,
    nota TEXT,
    actor_id UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_etapa_historial_inmutable
BEFORE UPDATE OR DELETE ON etapa_historial
FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE INDEX idx_etapa_historial_oportunidad ON etapa_historial(oportunidad_id, creado_en);

-- 20. Citas de Inspección / Visitas en Sede
CREATE TABLE IF NOT EXISTS cita_inspeccion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    vehiculo_id UUID REFERENCES vehiculo(id) ON DELETE SET NULL,
    sede_id UUID NOT NULL REFERENCES sede(id) ON DELETE RESTRICT,
    fecha_hora TIMESTAMPTZ NOT NULL,
    tipo_cita VARCHAR(30) NOT NULL CHECK (tipo_cita IN ('visita_vitrina', 'entrega_auto_venta')),
    estado VARCHAR(25) NOT NULL DEFAULT 'programada' CHECK (estado IN ('programada', 'asistio', 'cancelada', 'reprogramada')),
    notas TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cita_persona ON cita_inspeccion(persona_id);
CREATE INDEX idx_cita_fecha ON cita_inspeccion(fecha_hora);
CREATE INDEX idx_cita_sede ON cita_inspeccion(sede_id);
