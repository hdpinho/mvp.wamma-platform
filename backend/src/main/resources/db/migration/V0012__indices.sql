-- ==============================================================================
-- WAMMA PLATFORM — V0012: Índices
-- Criterio de specs/000-overview/database-schema-design.md §1.4: toda clave foránea
-- con índice, y ningún índice que duplique el de una restricción UNIQUE.
-- Los índices del CRM van en V0010, junto con el modelo que los necesita.
-- ==============================================================================

-- ── 1. Duplicados: la restricción UNIQUE ya crea su propio índice ──────────────
DROP INDEX IF EXISTS idx_usuario_email;
DROP INDEX IF EXISTS idx_vehiculo_vin;
DROP INDEX IF EXISTS idx_vehiculo_placa;
DROP INDEX IF EXISTS idx_solicitud_numero;
DROP INDEX IF EXISTS idx_decision_riesgo_solicitud;
DROP INDEX IF EXISTS idx_cuenta_codigo;
DROP INDEX IF EXISTS idx_asiento_numero;
DROP INDEX IF EXISTS idx_credito_numero;
DROP INDEX IF EXISTS idx_pago_idempotency;
DROP INDEX IF EXISTS idx_conciliacion_pago;
DROP INDEX IF EXISTS idx_tasa_bcv_fecha;
-- Cubierto por UNIQUE (inspeccion_id, codigo_punto), que empieza por inspeccion_id.
DROP INDEX IF EXISTS idx_inspeccion_punto_inspeccion;

-- ── 2. Claves foráneas sin índice ──────────────────────────────────────────────
-- Sin índice, borrar o actualizar la fila referenciada recorre la tabla entera y
-- bloquea más de lo necesario.
CREATE INDEX IF NOT EXISTS idx_usuario_rol_asignado_por ON usuario_rol (asignado_por);
CREATE INDEX IF NOT EXISTS idx_validacion_legal_analista ON validacion_legal (analista_id);
CREATE INDEX IF NOT EXISTS idx_publicacion_creado_por ON publicacion (creado_por);
CREATE INDEX IF NOT EXISTS idx_solicitud_vehiculo ON solicitud_credito (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_decision_riesgo_evaluado_por ON decision_riesgo (evaluado_por);
CREATE INDEX IF NOT EXISTS idx_alerta_aml_revisado_por ON alerta_aml (revisado_por);
CREATE INDEX IF NOT EXISTS idx_cuenta_contable_padre ON cuenta_contable (cuenta_padre_id);
CREATE INDEX IF NOT EXISTS idx_asiento_compensa ON asiento (compensa_asiento_id);
CREATE INDEX IF NOT EXISTS idx_asiento_creado_por ON asiento (creado_por);
CREATE INDEX IF NOT EXISTS idx_credito_vehiculo ON credito (vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_pago_cuota ON pago (cuota_id);
CREATE INDEX IF NOT EXISTS idx_pago_asiento ON pago (asiento_id);
CREATE INDEX IF NOT EXISTS idx_conciliacion_conciliado_por ON conciliacion (conciliado_por);
CREATE INDEX IF NOT EXISTS idx_tasa_bcv_capturado_por ON tasa_cambio_bcv (capturado_por);
CREATE INDEX IF NOT EXISTS idx_movimiento_inv_autor ON movimiento_inventario (autor_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_inv_sede_origen ON movimiento_inventario (sede_origen_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_inv_sede_destino ON movimiento_inventario (sede_destino_id);
CREATE INDEX IF NOT EXISTS idx_notificacion_usuario ON notificacion (destinatario_usuario_id);
