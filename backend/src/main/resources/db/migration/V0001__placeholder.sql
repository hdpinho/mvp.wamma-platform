-- Flyway: primera migración placeholder.
-- Las migraciones reales se crean con cada módulo implementado.
-- El ledger (módulo 007) es APPEND-ONLY: prohibido ALTER/DROP en sus tablas.

-- Placeholder para que Flyway no falle al arrancar sin migraciones.
SELECT 1;
