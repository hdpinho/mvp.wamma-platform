-- ==============================================================================
-- WAMMA PLATFORM — V0010: CRM alineado con el spec aprobado 010
-- Fuente: specs/010-crm-comercial/spec.md §8.1, §8.2, §8.5, §8.6, §8.8 y plan.md §3–§6,
-- validados en la maqueta (frontend-web/src/types/crm.ts).
--
-- Corrige lo que V0004 inventó o dejó distinto del spec: etapas y motivos de pérdida,
-- asesor y actor obligatorios (no existen hasta el módulo 001), teléfonos adicionales
-- en claro, token del enlace de financiamiento en claro y sin vencimiento, y citas sin
-- oportunidad ni franja.
--
-- Las tablas del CRM están vacías cuando corre esta migración. Si alguna tuviera filas,
-- los NOT NULL y los DELETE de catálogo fallan en voz alta en vez de corromper datos.
-- ==============================================================================

-- ── 1. Etapa y motivo por código (plan.md §3.2) ────────────────────────────────
-- Referenciar el catálogo por código permite el CHECK «motivo si y solo si perdida» y
-- deja legibles el historial y las métricas. Las columnas por UUID se retiran antes de
-- sustituir los catálogos para no dejar referencias colgando.
ALTER TABLE oportunidad
    DROP COLUMN IF EXISTS etapa_id,
    DROP COLUMN IF EXISTS motivo_perdida_id;

ALTER TABLE etapa_historial
    DROP COLUMN IF EXISTS etapa_anterior_id,
    DROP COLUMN IF EXISTS etapa_nueva_id;

-- ── 2. Catálogo de etapas: las siete de §8.1 con los umbrales de §8.6 ───────────
ALTER TABLE catalogo_etapa ADD COLUMN IF NOT EXISTS umbral_estancada_dias SMALLINT;

DELETE FROM catalogo_etapa
WHERE codigo NOT IN ('nuevo', 'contactado', 'cita_confirmada', 'visito',
                     'negociacion', 'cerrado_ganado', 'cerrado_perdido');

INSERT INTO catalogo_etapa (codigo, nombre, orden, es_terminal, umbral_estancada_dias) VALUES
    ('nuevo',           'Nuevo',           1, false, 2),
    ('contactado',      'Contactado',      2, false, 3),
    ('cita_confirmada', 'Cita confirmada', 3, false, 7),
    ('visito',          'Visitó la sede',  4, false, 7),
    ('negociacion',     'En negociación',  5, false, 14),
    ('cerrado_ganado',  'Vendido',         6, true,  NULL),
    ('cerrado_perdido', 'Perdido',         7, true,  NULL)
ON CONFLICT (codigo) DO UPDATE SET
    nombre                = EXCLUDED.nombre,
    orden                 = EXCLUDED.orden,
    es_terminal           = EXCLUDED.es_terminal,
    umbral_estancada_dias = EXCLUDED.umbral_estancada_dias;

-- Umbral obligatorio en las etapas abiertas; ninguno en las terminales.
-- (IS NOT NULL explícito: un CHECK que evalúa a NULL se da por cumplido.)
ALTER TABLE catalogo_etapa DROP CONSTRAINT IF EXISTS catalogo_etapa_umbral_check;
ALTER TABLE catalogo_etapa ADD CONSTRAINT catalogo_etapa_umbral_check CHECK (
    (es_terminal AND umbral_estancada_dias IS NULL)
    OR (NOT es_terminal AND umbral_estancada_dias IS NOT NULL AND umbral_estancada_dias > 0)
);

-- ── 3. Catálogo de motivos de pérdida: el de §8.2 ──────────────────────────────
DELETE FROM catalogo_motivo_perdida
WHERE codigo NOT IN ('precio_fuera_de_presupuesto', 'no_califico_financiamiento',
                     'compro_en_otra_parte', 'dejo_de_responder',
                     'vehiculo_vendido_a_otro_cliente', 'no_era_el_vehiculo_buscado', 'otro');

INSERT INTO catalogo_motivo_perdida (codigo, nombre, exige_texto) VALUES
    ('precio_fuera_de_presupuesto',     'Precio fuera de su presupuesto',       false),
    ('no_califico_financiamiento',      'No calificó para financiamiento',      false),
    ('compro_en_otra_parte',            'Compró en otra parte',                 false),
    ('dejo_de_responder',               'Dejó de responder',                    false),
    ('vehiculo_vendido_a_otro_cliente', 'El vehículo se vendió a otro cliente', false),
    ('no_era_el_vehiculo_buscado',      'No era el vehículo que buscaba',       false),
    ('otro',                            'Otro motivo',                          true)
ON CONFLICT (codigo) DO UPDATE SET
    nombre      = EXCLUDED.nombre,
    exige_texto = EXCLUDED.exige_texto;

-- ── 4. Persona ─────────────────────────────────────────────────────────────────
-- Los teléfonos pasan a persona_telefono (plan.md §5): la deduplicación busca por
-- cualquiera de ellos con un índice, y ninguno queda en claro.
ALTER TABLE persona
    DROP COLUMN IF EXISTS telefonos_adicionales,
    DROP COLUMN IF EXISTS telefono_whatsapp_cifrado,
    DROP COLUMN IF EXISTS indice_ciego_telefono;

-- Cifrado de campo en BYTEA (plan.md §3.1): en VARCHAR(255) un correo largo, ya
-- cifrado y codificado, no cabe.
ALTER TABLE persona
    ALTER COLUMN cedula_cifrada TYPE BYTEA USING convert_to(cedula_cifrada, 'UTF8'),
    ALTER COLUMN correo_cifrado TYPE BYTEA USING convert_to(correo_cifrado, 'UTF8');

-- Dato cifrado e índice ciego van juntos o no van.
ALTER TABLE persona DROP CONSTRAINT IF EXISTS persona_cedula_indice_check;
ALTER TABLE persona ADD CONSTRAINT persona_cedula_indice_check
    CHECK ((cedula_cifrada IS NULL) = (indice_ciego_cedula IS NULL));
ALTER TABLE persona DROP CONSTRAINT IF EXISTS persona_correo_indice_check;
ALTER TABLE persona ADD CONSTRAINT persona_correo_indice_check
    CHECK ((correo_cifrado IS NULL) = (indice_ciego_correo IS NULL));

-- canal_origen es texto trazado, sin lista cerrada (plan.md §3.2). La lista de V0004,
-- además, hablaba de «vitrina», que ya se llama catálogo.
ALTER TABLE persona DROP CONSTRAINT IF EXISTS persona_canal_origen_check;

-- Qué criterio resolvió la identidad al capturarla (plan.md §5): una resolución por
-- teléfono puede ser errónea (teléfono familiar) y hay que poder auditarla.
ALTER TABLE persona ADD COLUMN IF NOT EXISTS criterio_resolucion VARCHAR(10) NOT NULL;
ALTER TABLE persona DROP CONSTRAINT IF EXISTS persona_criterio_resolucion_check;
ALTER TABLE persona ADD CONSTRAINT persona_criterio_resolucion_check
    CHECK (criterio_resolucion IN ('cedula', 'telefono', 'nueva'));

-- ── 5. Teléfonos de la persona ─────────────────────────────────────────────────
-- Un teléfono por fila. El principal es el último que dio el cliente (spec §8.5).
CREATE TABLE IF NOT EXISTS persona_telefono (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id UUID NOT NULL REFERENCES persona(id) ON DELETE RESTRICT,
    telefono_cifrado BYTEA NOT NULL,
    indice_ciego_telefono VARCHAR(64) NOT NULL,
    es_principal BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT persona_telefono_persona_indice_key UNIQUE (persona_id, indice_ciego_telefono)
);

ALTER TABLE persona_telefono ENABLE ROW LEVEL SECURITY;

-- Como mucho un principal por persona.
CREATE UNIQUE INDEX IF NOT EXISTS uq_persona_telefono_principal
    ON persona_telefono (persona_id) WHERE es_principal;
-- Deduplicación por cualquier teléfono. No es único: dos personas pueden compartir un
-- teléfono familiar, y por eso la resolución por teléfono queda registrada.
CREATE INDEX IF NOT EXISTS idx_persona_telefono_indice_ciego
    ON persona_telefono (indice_ciego_telefono);

-- ── 6. Fusión de personas (plan.md §5.1) ───────────────────────────────────────
-- La persona absorbida no se borra: queda con estado 'fusionado' y referenciada, lo
-- que permite auditar y revertir. Sin identidad de usuario hasta el módulo 001, quien
-- fusiona puede ser nulo (plan.md S3).
ALTER TABLE fusion_persona ALTER COLUMN fusionada_por DROP NOT NULL;
ALTER TABLE fusion_persona ADD COLUMN IF NOT EXISTS persona_absorbida_id UUID NOT NULL
    REFERENCES persona(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_fusion_persona_absorbida ON fusion_persona (persona_absorbida_id);
CREATE INDEX IF NOT EXISTS idx_fusion_persona_fusionada_por ON fusion_persona (fusionada_por);

-- ── 7. Oportunidad ─────────────────────────────────────────────────────────────
-- Toda oportunidad nace en 'nuevo', de forma automática al capturar (spec §8.1).
ALTER TABLE oportunidad
    ADD COLUMN IF NOT EXISTS etapa VARCHAR(40) NOT NULL DEFAULT 'nuevo'
        REFERENCES catalogo_etapa(codigo) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS motivo_perdida VARCHAR(40)
        REFERENCES catalogo_motivo_perdida(codigo) ON DELETE RESTRICT;

-- Motivo obligatorio si y solo si la oportunidad se perdió (CA-010.2).
ALTER TABLE oportunidad DROP CONSTRAINT IF EXISTS oportunidad_motivo_perdida_check;
ALTER TABLE oportunidad ADD CONSTRAINT oportunidad_motivo_perdida_check
    CHECK ((etapa = 'cerrado_perdido') = (motivo_perdida IS NOT NULL));

-- Sin asignar mientras no exista el módulo 001 (plan.md S3, C3, C4).
ALTER TABLE oportunidad ALTER COLUMN asesor_id DROP NOT NULL;

-- Enlace personal de financiamiento (spec §8.8). El token es una credencial al
-- portador: se guarda solo su hash SHA-256, es de un solo uso y vence. El plazo de
-- vencimiento no se fija aquí; lo decide el negocio.
ALTER TABLE oportunidad DROP COLUMN IF EXISTS enlace_financiamiento_token;
ALTER TABLE oportunidad
    ADD COLUMN IF NOT EXISTS enlace_token_hash CHAR(64),
    ADD COLUMN IF NOT EXISTS enlace_expira_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS enlace_usado_en TIMESTAMPTZ;
ALTER TABLE oportunidad DROP CONSTRAINT IF EXISTS oportunidad_enlace_token_hash_key;
ALTER TABLE oportunidad ADD CONSTRAINT oportunidad_enlace_token_hash_key UNIQUE (enlace_token_hash);
ALTER TABLE oportunidad DROP CONSTRAINT IF EXISTS oportunidad_enlace_check;
ALTER TABLE oportunidad ADD CONSTRAINT oportunidad_enlace_check CHECK (
    enlace_token_hash IS NULL
    OR (enlace_emitido_en IS NOT NULL
        AND enlace_expira_en IS NOT NULL
        AND enlace_expira_en > enlace_emitido_en)
);

-- Control optimista: el PATCH de etapa lleva If-Match con esta versión (plan.md §6).
ALTER TABLE oportunidad ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0;

-- Tablero por etapa y asesor (plan.md §3.2). Empieza por etapa: cubre también su FK.
CREATE INDEX IF NOT EXISTS idx_oportunidad_etapa_asesor ON oportunidad (etapa, asesor_id);
CREATE INDEX IF NOT EXISTS idx_oportunidad_motivo_perdida ON oportunidad (motivo_perdida);

-- ── 8. Interacción (append-only) ───────────────────────────────────────────────
-- Canales validados en la maqueta.
ALTER TABLE interaccion DROP CONSTRAINT IF EXISTS interaccion_canal_check;
ALTER TABLE interaccion ADD CONSTRAINT interaccion_canal_check
    CHECK (canal IN ('whatsapp', 'llamada', 'correo', 'presencial'));

-- Sin identidad de usuario hasta el módulo 001.
ALTER TABLE interaccion ALTER COLUMN autor_id DROP NOT NULL;

-- Un reintento de red no debe duplicar una nota en un historial que no se corrige
-- borrando (plan.md §6: cabecera Idempotency-Key).
ALTER TABLE interaccion ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
ALTER TABLE interaccion DROP CONSTRAINT IF EXISTS interaccion_idempotency_key_key;
ALTER TABLE interaccion ADD CONSTRAINT interaccion_idempotency_key_key UNIQUE (idempotency_key);

-- El índice del plan (§3.2) en lugar de los dos sueltos.
DROP INDEX IF EXISTS idx_interaccion_persona;
DROP INDEX IF EXISTS idx_interaccion_ocurrido;
CREATE INDEX IF NOT EXISTS idx_interaccion_persona_ocurrido ON interaccion (persona_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS idx_interaccion_autor ON interaccion (autor_id);
CREATE INDEX IF NOT EXISTS idx_interaccion_corrige ON interaccion (corrige_interaccion_id);

-- ── 9. Historial de etapas (append-only) ───────────────────────────────────────
ALTER TABLE etapa_historial
    ADD COLUMN IF NOT EXISTS etapa_anterior VARCHAR(40)
        REFERENCES catalogo_etapa(codigo) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS etapa_nueva VARCHAR(40) NOT NULL
        REFERENCES catalogo_etapa(codigo) ON DELETE RESTRICT;

-- Transiciones del sistema (la captura crea 'nuevo') y, hasta el 001, sin actor.
ALTER TABLE etapa_historial ALTER COLUMN actor_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_etapa_historial_actor ON etapa_historial (actor_id);
CREATE INDEX IF NOT EXISTS idx_etapa_historial_anterior ON etapa_historial (etapa_anterior);
CREATE INDEX IF NOT EXISTS idx_etapa_historial_nueva ON etapa_historial (etapa_nueva, creado_en);

-- ── 10. Citas: dentro de una oportunidad, con día y franja (plan.md §7.1) ──────
ALTER TABLE cita_inspeccion
    DROP COLUMN IF EXISTS fecha_hora,
    DROP COLUMN IF EXISTS tipo_cita;

ALTER TABLE cita_inspeccion
    ADD COLUMN IF NOT EXISTS oportunidad_id UUID NOT NULL
        REFERENCES oportunidad(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS dia_preferido DATE NOT NULL,
    ADD COLUMN IF NOT EXISTS franja VARCHAR(10) NOT NULL,
    ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE cita_inspeccion DROP CONSTRAINT IF EXISTS cita_inspeccion_franja_check;
ALTER TABLE cita_inspeccion ADD CONSTRAINT cita_inspeccion_franja_check
    CHECK (franja IN ('manana', 'tarde'));

-- Estados de la bandeja de citas. «Asistió» no es un estado de la cita: lleva la
-- oportunidad a 'visito' (spec §8.8).
ALTER TABLE cita_inspeccion DROP CONSTRAINT IF EXISTS cita_inspeccion_estado_check;
ALTER TABLE cita_inspeccion ALTER COLUMN estado SET DEFAULT 'pendiente';
ALTER TABLE cita_inspeccion ADD CONSTRAINT cita_inspeccion_estado_check
    CHECK (estado IN ('pendiente', 'confirmada', 'descartada'));

-- Toda cita es sobre un vehículo, y un vehículo con citas no se borra.
ALTER TABLE cita_inspeccion ALTER COLUMN vehiculo_id SET NOT NULL;
ALTER TABLE cita_inspeccion
    DROP CONSTRAINT IF EXISTS cita_inspeccion_vehiculo_id_fkey,
    ADD CONSTRAINT cita_inspeccion_vehiculo_id_fkey
        FOREIGN KEY (vehiculo_id) REFERENCES vehiculo(id) ON DELETE RESTRICT;

CREATE OR REPLACE TRIGGER trg_cita_inspeccion_actualizado_en
BEFORE UPDATE ON cita_inspeccion
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE INDEX IF NOT EXISTS idx_cita_oportunidad ON cita_inspeccion (oportunidad_id);
CREATE INDEX IF NOT EXISTS idx_cita_vehiculo ON cita_inspeccion (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_cita_dia ON cita_inspeccion (dia_preferido);
