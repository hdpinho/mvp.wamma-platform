-- ==============================================================================
-- WAMMA PLATFORM — V0016: permisos de wamma_app y estado del límite de ingreso
-- Spec 011 §6.1 y §6.3. Paso 4 del orden de la sección 7 de ese spec.
--
-- Esta migración solo añade: permisos y una tabla. No quita nada a nadie, así que
-- puede viajar en el mismo despliegue que el endpoint de parámetros (D-41).
-- ==============================================================================

-- ── 1. Permisos explícitos de wamma_app sobre todo el esquema ─────────────────
-- V0009 dejó fijado ALTER DEFAULT PRIVILEGES, que sí alcanza lo que cree después el
-- MISMO rol; como todas las migraciones corren con el mismo usuario, las tablas de
-- V0013 a V0015 ya tienen sus permisos (comprobado con la prueba universal de
-- pruebas-esquema.sql). Este bloque no repara nada: es el seguro para el día en que
-- una migración se aplique con otro rol, donde el mecanismo por defecto no alcanza.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wamma_app') THEN
        EXECUTE format('GRANT USAGE ON SCHEMA %I TO wamma_app', current_schema());
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO wamma_app', current_schema());
        EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO wamma_app', current_schema());

        -- El historial de Flyway es del dueño: la aplicación no lo toca (V0009 §3).
        IF to_regclass(format('%I.flyway_schema_history', current_schema())) IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON %I.flyway_schema_history FROM wamma_app', current_schema());
        END IF;

        -- El GRANT masivo de arriba vuelve a dar UPDATE y DELETE sobre las tablas
        -- append-only. Hay que retirarlos otra vez o el ledger y la bitácora dejarían
        -- de serlo (Principio V). El orden importa: primero conceder, luego revocar.
        REVOKE UPDATE, DELETE, TRUNCATE ON
            auditoria_evento, fusion_persona, interaccion, etapa_historial,
            asiento, linea_asiento, movimiento_inventario
        FROM wamma_app;
    END IF;
END $$;

-- ── 2. Estado del límite de ingreso, fuera de la memoria del proceso ──────────
-- Hasta ahora vivía en un ConcurrentHashMap: se perdía en cada despliegue y no se
-- compartía entre instancias. Con la tabla, el límite sobrevive al reinicio y sigue
-- valiendo el día que haya más de una instancia detrás de un balanceador.
--
-- `identificador` es la IP o el nombre de usuario que llegó en la petición, exista o
-- no la cuenta (D-40). Contar siempre es lo que impide que el limitador se convierta
-- en un oráculo para averiguar qué usuarios existen.
CREATE TABLE IF NOT EXISTS intento_ingreso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('ip', 'usuario')),
    identificador TEXT NOT NULL,
    fallos_consecutivos INT NOT NULL DEFAULT 0 CHECK (fallos_consecutivos >= 0),
    -- Momento a partir del cual se admite el siguiente intento. El servidor NUNCA
    -- espera: si llega antes, responde 429 con Retry-After y no ocupa un hilo (D-40).
    proximo_intento_admitido_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_intento_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT intento_ingreso_clave UNIQUE (tipo, identificador)
);

-- Para la purga: las filas fuera de ventana se borran por antigüedad.
CREATE INDEX IF NOT EXISTS idx_intento_ingreso_ultimo
    ON intento_ingreso (ultimo_intento_en);

-- Convención D-42: toda tabla nueva nace con su GRANT y su RLS en la misma migración.
-- Esta NO es append-only: necesita UPDATE para contar y DELETE para purgar.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wamma_app') THEN
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.intento_ingreso TO wamma_app', current_schema());
    END IF;
END $$;

ALTER TABLE intento_ingreso ENABLE ROW LEVEL SECURITY;

-- El identificador de ingreso es dato personal indirecto (Principio I): se conserva solo
-- lo que el límite necesita. La purga la hace la aplicación en cada comprobación.
COMMENT ON TABLE intento_ingreso IS
    'Estado del límite de intentos de ingreso por IP y por usuario (spec 011 §6.3, D-40). '
    'Sin valor histórico: se purga por ventana, no se conserva.';
