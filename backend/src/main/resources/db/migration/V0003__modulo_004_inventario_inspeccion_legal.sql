-- ==============================================================================
-- WAMMA PLATFORM — V0003: Módulo 004 (Inventario, Inspección 240 Puntos y Legal)
-- Conforme a specs/004-inspeccion-240-puntos
-- ==============================================================================

-- 8. Sedes Físicas de WAMMA
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

-- 9. Vehículos (Inventario Propio WAMMA)
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

CREATE OR REPLACE TRIGGER trg_vehiculo_actualizado_en
BEFORE UPDATE ON vehiculo
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE INDEX idx_vehiculo_vin ON vehiculo(vin);
CREATE INDEX idx_vehiculo_placa ON vehiculo(placa);
CREATE INDEX idx_vehiculo_estado ON vehiculo(estado);
CREATE INDEX idx_vehiculo_marca_modelo ON vehiculo(marca, modelo);
CREATE INDEX idx_vehiculo_sede ON vehiculo(sede_id);

-- 10. Inspección de 240 Puntos (Cabecera)
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

CREATE INDEX idx_inspeccion_vehiculo ON inspeccion(vehiculo_id);
CREATE INDEX idx_inspeccion_inspector ON inspeccion(inspector_id);
CREATE INDEX idx_inspeccion_estado ON inspeccion(estado);

-- 11. Puntos Individuales de la Inspección (Checklist 240 Puntos)
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

CREATE INDEX idx_inspeccion_punto_inspeccion ON inspeccion_punto(inspeccion_id);
CREATE INDEX idx_inspeccion_punto_categoria ON inspeccion_punto(categoria);
CREATE INDEX idx_inspeccion_punto_resultado ON inspeccion_punto(resultado);

-- 12. Validación Legal
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

CREATE INDEX idx_validacion_legal_vehiculo ON validacion_legal(vehiculo_id);
