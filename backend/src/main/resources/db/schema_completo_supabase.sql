-- ==============================================================================
-- WAMMA PLATFORM — ESQUEMA COMPLETO PARA SUPABASE (POSTGRESQL 16+)
-- Modelo Relacional de 38 Tablas (Módulos 001 al 010)
-- Conforme a la Constitución y Mejores Prácticas DBA
-- ==============================================================================

-- 0. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0.1 Funciones Utilitarias y Triggers
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevenir_modificacion_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación denegada: Los registros en la tabla % son estrictamente inmutables (append-only).', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- DOMINIO 1: IDENTIDAD, ROLES Y AUDITORÍA (MÓDULO 001)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS usuario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('admin', 'oficial_cumplimiento', 'auditor', 'riesgo', 'inspector', 'asesor', 'operador')),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'bloqueado')),
    requiere_2fa BOOLEAN NOT NULL DEFAULT true,
    secreto_2fa_totp VARCHAR(128),
    ultimo_login TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_usuario_actualizado_en BEFORE UPDATE ON usuario FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);
CREATE INDEX IF NOT EXISTS idx_usuario_tipo_estado ON usuario(tipo, estado);

CREATE TABLE IF NOT EXISTS rol (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    ambito VARCHAR(50) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permiso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    modulo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
);
CREATE INDEX IF NOT EXISTS idx_permiso_modulo ON permiso(modulo);

CREATE TABLE IF NOT EXISTS usuario_rol (
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    rol_id UUID NOT NULL REFERENCES rol(id) ON DELETE RESTRICT,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    asignado_por UUID REFERENCES usuario(id),
    PRIMARY KEY (usuario_id, rol_id)
);
CREATE INDEX IF NOT EXISTS idx_usuario_rol_rol ON usuario_rol(rol_id);

CREATE TABLE IF NOT EXISTS rol_permiso (
    rol_id UUID NOT NULL REFERENCES rol(id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permiso(id) ON DELETE RESTRICT,
    PRIMARY KEY (rol_id, permiso_id)
);
CREATE INDEX IF NOT EXISTS idx_rol_permiso_permiso ON rol_permiso(permiso_id);

CREATE TABLE IF NOT EXISTS auditoria_evento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES usuario(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(60) NOT NULL,
    entidad_id UUID NOT NULL,
    antes JSONB,
    despues JSONB,
    ip_origen VARCHAR(45),
    user_agent TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_auditoria_evento_inmutable BEFORE UPDATE OR DELETE ON auditoria_evento FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria_evento(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_actor_fecha ON auditoria_evento(actor_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_evento(creado_en DESC);

CREATE TABLE IF NOT EXISTS secreto_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave VARCHAR(100) NOT NULL UNIQUE,
    referencia_vault VARCHAR(255) NOT NULL,
    descripcion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_secreto_config_actualizado_en BEFORE UPDATE ON secreto_config FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ==============================================================================
-- DOMINIO 2: INVENTARIO, INSPECCIÓN Y LEGAL (MÓDULO 004)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS sede (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT NOT NULL,
    ciudad VARCHAR(60) NOT NULL,
    estado_geografico VARCHAR(60) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehiculo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vin VARCHAR(17) NOT NULL UNIQUE,
    placa VARCHAR(10) NOT NULL UNIQUE,
    marca VARCHAR(50) NOT NULL,
    modelo VARCHAR(50) NOT NULL,
    version VARCHAR(50),
    anio SMALLINT NOT NULL CHECK (anio >= 1990 AND anio <= 2035),
    color VARCHAR(40) NOT NULL,
    kilometraje INT NOT NULL CHECK (kilometraje >= 0),
    carroceria VARCHAR(40),
    transmision VARCHAR(30) NOT NULL CHECK (transmision IN ('automatica', 'manual', 'secuencial')),
    combustible VARCHAR(30) NOT NULL CHECK (combustible IN ('gasolina', 'diesel', 'hibrido', 'electrico', 'gas')),
    traccion VARCHAR(20) DEFAULT '4x2',
    puestos SMALLINT DEFAULT 5 CHECK (puestos >= 1),
    estado VARCHAR(30) NOT NULL DEFAULT 'inspeccion' CHECK (estado IN ('inspeccion', 'reacondicionamiento', 'exhibicion', 'reservado', 'vendido', 'bloqueado_legal')),
    sede_id UUID NOT NULL REFERENCES sede(id) ON DELETE RESTRICT,
    precio_adquisicion NUMERIC(18, 2) NOT NULL CHECK (precio_adquisicion > 0),
    moneda_adquisicion VARCHAR(3) NOT NULL DEFAULT 'USD',
    tasa_bcv_adquisicion NUMERIC(14, 4) NOT NULL CHECK (tasa_bcv_adquisicion > 0),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_vehiculo_actualizado_en BEFORE UPDATE ON vehiculo FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE INDEX IF NOT EXISTS idx_vehiculo_vin ON vehiculo(vin);
CREATE INDEX IF NOT EXISTS idx_vehiculo_placa ON vehiculo(placa);
CREATE INDEX IF NOT EXISTS idx_vehiculo_estado ON vehiculo(estado);
CREATE INDEX IF NOT EXISTS idx_vehiculo_marca_modelo ON vehiculo(marca, modelo);
CREATE INDEX IF NOT EXISTS idx_vehiculo_sede ON vehiculo(sede_id);

CREATE TABLE IF NOT EXISTS inspeccion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES vehiculo(id) ON DELETE RESTRICT,
    inspector_id UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    estado VARCHAR(25) NOT NULL DEFAULT 'iniciada' CHECK (estado IN ('iniciada', 'en_progreso', 'completada', 'certificada', 'rechazada')),
    iniciado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizado_en TIMESTAMPTZ,
    puntaje_total SMALLINT CHECK (puntaje_total >= 0 AND puntaje_total <= 240),
    resultado VARCHAR(25) CHECK (resultado IN ('apto', 'no_apto', 'con_observaciones')),
    notas_generales TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inspeccion_vehiculo ON inspeccion(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_inspeccion_inspector ON inspeccion(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspeccion_estado ON inspeccion(estado);

CREATE TABLE IF NOT EXISTS inspeccion_punto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspeccion_id UUID NOT NULL REFERENCES inspeccion(id) ON DELETE CASCADE,
    codigo_punto VARCHAR(20) NOT NULL,
    categoria VARCHAR(30) NOT NULL CHECK (categoria IN ('mecanica', 'estetica', 'legal')),
    nombre_punto VARCHAR(150) NOT NULL,
    resultado VARCHAR(20) NOT NULL CHECK (resultado IN ('conforme', 'no_conforme', 'no_aplica')),
    severidad VARCHAR(20) CHECK (severidad IN ('leve', 'moderada', 'grave')),
    zona VARCHAR(30),
    posicion_x NUMERIC(5, 2),
    posicion_y NUMERIC(5, 2),
    evidencia_url TEXT,
    notas TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (inspeccion_id, codigo_punto)
);
CREATE INDEX IF NOT EXISTS idx_inspeccion_punto_inspeccion ON inspeccion_punto(inspeccion_id);
CREATE INDEX IF NOT EXISTS idx_inspeccion_punto_categoria ON inspeccion_punto(categoria);
CREATE INDEX IF NOT EXISTS idx_inspeccion_punto_resultado ON inspeccion_punto(resultado);

CREATE TABLE IF NOT EXISTS validacion_legal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES vehiculo(id) ON DELETE RESTRICT,
    analista_id UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    ocr_serial_carroceria VARCHAR(30) NOT NULL,
    ocr_serial_motor VARCHAR(30) NOT NULL,
    cruce_intt_status VARCHAR(30) NOT NULL CHECK (cruce_intt_status IN ('valido', 'no_coincide', 'observado')),
    cruce_robo_cicpc VARCHAR(30) NOT NULL CHECK (cruce_robo_cicpc IN ('sin_novedad', 'solicitado_robo')),
    cruce_multas_deudas VARCHAR(30) NOT NULL CHECK (cruce_multas_deudas IN ('solvente', 'con_deuda')),
    resultado VARCHAR(25) NOT NULL CHECK (resultado IN ('aprobado', 'rechazado_legal')),
    observaciones TEXT,
    verificado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_validacion_legal_vehiculo ON validacion_legal(vehiculo_id);

-- ==============================================================================
-- DOMINIO 3: CRM COMERCIAL Y GESTIÓN DE PERSONAS (MÓDULO 010)
-- ==============================================================================

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
CREATE OR REPLACE TRIGGER trg_persona_actualizado_en BEFORE UPDATE ON persona FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE INDEX IF NOT EXISTS idx_persona_ciego_telefono ON persona(indice_ciego_telefono);
CREATE INDEX IF NOT EXISTS idx_persona_ciego_correo ON persona(indice_ciego_correo);
CREATE INDEX IF NOT EXISTS idx_persona_asesor ON persona(asesor_id);

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
CREATE OR REPLACE TRIGGER trg_fusion_persona_inmutable BEFORE UPDATE OR DELETE ON fusion_persona FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();
CREATE INDEX IF NOT EXISTS idx_fusion_persona_sobreviviente ON fusion_persona(persona_sobreviviente_id);

CREATE TABLE IF NOT EXISTS catalogo_etapa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(40) NOT NULL UNIQUE,
    nombre VARCHAR(80) NOT NULL,
    orden SMALLINT NOT NULL,
    es_terminal BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO catalogo_etapa (codigo, nombre, orden, es_terminal) VALUES
('contacto_inicial', 'Contacto Inicial', 1, false),
('cita_agendada', 'Cita Agendada', 2, false),
('visita_realizada', 'Visita Realizada', 3, false),
('negociacion', 'En Negociación', 4, false),
('solicitud_credito', 'Solicitud de Crédito', 5, false),
('cerrado_ganado', 'Cerrado Ganado (Venta)', 6, true),
('cerrado_perdido', 'Cerrado Perdido', 7, true)
ON CONFLICT (codigo) DO NOTHING;

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
    solicitud_credito_id UUID,
    enlace_financiamiento_token VARCHAR(128),
    enlace_emitido_en TIMESTAMPTZ,
    cerrado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_oportunidad_actualizado_en BEFORE UPDATE ON oportunidad FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE INDEX IF NOT EXISTS idx_oportunidad_persona ON oportunidad(persona_id);
CREATE INDEX IF NOT EXISTS idx_oportunidad_vehiculo ON oportunidad(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_oportunidad_asesor ON oportunidad(asesor_id);
CREATE INDEX IF NOT EXISTS idx_oportunidad_etapa ON oportunidad(etapa_id);

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
CREATE OR REPLACE TRIGGER trg_interaccion_inmutable BEFORE UPDATE OR DELETE ON interaccion FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();
CREATE INDEX IF NOT EXISTS idx_interaccion_persona ON interaccion(persona_id);
CREATE INDEX IF NOT EXISTS idx_interaccion_oportunidad ON interaccion(oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_interaccion_ocurrido ON interaccion(ocurrido_en DESC);

CREATE TABLE IF NOT EXISTS etapa_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oportunidad_id UUID NOT NULL REFERENCES oportunidad(id) ON DELETE CASCADE,
    etapa_anterior_id UUID REFERENCES catalogo_etapa(id) ON DELETE RESTRICT,
    etapa_nueva_id UUID NOT NULL REFERENCES catalogo_etapa(id) ON DELETE RESTRICT,
    nota TEXT,
    actor_id UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_etapa_historial_inmutable BEFORE UPDATE OR DELETE ON etapa_historial FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();
CREATE INDEX IF NOT EXISTS idx_etapa_historial_oportunidad ON etapa_historial(oportunidad_id, creado_en);

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
CREATE INDEX IF NOT EXISTS idx_cita_persona ON cita_inspeccion(persona_id);
CREATE INDEX IF NOT EXISTS idx_cita_fecha ON cita_inspeccion(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_cita_sede ON cita_inspeccion(sede_id);

-- ==============================================================================
-- DOMINIO 4: CATÁLOGO, PUBLICACIONES Y GARANTÍA (MÓDULO 005)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS publicacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL UNIQUE REFERENCES vehiculo(id) ON DELETE RESTRICT,
    titulo VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_venta NUMERIC(18, 2) NOT NULL CHECK (precio_venta > 0),
    moneda VARCHAR(3) NOT NULL DEFAULT 'USD',
    tasa_bcv NUMERIC(14, 4) NOT NULL CHECK (tasa_bcv > 0),
    fecha_tasa TIMESTAMPTZ NOT NULL,
    garantia_meses SMALLINT DEFAULT 3 CHECK (garantia_meses >= 0),
    kilometraje_garantia INT DEFAULT 5000 CHECK (kilometraje_garantia >= 0),
    estado VARCHAR(25) NOT NULL DEFAULT 'publicado' CHECK (estado IN ('borrador', 'publicado', 'pausado', 'reservado', 'vendido')),
    publicado_en TIMESTAMPTZ,
    creado_por UUID REFERENCES usuario(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_publicacion_actualizado_en BEFORE UPDATE ON publicacion FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE INDEX IF NOT EXISTS idx_publicacion_estado_precio ON publicacion(estado, precio_venta);
CREATE INDEX IF NOT EXISTS idx_publicacion_fecha ON publicacion(publicado_en DESC);

CREATE TABLE IF NOT EXISTS publicacion_foto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publicacion_id UUID NOT NULL REFERENCES publicacion(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    orden SMALLINT NOT NULL DEFAULT 0,
    es_principal BOOLEAN NOT NULL DEFAULT false,
    etiqueta VARCHAR(50),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_publicacion_foto_pub ON publicacion_foto(publicacion_id, orden);

CREATE TABLE IF NOT EXISTS reserva (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publicacion_id UUID NOT NULL REFERENCES publicacion(id) ON DELETE RESTRICT,
    persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    monto_reserva NUMERIC(18, 2) NOT NULL CHECK (monto_reserva > 0),
    moneda VARCHAR(3) NOT NULL DEFAULT 'USD',
    tasa_bcv NUMERIC(14, 4) NOT NULL CHECK (tasa_bcv > 0),
    metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('pago_movil', 'c2p', 'transferencia')),
    comprobante_ref VARCHAR(100),
    estado VARCHAR(25) NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('pendiente_confirmacion', 'confirmada', 'expirada', 'reembolsada', 'convertida_en_venta')),
    expiracion_en TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reserva_publicacion ON reserva(publicacion_id);
CREATE INDEX IF NOT EXISTS idx_reserva_persona ON reserva(persona_id);
CREATE INDEX IF NOT EXISTS idx_reserva_estado ON reserva(estado);

CREATE TABLE IF NOT EXISTS garantia_devolucion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES vehiculo(id) ON DELETE RESTRICT,
    cliente_persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    condiciones TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado VARCHAR(25) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'expirada', 'en_reclamo', 'anulada')),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_garantia_vehiculo ON garantia_devolucion(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_garantia_cliente ON garantia_devolucion(cliente_persona_id);

-- ==============================================================================
-- DOMINIO 5: SOLICITUD DE CRÉDITO, RIESGO Y AML (MÓDULO 006 / FIN-001)
-- ==============================================================================

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
CREATE OR REPLACE TRIGGER trg_solicitud_credito_actualizado_en BEFORE UPDATE ON solicitud_credito FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE INDEX IF NOT EXISTS idx_solicitud_numero ON solicitud_credito(numero_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitud_persona ON solicitud_credito(persona_id);
CREATE INDEX IF NOT EXISTS idx_solicitud_oportunidad ON solicitud_credito(oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_solicitud_estado ON solicitud_credito(estado);

CREATE TABLE IF NOT EXISTS solicitud_recaudo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id UUID NOT NULL REFERENCES solicitud_credito(id) ON DELETE CASCADE,
    tipo_documento VARCHAR(50) NOT NULL CHECK (tipo_documento IN ('cedula_identidad', 'rif', 'constancia_trabajo', 'extracto_bancario', 'otro')),
    archivo_url TEXT NOT NULL,
    estado_validacion VARCHAR(25) NOT NULL DEFAULT 'pendiente' CHECK (estado_validacion IN ('pendiente', 'conforme', 'ilegible', 'rechazado')),
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_solicitud_recaudo_solicitud ON solicitud_recaudo(solicitud_id);

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
CREATE INDEX IF NOT EXISTS idx_decision_riesgo_solicitud ON decision_riesgo(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_decision_riesgo_resultado ON decision_riesgo(resultado);

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
CREATE INDEX IF NOT EXISTS idx_alerta_aml_solicitud ON alerta_aml(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_alerta_aml_persona ON alerta_aml(persona_id);
CREATE INDEX IF NOT EXISTS idx_alerta_aml_resolucion ON alerta_aml(resolucion);

-- ==============================================================================
-- DOMINIO 6: FINTECH, PAGOS Y LEDGER SAGRADO (MÓDULO 007)
-- ==============================================================================

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
CREATE INDEX IF NOT EXISTS idx_cuenta_codigo ON cuenta_contable(codigo);

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
CREATE OR REPLACE TRIGGER trg_asiento_inmutable BEFORE UPDATE OR DELETE ON asiento FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();
CREATE INDEX IF NOT EXISTS idx_asiento_numero ON asiento(numero_asiento);
CREATE INDEX IF NOT EXISTS idx_asiento_fecha ON asiento(fecha_asiento);
CREATE INDEX IF NOT EXISTS idx_asiento_transaccion_ref ON asiento(transaccion_ref);

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
CREATE OR REPLACE TRIGGER trg_linea_asiento_inmutable BEFORE UPDATE OR DELETE ON linea_asiento FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();
CREATE INDEX IF NOT EXISTS idx_linea_asiento_asiento ON linea_asiento(asiento_id);
CREATE INDEX IF NOT EXISTS idx_linea_asiento_cuenta ON linea_asiento(cuenta_id);

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
CREATE OR REPLACE TRIGGER trg_credito_actualizado_en BEFORE UPDATE ON credito FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE INDEX IF NOT EXISTS idx_credito_numero ON credito(numero_credito);
CREATE INDEX IF NOT EXISTS idx_credito_persona ON credito(persona_id);
CREATE INDEX IF NOT EXISTS idx_credito_estado ON credito(estado);

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
CREATE OR REPLACE TRIGGER trg_cuota_actualizado_en BEFORE UPDATE ON cuota FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
CREATE INDEX IF NOT EXISTS idx_cuota_credito_vencimiento ON cuota(credito_id, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cuota_estado ON cuota(estado);

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
CREATE INDEX IF NOT EXISTS idx_pago_credito ON pago(credito_id);
CREATE INDEX IF NOT EXISTS idx_pago_idempotency ON pago(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_pago_referencia ON pago(referencia_bancaria);

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
CREATE INDEX IF NOT EXISTS idx_conciliacion_pago ON conciliacion(pago_id);

-- ==============================================================================
-- DOMINIO 7: TESORERÍA Y CONTROL OPERATIVO (MÓDULO 009)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tasa_cambio_bcv (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL UNIQUE,
    tasa_usd_ves NUMERIC(14, 4) NOT NULL CHECK (tasa_usd_ves > 0),
    fuente VARCHAR(50) NOT NULL DEFAULT 'BCV_OFICIAL',
    capturado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    capturado_por UUID REFERENCES usuario(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tasa_bcv_fecha ON tasa_cambio_bcv(fecha DESC);

INSERT INTO tasa_cambio_bcv (fecha, tasa_usd_ves, fuente)
VALUES (CURRENT_DATE, 40.5000, 'BCV_OFICIAL')
ON CONFLICT (fecha) DO NOTHING;

CREATE TABLE IF NOT EXISTS movimiento_inventario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehiculo_id UUID NOT NULL REFERENCES vehiculo(id) ON DELETE RESTRICT,
    estado_anterior VARCHAR(30) NOT NULL,
    estado_nuevo VARCHAR(30) NOT NULL,
    sede_origen_id UUID REFERENCES sede(id) ON DELETE RESTRICT,
    sede_destino_id UUID REFERENCES sede(id) ON DELETE RESTRICT,
    motivo TEXT NOT NULL,
    autor_id UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE TRIGGER trg_movimiento_inventario_inmutable BEFORE UPDATE OR DELETE ON movimiento_inventario FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();
CREATE INDEX IF NOT EXISTS idx_movimiento_inv_vehiculo ON movimiento_inventario(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_inv_fecha ON movimiento_inventario(creado_en DESC);

CREATE TABLE IF NOT EXISTS notificacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destinatario_persona_id UUID REFERENCES persona(id) ON DELETE CASCADE,
    destinatario_usuario_id UUID REFERENCES usuario(id) ON DELETE CASCADE,
    canal VARCHAR(30) NOT NULL CHECK (canal IN ('whatsapp', 'sms', 'email', 'in_app')),
    tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN ('recordatorio_cuota', 'alerta_mora', 'confirmacion_cita', 'estado_credito', 'bienvenida')),
    contenido TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'fallido')),
    enviado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificacion_persona ON notificacion(destinatario_persona_id);
CREATE INDEX IF NOT EXISTS idx_notificacion_estado ON notificacion(estado);
