-- ==============================================================================
-- WAMMA PLATFORM — V0005: Módulo 005 (Catálogo, Vitrina, Reservas y Garantía)
-- Conforme a specs/005-catalogo-venta
-- ==============================================================================

-- 21. Publicaciones (Vitrina de Vehículos Certificados)
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

CREATE TRIGGER trg_publicacion_actualizado_en
BEFORE UPDATE ON publicacion
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

CREATE INDEX idx_publicacion_estado_precio ON publicacion(estado, precio_venta);
CREATE INDEX idx_publicacion_fecha ON publicacion(publicado_en DESC);

-- 22. Fotos de la Publicación
CREATE TABLE IF NOT EXISTS publicacion_foto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publicacion_id UUID NOT NULL REFERENCES publicacion(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    orden SMALLINT NOT NULL DEFAULT 0,
    es_principal BOOLEAN NOT NULL DEFAULT false,
    etiqueta VARCHAR(50),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_publicacion_foto_pub ON publicacion_foto(publicacion_id, orden);

-- 23. Reservas / Apartado de Vehículo
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

CREATE INDEX idx_reserva_publicacion ON reserva(publicacion_id);
CREATE INDEX idx_reserva_persona ON reserva(persona_id);
CREATE INDEX idx_reserva_estado ON reserva(estado);

-- 24. Garantía y Devolución Post-Venta
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

CREATE INDEX idx_garantia_vehiculo ON garantia_devolucion(vehiculo_id);
CREATE INDEX idx_garantia_cliente ON garantia_devolucion(cliente_persona_id);
