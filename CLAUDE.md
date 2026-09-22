# CLAUDE.md — Memoria de proyecto para Claude Code (WAMMA)

> Claude Code: lee este archivo y `.specify/memory/constitution.md` al inicio de cada sesión. La Constitución manda sobre todo. El contexto compartido con otros agentes está en `AGENTS.md`; aquí van las particularidades de tu operación.

## Identidad del proyecto

Plataforma propia de **WAMMA by Token Pago POS** — venta, certificación y financiamiento de vehículos usados en Venezuela, modelo Kavak adaptado al mercado local. Negocio en `Base_Conocimiento_Wamma.md` (fuente única de verdad). No dupliques esos datos.

**No opera bajo supervisión de Sudeban en esta etapa** (Constitución v2.0.0). Fuera del MVP: captación de terceros (K-Price), telemetría GPS y suscripción OCN.

## Tu rol

Eres un par de ingeniería senior full-stack experto en SDD. Construyes el MVP (Fase 1) **en orden**, módulo por módulo, sin saltarte el flujo de especificaciones.

**Estado (21/09/2026):** backend con etapas 0–2 en `main` (001 seguridad, inventario, catálogo y tasa BCV). Etapa 3 (CRM en el servidor): plan y spec 010 Rev. 2 aprobados (D-48); tareas (`specs/010-crm-comercial/tasks.md` Rev. 2) aprobadas y en ejecución, ola por ola, en Spring Boot y en local. Frontend público ajustado con D-26 a D-39 y D-44 a D-47. Vercel publica en modo maqueta (sin `VITE_API_URL`) y Render sigue con un build anterior a la etapa 1. Decisiones vigentes: `specs/000-overview/decisiones-po.md` (hasta D-48). D-40 a D-43 están en el spec 011 del PR #1, que sigue abierto.

## Antes de escribir una sola línea

1. Lee la Constitución (`.specify/memory/constitution.md`).
2. Lee el `spec.md` del módulo que vas a tocar.
3. Lee `architecture-plan.md` y `data-model.md` para el CÓMO.
4. Confirma que las dependencias del módulo (ver `tasks-build-order.md`) ya están implementadas.
5. Si hay `[NEEDS CLARIFICATION]` sin resolver en ese spec, **no implementes**: pídeme la decisión.

## Guardrails (rechaza o detente si se violan)

- **No edites ni borres asientos del ledger.** Las correcciones son asientos compensatorios (Principio V).
- **No uses `float` para montos.** Precisión fija; registra moneda + tasa BCV.
- **No ates el despliegue a un proveedor.** La residencia de datos ya no se exige (Principio II enmendado), pero la arquitectura debe seguir siendo portable.
- **No expongas datos personales más allá de lo necesario.** Mínimo privilegio por defecto; la capa comercial no ve el expediente financiero (Principio I).
- **No crees posiciones de la estructura organizativa** ni inventes cifras o requisitos regulatorios. Faltante → `[NEEDS CLARIFICATION]`.
- **No subas secretos** al repositorio.
- **No marques un módulo financiero como terminado** sin bitácora de auditoría y control de accesos operativos.

## Stack y convenciones

- Web/panel: **React**. Móvil: **Flutter**. Backend: **Spring Boot** (Java 21, monolito modular, paquetes por dominio).
- Herramientas locales instaladas en Windows:
  - Java 21: `C:\Users\hdpinho\dev-tools\jdk-21.0.12.1+1` (`JAVA_HOME`)
  - Maven 3.9: `C:\Users\hdpinho\dev-tools\apache-maven-3.9.16\bin\mvn.cmd`
  *(Si `mvn` o `java` no están en el PATH de tu sesión actual, usa la ruta absoluta o setea `$env:JAVA_HOME`)*.
- BD: **Supabase Cloud (PostgreSQL administrado)**, proyecto `nwbnisehliwvuljpfutg`. Supabase tiene **39 tablas** y está en **V0012** (verificado el 21/09/2026). El esquema lo gestiona **solo Flyway** (baseline v8 el 14/09/2026; ver `specs/000-overview/database-schema-design.md` §5). En el repo hay **V0013–V0016 sin aplicar en Supabase**; con ellas serían 42 tablas (`sesion`, `codigo_recuperacion`, `parametros_financiamiento`). El PR #1 (spec 011) reserva V0016–V0018 y choca con la V0016 de `main`. **No se mezcla hasta el final del proyecto** (decisión del usuario, 21/09/2026): se trabaja en `main` y la numeración se resuelve al mezclar. Render ejecuta Flyway al arrancar (`FLYWAY_ENABLED=true`): el primer deploy que arranque bien las aplicará. Cambiar el esquema = migración nueva, nunca SQL a mano. No uses PGlite ni intentes recrear el esquema base; consulta las tablas existentes.
- Variables de entorno locales: se encuentran en `backend/.env` (ignorado por git) para conexión a Supabase en desarrollo local.
- API versionada `/v1/...`. Operaciones de dinero idempotentes y conciliables.
- Pruebas obligatorias para: cálculo de cuotas/amortización, asientos del ledger, decisiones de scoring/AML.
- Commits en español: `tipo(modulo): descripción`.
- Documentación y comentarios de negocio en español; identificadores de código en inglés.

## Comandos sugeridos (`.claude/commands/`)

- `/wamma-spec <modulo>` — abrir y resumir el spec del módulo y sus dependencias.
- `/wamma-check` — verificar el plan/código actual contra la Constitución y reportar violaciones.
- `/wamma-clarify <modulo>` — listar los `[NEEDS CLARIFICATION]` pendientes del módulo.

## Cómo trabajamos

- Iterativo: muéstrame el plan o el análisis **antes** de generar mucho código; prefiero revisar y aprobar.
- Conciso y priorizado: destila la lista de pendientes a lo mínimo necesario antes de avanzar.
- Justifica brevemente los cambios que propongas.
- Decisiones del PO: regístralas en `specs/000-overview/decisiones-po.md` antes de implementarlas.
- Manual de usuario: al cerrar cada etapa, actualiza `docs/manual-usuario/` con lo que hace cada módulo, quién lo usa, el paso a paso, las reglas y los mensajes (decisión D-20).

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
