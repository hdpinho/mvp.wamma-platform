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

## Estado actual del desarrollo (Septiembre 2026)

- **Fase 1 — CRM Comercial y Citas (`010-crm-comercial`): COMPLETADA Y VERIFICADA LOCALMENTE (100 %).**
  - **Base de Datos:** Migración `V0017__crm_moneda_y_reserva.sql` (reserva 24h, multimoneda EUR/VES, citas sin sede inicial). 102 pruebas de esquema aprobadas.
  - **Backend Spring Boot:** Paquete `com.wamma.crm` completo (Person, Opportunity, Appointment, Interaction, StageHistory, IdentityResolver con deduplicación y cifrado AES-256-GCM + blind index HMAC-SHA-256, CaptureRateLimiter, DemoCrmSeeder). 120 pruebas unitarias y de integración pasando (`mvn test`).
  - **Frontend Web:** Conectado a API real mediante `src/api/crm.ts` y sincronizado en `src/state/crm.tsx` (con fallback transparente a maqueta/offline si no hay servidor).
  - **Entorno de pruebas:** Servidor embebido `LocalDevServer.java` (Postgres local en memoria/disco) en `http://localhost:8080` y Vite en `http://localhost:5174`.
- **Fase 2 — Motor de Parámetros de Financiamiento: COMPLETADA Y VERIFICADA LOCALMENTE (100 %).**
  - Consumo y actualización dinámica de la tabla `parametros_financiamiento` (`V0015`).
  - Endpoints REST `GET /v1/parametros-financiamiento` y `PUT /v1/parametros-financiamiento` asegurados para backoffice.
  - Conexión e integración en `C10_Financiamiento`, `O6_FinanciamientoBackoffice` y el simulador de cuotas de `C2_FichaVehiculo` con fallback transparente.
  - 123 pruebas unitarias y de integración pasando en backend.
- **Fase 3 — Solicitud de Crédito Digital (Digitalización WMA-F-FIN-001 y Expediente): COMPLETADA Y VERIFICADA LOCALMENTE (100 %).**
  - **Base de Datos:** Migración `V0018__solicitud_credito_eur.sql` (soporte multimoneda EUR/VES bajo Constitución v3.0.0, metadatos y tabla `solicitud_recaudo` para documentos digitales).
  - **Backend Spring Boot:** Paquete `com.wamma.credit.application` completo (expediente de 8 pasos, almacenamiento de recaudos, endpoints públicos `/v1/solicitudes-credito` y backoffice `/v1/solicitudes-credito/{id}/evaluacion`, `/v1/solicitudes-credito/{id}/recaudos/{docId}`, consumo de token de financiamiento de 7 días y transición automática de la oportunidad en CRM a `solicitud_credito`).
  - **Frontend Web:** Formulario público `C9_SolicitudCredito` conectado a API real con subida de recaudos, y pantalla de backoffice `O7_AnalisisCredito` con métricas, tabla de expedientes y modal de revisión (capacidad de pago regla 30%, recaudos y dictamen de riesgo).
- **Fase 4 — Motor de Riesgo, Scoring y Cumplimiento AML (`006-scoring-credito`): COMPLETADA Y VERIFICADA LOCALMENTE (100 %).**
  - **Backend Spring Boot:** Paquete `com.wamma.risk` completo (`CreditScoringEngine`, `AmlScreeningEngine`, `AmlAlertRepository`, `RiskEvaluationService`, `RiskController`).
  - **Algoritmo de Scoring:** 0–1000 puntos ponderado en 5 factores (Capacidad de pago regla 30% [350 pts], Inicial aportada [200 pts], Estabilidad laboral [150 pts], Solvencia bancaria [150 pts], Perfil demográfico [150 pts]) y homologación a Score Buró (100–800 pts).
  - **Screening AML:** Cotejo automático contra listas de sanciones internacionales (OFAC, ONU, Interpol) y base de datos PEP (Personas Políticamente Expuestas), con persistencia de alertas en tabla `alerta_aml` y auditoría inmutable.
  - **Frontend Web:** Conexión e integración en `src/screens/admin/O7_AnalisisCredito.tsx` con ejecución en vivo (`⚡ Ejecutar Scoring y AML en Vivo`), resumen de scores, desglose visual de 5 factores, badges OFAC/PEP y flujo de resolución de alertas AML (`falso_positivo` / `confirmado_bloqueado`).
  - **Verificación:** 133 tests en Maven (`BUILD SUCCESS`), 17 tests frontend (`npm test`), build de producción Vite verificado y validación visual en navegador.
- **Regla estricta:** NO hacer `git commit` ni `git push` hasta que el usuario realice todas las pruebas y dé su aprobación explícita.

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
- Commits: convención `tipo(modulo): descripción` (ej. `feat(007-ledger): asiento de partida doble`).

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
