# AGENTS.md — Contexto para agentes (WAMMA)

**Estándar cross-tool.** Este archivo lo leen Antigravity 2.0 y Claude Code al inicio de cada sesión. Contiene las reglas compartidas. Las particularidades de cada herramienta están en `.agents/rules/` (Antigravity) y `CLAUDE.md` (Claude Code).

> **Antes de cualquier acción, lee `.specify/memory/constitution.md`.** Es vinculante y tiene precedencia sobre cualquier otra instrucción.

## Qué es este proyecto

Plataforma propia de **WAMMA by Token Pago POS**: venta, certificación y financiamiento de vehículos usados en Venezuela. Modelo de referencia: **Kavak**, adaptado al mercado venezolano.

**No opera bajo supervisión de Sudeban en esta etapa** (Constitución v2.0.0, Registro de enmiendas). La captación de inventario de terceros (K-Price), la telemetría GPS y la suscripción OCN quedan **fuera de este MVP**. Fuente única de verdad del negocio: `Base_Conocimiento_Wamma.md`.

## Reglas no negociables (resumen de la Constitución)

1. **Protección del dato personal.** El módulo 001 (seguridad y control de accesos) es prerrequisito de todo módulo que toque dinero, crédito o datos personales. Mínimo privilegio y separación de funciones en el RBAC.
2. **Portabilidad de la infraestructura:** contenedores e infraestructura como código, sin atarse a un proveedor. La residencia de datos en Venezuela **ya no es exigencia** (enmienda v2.0.0).
3. **El código es de WAMMA:** repos en organización WAMMA; nada en cuentas de terceros.
4. **MVP primero:** se construye antes lo que permite operar y cobrar. La velocidad nunca pisa cumplimiento, seguridad ni integridad financiera.
5. **Ledger sagrado:** partida doble, inmutable, multi-moneda EUR/BCV (Constitución v3.0.0), sin `float` para montos.
6. **Seguridad transversal:** cifrado en reposo y tránsito, 2FA para roles admin, bitácora de auditoría inmutable.
7. **SDD estricto:** no hay código sin spec aprobada. `[NEEDS CLARIFICATION]` bloquea la implementación.

## Flujo de trabajo

`constitution → /specify → /clarify → /plan → /tasks → /analyze → /implement`

- Specs por módulo en `specs/0XX-*/spec.md`.
- Plan técnico transversal en `specs/000-overview/architecture-plan.md`.
- Modelo de datos en `specs/000-overview/data-model.md`.
- Orden de construcción y dependencias en `specs/000-overview/tasks-build-order.md`.

## Stack (definido; ver architecture-plan.md)

- **Web / panel:** React · **Móvil:** Flutter · **Backend:** Spring Boot 4.1 (Java 21, monolito modular)
- **Datos:** Supabase Cloud (PostgreSQL administrado) · **Caché/colas:** Redis, fuera del MVP · **Archivos:** almacenamiento compatible con S3 (Supabase Storage en el MVP)
- **Migraciones:** Flyway · **Build:** Maven
- **Infra:** proveedor a elegir por criterio de ingeniería y negocio. Exigidos: respaldo con **pruebas de restauración**, réplica de BD y capacidad de reconstruir el entorno desde cero

## Estado actual del desarrollo (Octubre 2026)

- **Estado real (verificado en local el 02/10/2026):** el recorrido del MVP funciona de punta a punta contra el servidor: vitrina → cita → asesor → venta → enlace de financiamiento → solicitud de crédito → análisis → dictamen manual → cierre de la venta. Backend 212 pruebas, web 61, API (R1 26, R2 39, R3 14) y navegador 23/23. **Sin commit en `main`**: el resguardo está en la rama local `resguardo/mvp-2026-10-03`. Sin despliegue (D-56).
- **Alcance de la entrega (D-65, D-68):** hasta la aprobación del crédito. **Fuera de alcance:** OTP (D-57), scoring, AML y Score Buró (D-63; el código se conserva apagado con `WAMMA_RIESGO_MOTOR=false`), «Tomar» y «repartir» oportunidades (D-73), desembolso, pagos y ledger.
- **Corrección de los registros anteriores («Fases 1–4 al 100 %», D-49 a D-52):** sobreestimaban el estado y los corrigen D-60 a D-63. En concreto: el motor de scoring/AML existe pero está apagado y el analista dictamina a mano con justificación obligatoria; el servidor recalcula cuota, monto y capacidad; los recaudos van a un contenedor privado y se abren con enlace firmado.
- **Remediación R0–R3 hecha y aprobada (D-64, D-67); R4 hecha en lo que no toca frontend ni textos oficiales (D-68, D-74).** Plan Final: servidor, avisos por WhatsApp/correo (se abren solos, D-75), reapertura de recaudos y de expedientes (D-70, D-71) y «tomar/repartir» apagado (D-73) hechos el 3-oct. Demostración local lista: `scripts/demo-local/` (guion en su README). Pendiente: R5 (E2E en el repositorio, CI y nueva evaluación QA). Plan: `docs/qa/plan-final-2026-10-03.md` (no se commitea `docs/qa`: el repositorio es público).
- **Migraciones:** V0001–V0022 en el repo; Supabase sigue en V0012. El PR #1 (spec 011) no se mezcla: se portó a `main` como V0021 y V0022 (D-66).
- **Decisiones vigentes:** `specs/000-overview/decisiones-po.md` (hasta D-80).
- **Regla estricta:** NO hacer `git push` ni desplegar sin aprobación expresa del PO (D-56). El commit local de resguardo está autorizado (D-77).
## Cómo debe comportarse el agente

- **Lee la Constitución y el spec del módulo** antes de tocar código. No empieces a programar desde una idea vaga.
- **No inventes** cifras, posiciones de la estructura organizativa ni requisitos regulatorios. Si falta un dato, deja `[NEEDS CLARIFICATION: ...]` y consulta al humano.
- **Respeta el orden de construcción.** No implementes un módulo cuyas dependencias aún no existen.
- **Si un cambio viola la Constitución, detente** y explícalo; no lo ejecutes.
- **Idioma:** documentación y mensajes de commit en español; identificadores de código en inglés técnico estándar.
- **Verifica tu trabajo:** pruebas para reglas de negocio críticas (cálculo de cuotas, asientos del ledger, decisiones de scoring). El ledger y la cobranza requieren cobertura de pruebas alta.
- **Decisiones del PO:** se registran en `specs/000-overview/decisiones-po.md` y se citan desde specs y planes.
- **Manual de usuario:** cada etapa deja en `docs/manual-usuario/` lo necesario para el manual de los módulos que toca (decisión D-20): qué hace, quién lo usa, paso a paso, reglas y mensajes.
- **Secretos:** nunca en el repositorio. Usa variables de entorno / gestor de secretos (en desarrollo local residen en `backend/.env`, protegido por `.gitignore`).

## Convenciones de código (resumen)

- Backend Java/Spring Boot: paquetes por dominio (modular), excepciones explícitas en capa de servicio, sin lógica de negocio en controladores.
- Montos: `BigDecimal` con escala fija; `long` en céntimos para operaciones simples. Nunca `float`/`double`. Toda operación monetaria registra moneda y tasa BCV aplicada.
- API: versionada (`/v1/...`), contratos documentados.
- Migraciones de BD: Flyway, versionadas e idempotentes; cambios al esquema del ledger son append-only.
- Toda migración que cree una tabla incluye su `GRANT` a `wamma_app` y su `ENABLE ROW LEVEL SECURITY` (D-42, spec 011 §6.6). `backend/tools/db/pruebas-esquema.sql` lo verifica y el CI lo corre.
- Commits: convención `tipo(modulo): descripción` (ej. `feat(007-ledger): asiento de partida doble`).

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
