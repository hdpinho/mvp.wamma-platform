# Regla de proyecto WAMMA (Antigravity · Always On)

> Activación recomendada: **Always On**. Esta regla < 12.000 caracteres. Para detalle completo, el agente debe abrir `.specify/memory/constitution.md` y el `spec.md` del módulo en curso.

## Contexto
Plataforma propia de **WAMMA by Token Pago POS**: venta, certificación y financiamiento de vehículos usados en Venezuela (modelo Kavak adaptado al mercado local). **No opera bajo supervisión de Sudeban en esta etapa** (Constitución v2.0.0). Negocio en `@Base_Conocimiento_Wamma.md` (fuente única de verdad).

## Antes de actuar
1. Lee `@.specify/memory/constitution.md` (vinculante, máxima precedencia).
2. Lee el `spec.md` del módulo objetivo y confirma sus dependencias en `@specs/000-overview/tasks-build-order.md`.
3. CÓMO técnico: `@specs/000-overview/architecture-plan.md` y `@specs/000-overview/data-model.md`.

## Principios que no se negocian
- **Protección del dato personal día 1:** módulo 001 primero, separación de funciones en RBAC, mínimo privilegio y cifrado AES-256-GCM + blind index para datos sensibles.
- **Portabilidad de la infraestructura:** contenedores e infraestructura como código; la residencia de datos en Venezuela ya no es exigencia (Constitución v2.0.0).
- **Código propiedad de WAMMA:** repositorios en organización WAMMA.
- **Ledger sagrado:** partida doble, inmutable (append-only), multi-moneda EUR/BCV (Constitución v3.0.0), sin `float` para montos.
- **Seguridad transversal:** cifrado en reposo/tránsito, 2FA admin, bitácora de auditoría inmutable.
- **MVP primero:** la velocidad nunca pisa cumplimiento, seguridad ni integridad financiera.
- **Sin commit sin aprobación:** no ejecutar `git commit` ni `git push` hasta que el usuario pruebe y apruebe explícitamente.

## Comportamiento
- No inventes cifras, posiciones de la estructura ni requisitos regulatorios → usa `[NEEDS CLARIFICATION: ...]` y consulta.
- No implementes un módulo si sus dependencias no existen.
- Si un cambio viola la Constitución, **detente** y repórtalo.
- Verifica tu trabajo en pruebas locales (`LocalDevServer.java` con PostgreSQL embebido y suite de pruebas); cobertura alta para reglas de negocio.
- Documentación y commits en español (`tipo(modulo): descripción`); identificadores de código en inglés.
- Secretos fuera del repositorio (en local residen en `backend/.env`).

## Stack
React + Vite + TypeScript (web) · Flutter (móvil) · Spring Boot 4.1 (Java 21, monolito modular) · Supabase Cloud (PostgreSQL administrado) · Flyway · Maven · Almacenamiento compatible S3.

## Estado actual
- **Fase 1 (CRM y Citas, `010-crm-comercial`):** 100% completada y verificada en local (migración V0017, repositorios JDBC, servicios, API REST, `api/crm.ts`, `state/crm.tsx` y 120 tests pasando).
- **Fase 2 (Motor de Parámetros de Financiamiento):** 100% completada y verificada (tabla `parametros_financiamiento` `V0015`, endpoints `/v1/parametros-financiamiento`, conexión en `C10`, `O6` y simuladores con 123 tests pasando).
- **Fase 3 (Solicitud de Crédito Digital - Digitalización WMA-F-FIN-001):** 100% completada y verificada en local (migración `V0018__solicitud_credito_eur.sql`, paquete `com.wamma.credit.application`, expediente y recaudos en storage, transición CRM a `solicitud_credito`, pantallas `C9_SolicitudCredito` y `O7_AnalisisCredito` con dictamen de riesgo, 125 tests backend y 17 tests frontend).
- **Fase 4 (Motor de Riesgo, Scoring de 5 Factores y AML - módulo 006):** 100% completada y verificada en local (paquete `com.wamma.risk`, scoring 0–1000 pts en 5 factores, homologación a Buró 100–800 pts, screening OFAC/PEP con gestión de alertas `alerta_aml`, integración backoffice `O7_AnalisisCredito.tsx` con ejecución en vivo y 133 tests backend pasando).
