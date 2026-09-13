-- ==============================================================================
-- WAMMA PLATFORM — V0002: Módulo 001 (Seguridad, RBAC y Auditoría Inmutable)
-- Conforme a la Constitución (Principio I y VI) y specs/001-nucleo-cumplimiento-seguridad
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Función para actualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para blindar tablas inmutables (append-only)
CREATE OR REPLACE FUNCTION prevenir_modificacion_inmutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Operación denegada: Los registros en la tabla % son estrictamente inmutables (append-only).', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabla de Usuarios (operadores, analistas, administradores)
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

CREATE OR REPLACE TRIGGER trg_usuario_actualizado_en
BEFORE UPDATE ON usuario
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE INDEX idx_usuario_email ON usuario(email);
CREATE INDEX idx_usuario_tipo_estado ON usuario(tipo, estado);

-- 2. Tabla de Roles (RBAC con separación institucional)
CREATE TABLE IF NOT EXISTS rol (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    ambito VARCHAR(50) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabla de Permisos granulares
CREATE TABLE IF NOT EXISTS permiso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL UNIQUE,
    modulo VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
);

CREATE INDEX idx_permiso_modulo ON permiso(modulo);

-- 4. Junction Usuario - Rol
CREATE TABLE IF NOT EXISTS usuario_rol (
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    rol_id UUID NOT NULL REFERENCES rol(id) ON DELETE RESTRICT,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    asignado_por UUID REFERENCES usuario(id),
    PRIMARY KEY (usuario_id, rol_id)
);

CREATE INDEX idx_usuario_rol_rol ON usuario_rol(rol_id);

-- 5. Junction Rol - Permiso
CREATE TABLE IF NOT EXISTS rol_permiso (
    rol_id UUID NOT NULL REFERENCES rol(id) ON DELETE CASCADE,
    permiso_id UUID NOT NULL REFERENCES permiso(id) ON DELETE RESTRICT,
    PRIMARY KEY (rol_id, permiso_id)
);

CREATE INDEX idx_rol_permiso_permiso ON rol_permiso(permiso_id);

-- 6. Auditoría Inmutable (Append-Only)
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

CREATE OR REPLACE TRIGGER trg_auditoria_evento_inmutable
BEFORE UPDATE OR DELETE ON auditoria_evento
FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE INDEX idx_auditoria_entidad ON auditoria_evento(entidad, entidad_id);
CREATE INDEX idx_auditoria_actor_fecha ON auditoria_evento(actor_id, creado_en DESC);
CREATE INDEX idx_auditoria_fecha ON auditoria_evento(creado_en DESC);

-- 7. Referencia a Secretos (Constitución Principio VI: secretos fuera de BD)
CREATE TABLE IF NOT EXISTS secreto_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave VARCHAR(100) NOT NULL UNIQUE,
    referencia_vault VARCHAR(255) NOT NULL,
    descripcion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_secreto_config_actualizado_en
BEFORE UPDATE ON secreto_config
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();
