# Regla de proyecto WAMMA (Antigravity · Always On)

> Activación recomendada: **Always On**. Esta regla < 12.000 caracteres. Para detalle completo, el agente debe abrir `.specify/memory/constitution.md` y el `spec.md` del módulo en curso.

## Contexto
Plataforma propia de **WAMMA by Token Pago POS**: fintech venezolana de vehículos usados (modelo Kavak + suscripción OCN), regulada por **Sudeban**. Negocio en `@Base_Conocimiento_Wamma.md` (fuente única de verdad).

## Antes de actuar
1. Lee `@.specify/memory/constitution.md` (vinculante, máxima precedencia).
2. Lee el `spec.md` del módulo objetivo y confirma sus dependencias en `@specs/000-overview/tasks-build-order.md`.
3. CÓMO técnico: `@specs/000-overview/architecture-plan.md` y `@specs/000-overview/data-model.md`.

## Principios que no se negocian
- **Cumplimiento Sudeban día 1** (módulo 001 primero, AML OFAC/PEP, expediente técnico, separación de funciones en RBAC).
- **Soberanía de datos:** core en infraestructura nacional; prohibido hyperscalers extranjeros para el core.
- **Código propiedad de WAMMA:** repos en organización WAMMA.
- **Ledger sagrado:** partida doble, inmutable (append-only), multi-moneda USD/BCV, sin `float` para montos.
- **Seguridad transversal:** cifrado en reposo/tránsito, 2FA admin, bitácora de auditoría inmutable.
- **MVP primero**, pero la velocidad nunca pisa cumplimiento, seguridad ni integridad financiera.

## Comportamiento
- No inventes cifras, posiciones de la estructura ni requisitos regulatorios → usa `[NEEDS CLARIFICATION: ...]` y consulta.
- No implementes un módulo si sus dependencias no existen.
- Si un cambio viola la Constitución, **detente** y repórtalo.
- Verifica tu trabajo en navegador/pruebas cuando aplique; cobertura alta para ledger, cuotas, scoring y reglas GPS.
- Documentación y commits en español (`tipo(modulo): descripción`); identificadores de código en inglés.
- Secretos fuera del repositorio.

## Stack
React (web) · Flutter (móvil) · Go monolito modular (backend) · PostgreSQL · Redis · object storage nacional · infra nacional Tier III + DR + réplica de BD.
