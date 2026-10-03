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

## Estado actual (02/10/2026)

- **Estado real (verificado en local el 02/10/2026):** el recorrido del MVP funciona de punta a punta contra el servidor: vitrina → cita → asesor → venta → enlace de financiamiento → solicitud de crédito → análisis → dictamen manual → cierre de la venta. Backend 212 pruebas, web 61, API (R1 26, R2 39, R3 14) y navegador 23/23. **Sin commit en `main`**: el resguardo está en la rama local `resguardo/mvp-2026-10-03`. Sin despliegue (D-56).
- **Alcance de la entrega (D-65, D-68):** hasta la aprobación del crédito. **Fuera de alcance:** OTP (D-57), scoring, AML y Score Buró (D-63; el código se conserva apagado con `WAMMA_RIESGO_MOTOR=false`), «Tomar» y «repartir» oportunidades (D-73), desembolso, pagos y ledger.
- **Corrección de los registros anteriores («Fases 1–4 al 100 %», D-49 a D-52):** sobreestimaban el estado y los corrigen D-60 a D-63. En concreto: el motor de scoring/AML existe pero está apagado y el analista dictamina a mano con justificación obligatoria; el servidor recalcula cuota, monto y capacidad; los recaudos van a un contenedor privado y se abren con enlace firmado.
- **Remediación R0–R3 hecha y aprobada (D-64, D-67); R4 hecha en lo que no toca frontend ni textos oficiales (D-68, D-74).** Plan Final: servidor, avisos por WhatsApp/correo (se abren solos, D-75), reapertura de recaudos y de expedientes (D-70, D-71) y «tomar/repartir» apagado (D-73) hechos el 3-oct. Demostración local lista: `scripts/demo-local/` (guion en su README). Pendiente: R5 (E2E en el repositorio, CI y nueva evaluación QA). Plan: `docs/qa/plan-final-2026-10-03.md` (no se commitea `docs/qa`: el repositorio es público).
- **Migraciones:** V0001–V0022 en el repo; Supabase sigue en V0012. El PR #1 (spec 011) no se mezcla: se portó a `main` como V0021 y V0022 (D-66).
- **Decisiones vigentes:** `specs/000-overview/decisiones-po.md` (hasta D-80).
- **Regla estricta:** NO hacer `git push` ni desplegar sin aprobación expresa del PO (D-56). El commit local de resguardo está autorizado (D-77).
