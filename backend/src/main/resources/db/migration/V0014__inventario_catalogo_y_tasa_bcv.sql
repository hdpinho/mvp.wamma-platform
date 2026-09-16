-- ==============================================================================
-- WAMMA PLATFORM — V0014: Etapa 2 — inventario, catálogo y tasa BCV
-- Conforme a specs/005-catalogo-venta (spec Rev. 2, plan §3) y a D-12, D-21, D-23 y D-25
-- ==============================================================================
-- Reglas de database-schema-design.md §5: no toca flyway_schema_history; las tablas
-- existentes conservan su RLS; la secuencia nueva recibe los privilegios por omisión que
-- V0009 da a wamma_app.
--
-- Algunas restricciones de V0003 y V0008 tienen nombres que dependen de cómo se creó cada
-- base (Flyway o el script unificado): donde importa, se buscan en el catálogo en lugar de
-- suponer su nombre.

-- ── 1. Sede única (D-23) ───────────────────────────────────────────────────────
-- La dirección sigue pendiente: mientras no llegue, la ficha muestra solo el nombre.
ALTER TABLE sede ALTER COLUMN direccion DROP NOT NULL;

INSERT INTO sede (codigo, nombre, direccion, ciudad, estado_geografico)
VALUES ('DC', 'Distrito Capital', NULL, 'Caracas', 'Distrito Capital')
ON CONFLICT (codigo) DO NOTHING;

-- ── 2. Vehículo ────────────────────────────────────────────────────────────────
-- Código de inventario estable (plan E3): veh-001 a veh-016 para la demostración y
-- WAM-00017 en adelante. Es el que va en la dirección de la ficha y en el CRM.
-- Un alta sin código recibe el siguiente de la secuencia; la carga de demostración lo
-- indica explícitamente.
CREATE SEQUENCE vehiculo_codigo_seq START WITH 17;

ALTER TABLE vehiculo ADD COLUMN codigo VARCHAR(20) NOT NULL
    DEFAULT ('WAM-' || lpad(nextval('vehiculo_codigo_seq')::text, 5, '0'));
ALTER SEQUENCE vehiculo_codigo_seq OWNED BY vehiculo.codigo;
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_codigo_key UNIQUE (codigo);
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_codigo_check
    CHECK (codigo ~ '^(veh-[0-9]{3}|WAM-[0-9]{5,})$');

-- VIN obligatorio (E4), normalizado: mayúsculas y dígitos, hasta 17. No se exige el formato
-- ISO 3779: los seriales de vehículos antiguos no lo cumplen.
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_vin_check CHECK (vin ~ '^[A-Z0-9]{1,17}$');

-- Placa y adquisición, opcionales en esta fase (D-12). Los cuatro datos de la adquisición
-- van juntos o no van: un monto sin moneda, tasa y fecha no es trazable (Principio V).
ALTER TABLE vehiculo ALTER COLUMN placa DROP NOT NULL;
ALTER TABLE vehiculo
    ALTER COLUMN precio_adquisicion DROP NOT NULL,
    ALTER COLUMN moneda_adquisicion DROP NOT NULL,
    ALTER COLUMN moneda_adquisicion DROP DEFAULT,
    ALTER COLUMN tasa_bcv_adquisicion DROP NOT NULL,
    ALTER COLUMN fecha_tasa_adquisicion DROP NOT NULL;
ALTER TABLE vehiculo DROP CONSTRAINT IF EXISTS vehiculo_moneda_adquisicion_check;
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_moneda_adquisicion_check
    CHECK (moneda_adquisicion IN ('EUR', 'USD', 'VES'));
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_adquisicion_completa_check CHECK (
    (precio_adquisicion IS NULL AND moneda_adquisicion IS NULL
        AND tasa_bcv_adquisicion IS NULL AND fecha_tasa_adquisicion IS NULL)
    OR (precio_adquisicion IS NOT NULL AND moneda_adquisicion IS NOT NULL
        AND tasa_bcv_adquisicion IS NOT NULL AND fecha_tasa_adquisicion IS NOT NULL));

-- Datos que la maqueta siempre pide, con los valores que ya usa.
ALTER TABLE vehiculo
    ALTER COLUMN carroceria SET NOT NULL,
    ALTER COLUMN traccion SET NOT NULL,
    ALTER COLUMN puestos SET NOT NULL;
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_carroceria_check
    CHECK (carroceria IN ('sedan', 'hatchback', 'suv', 'camioneta', 'pick_up', 'coupe'));
ALTER TABLE vehiculo ADD CONSTRAINT vehiculo_traccion_check CHECK (traccion IN ('4x2', '4x4'));

-- Vehículos de la carga inicial de demostración (D-10, D-25): se distinguen de los reales.
ALTER TABLE vehiculo ADD COLUMN es_demostracion BOOLEAN NOT NULL DEFAULT false;

-- ── 3. Publicación ─────────────────────────────────────────────────────────────
-- Precios en euros (D-21, Constitución v3.0.0). Moneda y estado los declara quien registra
-- la publicación, como en V0011: el valor por omisión anterior ('USD', 'publicado') era
-- justo el que no debe suponerse. La tasa y su fecha se fijan al publicar: un borrador
-- todavía no tiene un precio vigente frente al público.
ALTER TABLE publicacion ALTER COLUMN moneda DROP DEFAULT;
ALTER TABLE publicacion DROP CONSTRAINT IF EXISTS publicacion_moneda_check;
ALTER TABLE publicacion ADD CONSTRAINT publicacion_moneda_check CHECK (moneda IN ('EUR', 'VES'));
ALTER TABLE publicacion ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE publicacion
    ALTER COLUMN tasa_bcv DROP NOT NULL,
    ALTER COLUMN fecha_tasa DROP NOT NULL;
ALTER TABLE publicacion ADD CONSTRAINT publicacion_tasa_fijada_check
    CHECK (estado = 'borrador' OR (tasa_bcv IS NOT NULL AND fecha_tasa IS NOT NULL));

-- Etiqueta comercial que la vitrina pinta sobre la foto.
ALTER TABLE publicacion ADD COLUMN etiqueta VARCHAR(30);
ALTER TABLE publicacion ADD CONSTRAINT publicacion_etiqueta_check
    CHECK (etiqueta IN ('recien_ingresado', 'dificil_de_conseguir', 'listo_para_entrega'));

-- ── 4. Fotos de la publicación ─────────────────────────────────────────────────
-- Se guarda la clave del objeto y no su URL: la URL se arma con la configuración, así que
-- cambiar de proveedor de almacenamiento no toca la base (D-09). La tabla no se ha usado
-- en ningún entorno, por eso las columnas nuevas pueden nacer obligatorias.
ALTER TABLE publicacion_foto RENAME COLUMN url TO clave;
ALTER TABLE publicacion_foto
    ADD COLUMN clave_miniatura TEXT NOT NULL,
    ADD COLUMN ancho INT NOT NULL,
    ADD COLUMN alto INT NOT NULL,
    ADD COLUMN subida_por UUID REFERENCES usuario(id) ON DELETE RESTRICT,
    ADD COLUMN credito_autor VARCHAR(120),
    ADD COLUMN credito_licencia VARCHAR(60),
    ADD COLUMN credito_origen TEXT;
ALTER TABLE publicacion_foto ADD CONSTRAINT publicacion_foto_dimensiones_check CHECK (ancho > 0 AND alto > 0);
ALTER TABLE publicacion_foto ADD CONSTRAINT publicacion_foto_orden_check CHECK (orden BETWEEN 0 AND 9);
-- Crédito de las fotos referenciales (D-25, E9-A): autor y licencia van juntos.
ALTER TABLE publicacion_foto ADD CONSTRAINT publicacion_foto_credito_check CHECK (
    (credito_autor IS NULL AND credito_licencia IS NULL AND credito_origen IS NULL)
    OR (credito_autor IS NOT NULL AND credito_licencia IS NOT NULL));
CREATE UNIQUE INDEX publicacion_foto_una_principal ON publicacion_foto (publicacion_id) WHERE es_principal;
CREATE INDEX idx_publicacion_foto_subida_por ON publicacion_foto (subida_por);

-- ── 5. Inspección: certificación simplificada (plan E7) ────────────────────────
-- El inspector puede faltar solo en la carga inicial de demostración.
-- Las inspecciones que existieran fueron manuales; las nuevas declaran su origen.
ALTER TABLE inspeccion ADD COLUMN origen VARCHAR(20) NOT NULL DEFAULT 'manual';
ALTER TABLE inspeccion ALTER COLUMN origen DROP DEFAULT;
ALTER TABLE inspeccion ADD CONSTRAINT inspeccion_origen_check CHECK (origen IN ('manual', 'carga_inicial'));
ALTER TABLE inspeccion ALTER COLUMN inspector_id DROP NOT NULL;
ALTER TABLE inspeccion ADD CONSTRAINT inspeccion_inspector_check
    CHECK (inspector_id IS NOT NULL OR origen = 'carga_inicial');

-- Una imperfección es un punto estético no conforme: le hace falta su ubicación, y su
-- posición sobre el diagrama es un porcentaje del área.
ALTER TABLE inspeccion_punto ADD COLUMN ubicacion VARCHAR(80);
ALTER TABLE inspeccion_punto ADD CONSTRAINT inspeccion_punto_posicion_check CHECK (
    (posicion_x IS NULL OR posicion_x BETWEEN 0 AND 100)
    AND (posicion_y IS NULL OR posicion_y BETWEEN 0 AND 100));

-- ── 6. Tasa BCV por moneda (plan E2) ───────────────────────────────────────────
-- La tabla nació solo para el dólar. Ahora guarda una tasa por fecha y moneda; la de la
-- vitrina es la del euro (D-21). La fila existente queda como USD.
ALTER TABLE tasa_cambio_bcv ADD COLUMN moneda VARCHAR(3);
UPDATE tasa_cambio_bcv SET moneda = 'USD' WHERE moneda IS NULL;
ALTER TABLE tasa_cambio_bcv ALTER COLUMN moneda SET NOT NULL;
ALTER TABLE tasa_cambio_bcv ADD CONSTRAINT tasa_cambio_bcv_moneda_check CHECK (moneda IN ('EUR', 'USD'));
ALTER TABLE tasa_cambio_bcv RENAME COLUMN tasa_usd_ves TO tasa_ves;
ALTER TABLE tasa_cambio_bcv ALTER COLUMN tasa_ves TYPE NUMERIC(18, 8);
-- Corregir la tasa de un día deja rastro de quién y cuándo, además de la bitácora.
ALTER TABLE tasa_cambio_bcv
    ADD COLUMN actualizado_en TIMESTAMPTZ,
    ADD COLUMN actualizado_por UUID REFERENCES usuario(id) ON DELETE RESTRICT;
CREATE INDEX idx_tasa_bcv_actualizado_por ON tasa_cambio_bcv (actualizado_por);

-- El UNIQUE (fecha) original se busca por su columna, no por su nombre.
DO $$
DECLARE
    restriccion text;
BEGIN
    FOR restriccion IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
        WHERE c.conrelid = 'tasa_cambio_bcv'::regclass
          AND c.contype = 'u'
          AND array_length(c.conkey, 1) = 1
          AND a.attname = 'fecha'
    LOOP
        EXECUTE format('ALTER TABLE tasa_cambio_bcv DROP CONSTRAINT %I', restriccion);
    END LOOP;
END
$$;
ALTER TABLE tasa_cambio_bcv ADD CONSTRAINT tasa_cambio_bcv_fecha_moneda_key UNIQUE (fecha, moneda);
DROP INDEX IF EXISTS idx_tasa_bcv_fecha;
CREATE INDEX idx_tasa_bcv_moneda_fecha ON tasa_cambio_bcv (moneda, fecha DESC);
