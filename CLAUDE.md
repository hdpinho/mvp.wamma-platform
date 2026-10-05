# CLAUDE.md — Memoria de proyecto para Claude Code (WAMMA)

> Claude Code: lee este archivo y `.specify/memory/constitution.md` al inicio de cada sesión. La Constitución manda sobre todo. El contexto compartido con otros agentes está en `AGENTS.md`; aquí van las particularidades de tu operación.

## Identidad del proyecto

Plataforma propia de **WAMMA by Token Pago POS** — venta, certificación y financiamiento de vehículos usados en Venezuela, modelo Kavak adaptado al mercado local. Negocio en `Base_Conocimiento_Wamma.md` (fuente única de verdad). No dupliques esos datos.

**No opera bajo supervisión de Sudeban en esta etapa** (Constitución v2.0.0). Fuera del MVP: captación de terceros (K-Price), telemetría GPS y suscripción OCN.

## Tu rol

Eres un par de ingeniería senior full-stack experto en SDD. Construyes el MVP (Fase 1) **en orden**, módulo por módulo, sin saltarte el flujo de especificaciones.

**Estado (05/10/2026):**
- **Modo de trabajo (D-85):** ya no hay demostración. Se trabaja sobre la aplicación y la **base PostgreSQL local persistente `wamma`** (localhost:5432, V0022), que se arranca con `scripts/iniciar-local-persistente.ps1` (perfil `local`, sin datos de demostración). Supabase se queda en V0012, sin conexión ni migraciones hasta el despliegue. Los secretos viven solo en `backend/.env` (D-86). La tasa BCV y la publicación de vehículos se hacen solo desde el backoffice (D-87). **Hasta el pase a producción los datos de la base local son ficticios o de prueba y no se limpian ni se reinician (D-89)**; el entorno de producción nacerá con base limpia y claves nuevas.
- **Estado real (verificado en local el 02/10/2026):** el recorrido del MVP funciona de punta a punta contra el servidor: vitrina → cita → asesor → venta → enlace de financiamiento → solicitud de crédito → análisis → dictamen manual → cierre de la venta. Backend 212 pruebas, web 61, API (R1 26, R2 39, R3 14) y navegador 23/23. **Sin commit en `main`**: el resguardo está en la rama local `resguardo/mvp-2026-10-05` (historial sin secretos, D-86). Las ramas `resguardo/mvp-2026-10-03` y `respaldo/pre-reescritura-secretos` conservan secretos: **no se empujan nunca**. Sin despliegue (D-56).
- **Alcance de la entrega (D-65, D-68):** hasta la aprobación del crédito. **Fuera de alcance:** OTP (D-57), scoring, AML y Score Buró (D-63; el código se conserva apagado con `WAMMA_RIESGO_MOTOR=false`), «Tomar» y «repartir» oportunidades (D-73), desembolso, pagos y ledger.
- **Corrección de los registros anteriores («Fases 1–4 al 100 %», D-49 a D-52):** sobreestimaban el estado y los corrigen D-60 a D-63. En concreto: el motor de scoring/AML existe pero está apagado y el analista dictamina a mano con justificación obligatoria; el servidor recalcula cuota, monto y capacidad; los recaudos van a un contenedor privado y se abren con enlace firmado.
- **Remediación R0–R3 hecha y aprobada (D-64, D-67); R4 hecha en lo que no toca frontend ni textos oficiales (D-68, D-74).** Plan Final: servidor, avisos por WhatsApp/correo (se abren solos, D-75), reapertura de recaudos y de expedientes (D-70, D-71) y «tomar/repartir» apagado (D-73) hechos el 3-oct. El kit `scripts/demo-local/` ya no es el entorno de trabajo (D-85). R5 hecha en lo técnico: `e2e/` (103 casos, `node ejecutar.mjs`), CI con pruebas de la web y trabajo `e2e`, y reevaluación QA (51 hallazgos: ninguno crítico abierto; G-05, los textos de la vitrina, se queda como está por decisión del PO, D-81; S-14 y G-12 cerrados el 3-oct con D-82 y D-83). Pendiente: recorrido final del PO (R5.4) y el push, que se deja para el final (D-80). Plan: `docs/qa/plan-final-2026-10-03.md` (no se commitea `docs/qa`: el repositorio es público).
- **Migraciones:** V0001–V0022 en el repo; Supabase sigue en V0012. El PR #1 (spec 011) no se mezcla: se portó a `main` como V0021 y V0022 (D-66).
- **Decisiones vigentes:** `specs/000-overview/decisiones-po.md` (hasta D-89).
- **Regla estricta:** NO hacer `git push` ni desplegar sin aprobación expresa del PO (D-56). El commit local de resguardo está autorizado (D-77).
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
- BD de trabajo: **PostgreSQL local persistente `wamma`** (localhost:5432, perfil `local`; Flyway aplica las migraciones al arrancar). Es la que se usa (D-85).
- BD de despliegue: **Supabase Cloud (PostgreSQL administrado)**, proyecto `nwbnisehliwvuljpfutg`, sin uso hasta que el PO decida desplegar. Supabase tiene **39 tablas** y está en **V0012** (verificado el 21/09/2026). El esquema lo gestiona **solo Flyway** (baseline v8 el 14/09/2026; ver `specs/000-overview/database-schema-design.md` §5). En el repo hay **V0013–V0022 sin aplicar en Supabase**. El PR #1 (spec 011) **no se mezcla**: lo útil se portó a `main` el 02/10/2026 (D-66) y sus migraciones quedaron como **V0021** y **V0022**; el PR se cierra cuando el port llegue al remoto. Render ejecuta Flyway al arrancar (`FLYWAY_ENABLED=true`): el primer deploy que arranque bien las aplicará. Fuera de Render, Flyway viene apagado (`FLYWAY_ENABLED=false`) y el perfil por defecto es `local`, que no apunta a la base compartida (spec 011 §6.1). Cambiar el esquema = migración nueva, nunca SQL a mano. No uses PGlite ni intentes recrear el esquema base; consulta las tablas existentes.
- Variables de entorno locales: en `backend/.env` (ignorado por git), con la contraseña de la base local y las claves de cifrado e índice. Ningún secreto lleva valor por defecto en el código ni en los scripts (D-86).
- **Toda migración que cree una tabla incluye, en la misma migración, su `GRANT` a `wamma_app` y su `ENABLE ROW LEVEL SECURITY`** (D-42). No confíes en `ALTER DEFAULT PRIVILEGES` ni en el disparador `ensure_rls` de Supabase: fuera de Supabase no existe. `backend/tools/db/pruebas-esquema.sql` lo verifica y el CI lo corre.
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
