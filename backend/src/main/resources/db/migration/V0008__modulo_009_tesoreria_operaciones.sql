-- ==============================================================================
-- WAMMA PLATFORM — V0008: Módulo 009 (Tesorería, Tasas BCV y Operaciones)
-- Conforme a specs/009-tablero-tesoreria
-- ==============================================================================

-- 36. Tasas de Cambio Oficiales BCV
CREATE TABLE IF NOT EXISTS tasa_cambio_bcv (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha DATE NOT NULL UNIQUE,
    tasa_usd_ves NUMERIC(14, 4) NOT NULL CHECK (tasa_usd_ves > 0),
    fuente VARCHAR(50) NOT NULL DEFAULT 'BCV_OFICIAL',
    capturado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    capturado_por UUID REFERENCES usuario(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasa_bcv_fecha ON tasa_cambio_bcv(fecha DESC);

-- Cargar tasa inicial de referencia
INSERT INTO tasa_cambio_bcv (fecha, tasa_usd_ves, fuente)
VALUES (CURRENT_DATE, 40.5000, 'BCV_OFICIAL')
ON CONFLICT (fecha) DO NOTHING;

-- 37. Movimiento de Inventario y Traslados (INMUTABLE / APPEND-ONLY)
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

CREATE OR REPLACE TRIGGER trg_movimiento_inventario_inmutable
BEFORE UPDATE OR DELETE ON movimiento_inventario
FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();

CREATE INDEX idx_movimiento_inv_vehiculo ON movimiento_inventario(vehiculo_id);
CREATE INDEX idx_movimiento_inv_fecha ON movimiento_inventario(creado_en DESC);

-- 38. Notificaciones y Mensajería al Cliente
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

CREATE INDEX idx_notificacion_persona ON notificacion(destinatario_persona_id);
CREATE INDEX idx_notificacion_estado ON notificacion(estado);
