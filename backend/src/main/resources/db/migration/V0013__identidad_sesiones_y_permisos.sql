-- ==============================================================================
-- WAMMA PLATFORM — V0013: Identidad, sesiones y permisos del backoffice (módulo 001)
-- Fuente: specs/001-nucleo-cumplimiento-seguridad/ — spec Rev. 2, plan §3 y §9 (D-24).
-- Reglas de database-schema-design.md §5: RLS explícito en tablas nuevas y ninguna
-- sentencia sobre flyway_schema_history.
-- ==============================================================================

-- ── 1. Usuario ─────────────────────────────────────────────────────────────────
-- Los roles viven en usuario_rol: el campo `tipo` de V0002 era una lista de puestos
-- inventada que duplicaba el RBAC.
DROP INDEX IF EXISTS idx_usuario_tipo_estado;
ALTER TABLE usuario DROP COLUMN IF EXISTS tipo;
-- Todo el backoffice usa 2FA (D-24): la columna ya no distinguía nada.
ALTER TABLE usuario DROP COLUMN IF EXISTS requiere_2fa;
-- El secreto TOTP pasa a guardarse cifrado (BYTEA); nunca en claro.
ALTER TABLE usuario DROP COLUMN IF EXISTS secreto_2fa_totp;

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS nombre_usuario VARCHAR(50) NOT NULL,
    ADD COLUMN IF NOT EXISTS totp_secreto_cifrado BYTEA,
    ADD COLUMN IF NOT EXISTS totp_activado_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS totp_ultimo_paso BIGINT,
    ADD COLUMN IF NOT EXISTS intentos_fallidos SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS contrasena_cambiada_en TIMESTAMPTZ;

-- Con el nombre de usuario se ingresa: único y en minúsculas.
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_nombre_usuario_key;
ALTER TABLE usuario ADD CONSTRAINT usuario_nombre_usuario_key UNIQUE (nombre_usuario);
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_nombre_usuario_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_nombre_usuario_check
    CHECK (nombre_usuario ~ '^[a-z0-9._-]{3,50}$');

-- Un 2FA activo tiene secreto. Un secreto sin activar es una activación en curso.
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_totp_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_totp_check
    CHECK (totp_activado_en IS NULL OR totp_secreto_cifrado IS NOT NULL);
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_intentos_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_intentos_check CHECK (intentos_fallidos >= 0);

-- ── 2. Sesiones ────────────────────────────────────────────────────────────────
-- Token opaco (plan §5): en la base solo su hash SHA-256. Nivel 'parcial' entre la
-- contraseña y el 2FA; 'completa' después. Al pasar a completa se emite otro token.
CREATE TABLE IF NOT EXISTS sesion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    token_hash CHAR(64) NOT NULL,
    nivel VARCHAR(10) NOT NULL,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_uso_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en TIMESTAMPTZ NOT NULL,
    revocada_en TIMESTAMPTZ,
    motivo_revocacion VARCHAR(20),
    ip_origen VARCHAR(45),
    agente_usuario VARCHAR(300),
    CONSTRAINT sesion_token_hash_key UNIQUE (token_hash),
    CONSTRAINT sesion_nivel_check CHECK (nivel IN ('parcial', 'completa')),
    CONSTRAINT sesion_motivo_check CHECK (motivo_revocacion IN
        ('salida', 'desactivacion', 'restablecimiento', 'cambio_contrasena', 'ascenso')),
    CONSTRAINT sesion_revocacion_check CHECK ((revocada_en IS NULL) = (motivo_revocacion IS NULL))
);

ALTER TABLE sesion ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_sesion_usuario ON sesion (usuario_id);

-- ── 3. Códigos de recuperación ─────────────────────────────────────────────────
-- Diez por usuario al activar el 2FA; cada uno sirve una vez. Se guarda un HMAC con la
-- clave del servidor: una copia de la base sola no permite probarlos por fuerza bruta.
CREATE TABLE IF NOT EXISTS codigo_recuperacion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    codigo_hash CHAR(64) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    usado_en TIMESTAMPTZ,
    CONSTRAINT codigo_recuperacion_usuario_hash_key UNIQUE (usuario_id, codigo_hash)
);

ALTER TABLE codigo_recuperacion ENABLE ROW LEVEL SECURITY;

-- ── 4. Bitácora ────────────────────────────────────────────────────────────────
-- Un ingreso fallido con un usuario inexistente no tiene entidad a la que apuntar.
ALTER TABLE auditoria_evento ALTER COLUMN entidad_id DROP NOT NULL;
-- La consulta filtra por acción (plan §8).
CREATE INDEX IF NOT EXISTS idx_auditoria_accion_fecha ON auditoria_evento (accion, creado_en DESC);

-- ── 5. Roles, permisos y matriz aprobada (D-03, D-24) ──────────────────────────
-- Debe coincidir con com.wamma.platform.identity.Role; una prueba de integración lo verifica.
INSERT INTO rol (codigo, nombre, descripcion, ambito) VALUES
    ('ADMINISTRADOR',         'Administrador',         'Gestiona usuarios, roles y la configuración de la plataforma', 'administracion'),
    ('ASESOR_COMERCIAL',      'Asesor comercial',      'Atiende a las personas y lleva sus oportunidades',            'comercial'),
    ('COORDINADOR_COMERCIAL', 'Coordinador comercial', 'Supervisa el embudo y reparte las oportunidades',             'comercial'),
    ('INVENTARIO',            'Inventario',            'Da de alta y mantiene los vehículos',                         'inventario'),
    ('ANALISTA_CREDITO',      'Analista de crédito',   'Revisa las solicitudes de crédito y sus recaudos',            'credito'),
    ('AUDITOR',               'Auditor',               'Consulta sin modificar nada, incluida la bitácora',           'control')
ON CONFLICT (codigo) DO UPDATE SET
    nombre      = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    ambito      = EXCLUDED.ambito;

INSERT INTO permiso (codigo, modulo, nombre, descripcion) VALUES
    ('usuarios.gestionar',   '001',               'Gestionar usuarios',                    'Crear, editar, activar o desactivar usuarios, asignar roles y restablecer accesos'),
    ('auditoria.ver',        '001',               'Ver la bitácora',                       'Consultar la bitácora de auditoría'),
    ('parametros.gestionar', 'financiamiento',    'Gestionar parámetros de financiamiento','Tasa, plazos y montos del financiamiento'),
    ('tasa_bcv.registrar',   '009',               'Registrar la tasa BCV',                 'Registrar la tasa oficial del día'),
    ('inventario.ver',       '004',               'Ver el inventario',                     'Consultar los vehículos en el backoffice'),
    ('inventario.gestionar', '004',               'Gestionar el inventario',               'Crear, editar y retirar vehículos, fotos e imperfecciones'),
    ('crm.ver_propias',      '010',               'Ver oportunidades propias',             'Las propias y las que no tienen asesor'),
    ('crm.ver_todas',        '010',               'Ver todas las oportunidades',           'Todo el embudo comercial'),
    ('crm.operar',           '010',               'Operar el CRM',                         'Citas, contactos, cambios de etapa y venta'),
    ('crm.asignar',          '010',               'Asignar oportunidades',                 'Asignar y reasignar asesores'),
    ('cotizador.usar',       'financiamiento',    'Usar el cotizador',                     'Estructurar propuestas de financiamiento'),
    ('credito.revisar',      'solicitud-credito', 'Revisar solicitudes de crédito',        'Bandeja de solicitudes y sus recaudos'),
    ('credito.ver',          'solicitud-credito', 'Ver solicitudes de crédito',            'Consultar el expediente de crédito')
ON CONFLICT (codigo) DO UPDATE SET
    modulo      = EXCLUDED.modulo,
    nombre      = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM (VALUES
    ('ADMINISTRADOR', 'usuarios.gestionar'),
    ('ADMINISTRADOR', 'auditoria.ver'),
    ('ADMINISTRADOR', 'parametros.gestionar'),
    ('ADMINISTRADOR', 'tasa_bcv.registrar'),
    ('ADMINISTRADOR', 'inventario.ver'),
    ('ASESOR_COMERCIAL', 'inventario.ver'),
    ('ASESOR_COMERCIAL', 'crm.ver_propias'),
    ('ASESOR_COMERCIAL', 'crm.operar'),
    ('ASESOR_COMERCIAL', 'cotizador.usar'),
    ('COORDINADOR_COMERCIAL', 'inventario.ver'),
    ('COORDINADOR_COMERCIAL', 'crm.ver_todas'),
    ('COORDINADOR_COMERCIAL', 'crm.operar'),
    ('COORDINADOR_COMERCIAL', 'crm.asignar'),
    ('COORDINADOR_COMERCIAL', 'cotizador.usar'),
    ('INVENTARIO', 'inventario.ver'),
    ('INVENTARIO', 'inventario.gestionar'),
    ('ANALISTA_CREDITO', 'tasa_bcv.registrar'),
    ('ANALISTA_CREDITO', 'inventario.ver'),
    ('ANALISTA_CREDITO', 'cotizador.usar'),
    ('ANALISTA_CREDITO', 'credito.revisar'),
    ('ANALISTA_CREDITO', 'credito.ver'),
    ('AUDITOR', 'auditoria.ver'),
    ('AUDITOR', 'inventario.ver'),
    ('AUDITOR', 'crm.ver_todas'),
    ('AUDITOR', 'credito.ver')
) AS matriz (rol_codigo, permiso_codigo)
JOIN rol r ON r.codigo = matriz.rol_codigo
JOIN permiso p ON p.codigo = matriz.permiso_codigo
ON CONFLICT DO NOTHING;
