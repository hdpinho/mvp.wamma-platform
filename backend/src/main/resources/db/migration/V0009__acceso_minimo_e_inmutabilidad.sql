-- ==============================================================================
-- WAMMA PLATFORM — V0009: Acceso mínimo e inmutabilidad real
-- Constitución: Principio I (mínimo privilegio), V (ledger sagrado) y VI (auditoría inmutable)
--
-- Corrige lo que V0002–V0008 dejaron abierto:
--   · Los roles de la API pública de Supabase (anon, authenticated) tenían todos los
--     privilegios sobre todas las tablas, TRUNCATE incluido.
--   · Los triggers append-only eran de fila: TRUNCATE los saltaba.
--   · El backend solo podía conectarse como dueño de las tablas.
--   · Nada verificaba que un asiento cuadrara.
--
-- Portable: lo específico de Supabase va condicionado a que el rol exista, y todo se
-- aplica sobre el esquema de Flyway (current_schema()), no sobre un nombre fijo.
-- ==============================================================================

-- ── 1. Cerrar la API de datos de Supabase ─────────────────────────────────────
-- El backend es el único cliente de la base. RLS sin políticas ya niega las filas a
-- anon y authenticated; retirarles los privilegios cierra además TRUNCATE (que RLS no
-- cubre) y evita que una política futura mal escrita abra datos.
-- Las funciones del esquema son de trigger: no se pueden invocar por RPC.
-- service_role no se toca: es la llave administrativa de Supabase y no se publica.
DO $$
DECLARE
    nombre_rol TEXT;
BEGIN
    FOREACH nombre_rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = nombre_rol) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', current_schema(), nombre_rol);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', current_schema(), nombre_rol);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM %I', current_schema(), nombre_rol);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM %I', current_schema(), nombre_rol);
            EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON FUNCTIONS FROM %I', current_schema(), nombre_rol);
        END IF;
    END LOOP;
END $$;

-- ── 2. RLS declarado en el esquema, denegando por defecto ─────────────────────
-- Hoy lo activa en Supabase el disparador de eventos `ensure_rls`; en cualquier otro
-- PostgreSQL no existiría. No autoriza nada (eso lo hace Spring Boot): es la barrera
-- para todo rol que no sea el dueño del esquema ni `wamma_app`.
-- flyway_schema_history queda fuera: Flyway la mantiene abierta desde otra conexión
-- mientras migra, y un ALTER TABLE sobre ella espera hasta agotar el tiempo. Es tabla
-- del dueño, sin datos de negocio, y pierde los privilegios públicos en la sección 1.
DO $$
DECLARE
    tabla RECORD;
BEGIN
    FOR tabla IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p')
          AND c.relname <> 'flyway_schema_history'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', current_schema(), tabla.relname);
    END LOOP;
END $$;

-- ── 3. Rol de la aplicación con mínimo privilegio ─────────────────────────────
-- El dueño de las tablas puede desactivar triggers y cambiar el esquema: el backend
-- no debe conectarse con él. `wamma_app` nace SIN login y su contraseña nunca se
-- versiona. Para activarlo (una vez, fuera del repositorio):
--     ALTER ROLE wamma_app WITH LOGIN PASSWORD '<secreto>';
-- El backend pasa a usar ese rol y Flyway sigue migrando con el dueño
-- (FLYWAY_DB_USER / FLYWAY_DB_PASSWORD en application.yml).
-- BYPASSRLS: la autorización fina vive en Spring Boot; RLS solo frena a los demás roles.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wamma_app') THEN
        CREATE ROLE wamma_app NOLOGIN BYPASSRLS;
    END IF;

    EXECUTE format('GRANT USAGE ON SCHEMA %I TO wamma_app', current_schema());
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO wamma_app', current_schema());
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO wamma_app', current_schema());
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wamma_app', current_schema());
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO wamma_app', current_schema());

    -- El historial de Flyway es del dueño: la aplicación no lo toca.
    IF to_regclass(format('%I.flyway_schema_history', current_schema())) IS NOT NULL THEN
        EXECUTE format('REVOKE ALL ON %I.flyway_schema_history FROM wamma_app', current_schema());
    END IF;
END $$;

-- Append-only: la aplicación lee e inserta; nunca modifica ni borra.
-- Toda tabla append-only nueva debe repetir este REVOKE en su propia migración.
REVOKE UPDATE, DELETE, TRUNCATE ON
    auditoria_evento, fusion_persona, interaccion, etapa_historial,
    asiento, linea_asiento, movimiento_inventario
FROM wamma_app;

-- ── 4. Append-only también frente a TRUNCATE ──────────────────────────────────
-- Los triggers de fila no se disparan con TRUNCATE: una sola sentencia vaciaba la
-- auditoría o el ledger. Estos se disparan también con TRUNCATE ... CASCADE.
CREATE OR REPLACE TRIGGER trg_auditoria_evento_sin_truncate
BEFORE TRUNCATE ON auditoria_evento
FOR EACH STATEMENT EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE OR REPLACE TRIGGER trg_fusion_persona_sin_truncate
BEFORE TRUNCATE ON fusion_persona
FOR EACH STATEMENT EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE OR REPLACE TRIGGER trg_interaccion_sin_truncate
BEFORE TRUNCATE ON interaccion
FOR EACH STATEMENT EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE OR REPLACE TRIGGER trg_etapa_historial_sin_truncate
BEFORE TRUNCATE ON etapa_historial
FOR EACH STATEMENT EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE OR REPLACE TRIGGER trg_asiento_sin_truncate
BEFORE TRUNCATE ON asiento
FOR EACH STATEMENT EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE OR REPLACE TRIGGER trg_linea_asiento_sin_truncate
BEFORE TRUNCATE ON linea_asiento
FOR EACH STATEMENT EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE OR REPLACE TRIGGER trg_movimiento_inventario_sin_truncate
BEFORE TRUNCATE ON movimiento_inventario
FOR EACH STATEMENT EXECUTE FUNCTION prevenir_modificacion_inmutable();

-- ── 5. Claves foráneas que no chocan con el append-only ────────────────────────
-- SET NULL o CASCADE sobre una tabla append-only intenta modificarla y el trigger
-- aborta con un error que no explica nada. RESTRICT dice la verdad: lo que un
-- historial inmutable referencia no se borra (los usuarios se desactivan).
ALTER TABLE auditoria_evento
    DROP CONSTRAINT IF EXISTS auditoria_evento_actor_id_fkey,
    ADD CONSTRAINT auditoria_evento_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES usuario(id) ON DELETE RESTRICT;

ALTER TABLE interaccion
    DROP CONSTRAINT IF EXISTS interaccion_oportunidad_id_fkey,
    ADD CONSTRAINT interaccion_oportunidad_id_fkey
        FOREIGN KEY (oportunidad_id) REFERENCES oportunidad(id) ON DELETE RESTRICT;

ALTER TABLE etapa_historial
    DROP CONSTRAINT IF EXISTS etapa_historial_oportunidad_id_fkey,
    ADD CONSTRAINT etapa_historial_oportunidad_id_fkey
        FOREIGN KEY (oportunidad_id) REFERENCES oportunidad(id) ON DELETE RESTRICT;

-- ── 6. Ledger: cada línea es débito o crédito, nunca ambos ─────────────────────
ALTER TABLE linea_asiento DROP CONSTRAINT IF EXISTS linea_asiento_check;
ALTER TABLE linea_asiento DROP CONSTRAINT IF EXISTS linea_asiento_un_solo_lado_check;
ALTER TABLE linea_asiento ADD CONSTRAINT linea_asiento_un_solo_lado_check
    CHECK ((debe > 0 AND haber = 0) OR (debe = 0 AND haber > 0));

-- ── 7. Ledger: Σ debe = Σ haber, verificado por el motor al confirmar ──────────
-- Constraint trigger diferido: se evalúa al COMMIT, cuando el asiento ya tiene todas
-- sus líneas. Exige al menos dos líneas y cuadre por moneda (RF-007.4, CA-007.2).
-- [NEEDS CLARIFICATION: moneda funcional del ledger] Mientras contabilidad no la
-- defina, un asiento que mezcle USD y VES debe cuadrar en cada moneda por separado.
CREATE OR REPLACE FUNCTION verificar_cuadre_asiento()
RETURNS TRIGGER AS $$
DECLARE
    v_asiento_id UUID;
    v_lineas INTEGER;
    v_descuadre RECORD;
BEGIN
    IF TG_TABLE_NAME = 'asiento' THEN
        v_asiento_id := NEW.id;
    ELSE
        v_asiento_id := NEW.asiento_id;
    END IF;

    SELECT count(*) INTO v_lineas FROM linea_asiento WHERE asiento_id = v_asiento_id;
    IF v_lineas < 2 THEN
        RAISE EXCEPTION 'Asiento % sin partida doble: tiene % línea(s).', v_asiento_id, v_lineas
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT moneda, sum(debe) AS debe, sum(haber) AS haber
    INTO v_descuadre
    FROM linea_asiento
    WHERE asiento_id = v_asiento_id
    GROUP BY moneda
    HAVING sum(debe) <> sum(haber)
    LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Asiento % descuadrado en %: debe %, haber %.',
            v_asiento_id, v_descuadre.moneda, v_descuadre.debe, v_descuadre.haber
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- CREATE OR REPLACE no admite constraint triggers: se recrean.
DROP TRIGGER IF EXISTS trg_asiento_cuadre ON asiento;
CREATE CONSTRAINT TRIGGER trg_asiento_cuadre
AFTER INSERT ON asiento
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verificar_cuadre_asiento();

DROP TRIGGER IF EXISTS trg_linea_asiento_cuadre ON linea_asiento;
CREATE CONSTRAINT TRIGGER trg_linea_asiento_cuadre
AFTER INSERT ON linea_asiento
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verificar_cuadre_asiento();
