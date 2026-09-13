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
5. **Ledger sagrado:** partida doble, inmutable, multi-moneda USD/BCV, sin `float` para montos.
6. **Seguridad transversal:** cifrado en reposo y tránsito, 2FA para roles admin, bitácora de auditoría inmutable.
7. **SDD estricto:** no hay código sin spec aprobada. `[NEEDS CLARIFICATION]` bloquea la implementación.

## Flujo de trabajo

`constitution → /specify → /clarify → /plan → /tasks → /analyze → /implement`

- Specs por módulo en `specs/0XX-*/spec.md`.
- Plan técnico transversal en `specs/000-overview/architecture-plan.md`.
- Modelo de datos en `specs/000-overview/data-model.md`.
- Orden de construcción y dependencias en `specs/000-overview/tasks-build-order.md`.

## Stack (definido; ver architecture-plan.md)

- **Web / panel:** React · **Móvil:** Flutter · **Backend:** Spring Boot (Java 21, monolito modular)
- **Datos:** Supabase Cloud (PostgreSQL administrado) · **Caché/colas:** Redis · **Archivos:** object storage
- **Migraciones:** Flyway · **Build:** Maven
- **Infra:** proveedor a elegir por criterio de ingeniería y negocio. Exigidos: respaldo con **pruebas de restauración**, réplica de BD y capacidad de reconstruir el entorno desde cero

## Cómo debe comportarse el agente

- **Lee la Constitución y el spec del módulo** antes de tocar código. No empieces a programar desde una idea vaga.
- **No inventes** cifras, posiciones de la estructura organizativa ni requisitos regulatorios. Si falta un dato, deja `[NEEDS CLARIFICATION: ...]` y consulta al humano.
- **Respeta el orden de construcción.** No implementes un módulo cuyas dependencias aún no existen.
- **Si un cambio viola la Constitución, detente** y explícalo; no lo ejecutes.
- **Idioma:** documentación y mensajes de commit en español; identificadores de código en inglés técnico estándar.
- **Verifica tu trabajo:** pruebas para reglas de negocio críticas (cálculo de cuotas, asientos del ledger, decisiones de scoring). El ledger y la cobranza requieren cobertura de pruebas alta.
- **Secretos:** nunca en el repositorio. Usa variables de entorno / gestor de secretos (en desarrollo local residen en `backend/.env`, protegido por `.gitignore`).

## Convenciones de código (resumen)

- Backend Java/Spring Boot: paquetes por dominio (modular), excepciones explícitas en capa de servicio, sin lógica de negocio en controladores.
- Montos: `BigDecimal` con escala fija; `long` en céntimos para operaciones simples. Nunca `float`/`double`. Toda operación monetaria registra moneda y tasa BCV aplicada.
- API: versionada (`/v1/...`), contratos documentados.
- Migraciones de BD: Flyway, versionadas e idempotentes; cambios al esquema del ledger son append-only.
- Commits: convención `tipo(modulo): descripción` (ej. `feat(007-ledger): asiento de partida doble`).

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
