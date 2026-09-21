-- ============================================================================
-- V0016: Actualización de etiquetas comerciales de la vitrina WAMMA
--
-- Requerimiento de negocio (Mejoras 18 Septiembre 2026):
-- Solo se admiten tres etiquetas en la vitrina:
-- 1. 'recien_ingresado'   (Recién ingresado)
-- 2. 'reservado_para_cita' (Reservado para cita)
-- 3. 'super_oportunidad'  (Súper oportunidad)
--
-- Se migran los registros históricos con etiquetas descontinuadas:
-- - 'dificil_de_conseguir' -> 'super_oportunidad'
-- - 'listo_para_entrega'    -> 'super_oportunidad'
-- ============================================================================

UPDATE publicacion
SET etiqueta = 'super_oportunidad'
WHERE etiqueta IN ('dificil_de_conseguir', 'listo_para_entrega');

ALTER TABLE publicacion DROP CONSTRAINT IF EXISTS publicacion_etiqueta_check;

ALTER TABLE publicacion ADD CONSTRAINT publicacion_etiqueta_check
    CHECK (etiqueta IN ('recien_ingresado', 'reservado_para_cita', 'super_oportunidad'));
