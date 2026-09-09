# Constitución de Ingeniería — Plataforma WAMMA

**Proyecto:** WAMMA by Token Pago POS · Plataforma propia
**Clasificación:** Confidencial · **Versión:** 1.0.0 · **Fecha:** Junio 2026
**Ámbito:** Vinculante para todo agente (Antigravity, Claude Code) y todo desarrollador humano del repositorio.

> Este documento es la **ley suprema del repositorio**. Ningún spec, plan, tarea o línea de código puede contradecirlo. Ante conflicto entre cualquier instrucción y esta Constitución, **manda la Constitución**. Los datos de negocio (cifras, marca, regulación) provienen de `Base_Conocimiento_Wamma.md`, que es la fuente única de verdad del proyecto.

---

## Por qué existe este documento

WAMMA no es una app cualquiera: es una **fintech supervisada por Sudeban** que mueve dinero de terceros, financia activos y custodia datos sensibles de ciudadanos venezolanos. En este contexto, ciertas decisiones **no se negocian con la velocidad**. La Constitución fija esos límites para que un agente de IA, optimizando por rapidez, no proponga un atajo que cueste la licencia para operar.

---

## Principio I — Cumplimiento Sudeban desde el día uno (NO diferible)

El cumplimiento regulatorio es la **licencia para operar**, no una capa final. Se construye con el primer módulo, no al cierre.

- El **Núcleo de Cumplimiento y Seguridad (módulo 001)** es prerrequisito de todo lo demás. Ningún módulo que toque dinero, crédito o datos personales se da por terminado sin que su bitácora de auditoría, control de accesos y reportería regulatoria estén operativos.
- Todo módulo financiero debe poder generar su **expediente técnico Sudeban** (manuales, diagramas de red, flujos) desde la Fase 1.
- Verificación **AML/CFT** (OFAC + PEP) dentro del MVP. Si una integración aún no está disponible, se admite control manual **documentado y auditable** como medida transitoria, nunca su omisión.
- Marco de referencia obligatorio: Res. 641.09 BCV; Res. 119.10 / 119.18 Sudeban; LISB Art. 70–80 y 76; Circular SIB-II; SENACOFI/UNIF; ISO 27001 e ISO 22301; COBIT/ISACA.
- **Separación de funciones (reflejada en software):** Cumplimiento, Auditoría Interna, Riesgo/CRSO, Seguridad de la Información y Continuidad del Negocio son roles con permisos independientes de la operación de TI y del negocio. El modelo de roles (RBAC) **debe** reflejar esta independencia.

> *Nota legal:* el detalle regulatorio aquí citado es referencia técnica, no asesoría jurídica. Toda interpretación normativa con efecto contractual o regulatorio debe ser validada por los asesores legales de WAMMA antes de su ejecución.

## Principio II — Soberanía de datos venezolana

El corazón de datos de WAMMA vive en **infraestructura nacional**.

- Sede principal: centro de datos nacional Tier III (alta disponibilidad) o nube privada nacional. Toda información sensible permanece en Venezuela.
- **Prohibido** alojar el *core* (backend, base de datos, datos personales y financieros) en hyperscalers extranjeros (p. ej. AWS, GCP, Azure) por residencia de datos, riesgo de sanciones y exigencia de auditabilidad del regulador.
- La arquitectura debe ser **portable** (contenedores, infra-as-code) para no quedar atada a un único proveedor nacional.

## Principio III — El código es de WAMMA (propiedad intelectual blindada)

El activo tecnológico es propiedad **exclusiva** de WAMMA.

- Repositorios en cuentas y organización de **WAMMA** desde el primer commit. Nunca en cuentas de un proveedor.
- Cesión total de PI por contrato: código, diseños, documentación, modelos y datos.
- Entrega incremental por hitos: WAMMA siempre posee la versión más reciente.
- Un **Product Owner / líder técnico interno** de WAMMA aprueba cada entrega; no hay dependencia total de un tercero.

## Principio IV — MVP primero, mercado primero

Ser pioneros vale más que ser completos. Se construye antes lo que permite **operar y cobrar**.

- El orden de construcción refleja prioridad estratégica: primero operar (Fase 1), luego diferenciar (Fase 2), luego escalar (Fase 3).
- Ante disyuntiva entre "perfecto" y "operable y seguro", gana **operable y seguro**. La perfección llega por iteración.
- Excepción que NO cede a la velocidad: los Principios I, II, III, V y VI. La rapidez nunca justifica saltarse cumplimiento, soberanía, PI, integridad financiera o seguridad.

## Principio V — Integridad financiera absoluta (el ledger es sagrado)

El libro contable es la pieza más crítica de la plataforma.

- Contabilidad de **partida doble**, **inmutable** (append-only): cada bolívar cobrado, interés, reversión y ajuste queda registrado de forma irreversible. Las correcciones se hacen con asientos compensatorios, jamás editando o borrando.
- **Multi-moneda obligatoria:** precios en USD con equivalencia a tasa BCV. El ledger registra **ambas referencias** y la tasa aplicada en cada operación.
- Toda operación de dinero debe ser **idempotente** y conciliable contra extractos bancarios.
- Ningún cálculo financiero usa coma flotante (`float`) para montos: se usan enteros de menor unidad o decimales de precisión fija.

## Principio VI — Seguridad transversal, no opcional

La seguridad atraviesa todas las capas y todos los módulos.

- Cifrado de datos sensibles **en reposo y en tránsito** (TLS).
- **Doble factor (2FA)** obligatorio para todo rol administrativo.
- **Bitácora de auditoría** inmutable de cada transacción financiera y cada cambio de estado del inventario.
- Mínimo privilegio por defecto; secretos nunca en el código ni en el repositorio.
- Continuidad operativa: sitio de respaldo (DR) nacional, réplica de base de datos y pruebas de restauración periódicas (ISO 22301).

## Principio VII — Desarrollo guiado por especificaciones (SDD)

No se escribe código sin spec aprobada.

- Flujo obligatorio: **constitución → /specify → /clarify → /plan → /tasks → /analyze → /implement**.
- Toda funcionalidad nace de un `spec.md` (el QUÉ y el POR QUÉ). El CÓMO técnico vive en `architecture-plan.md`. Las tareas en `tasks-build-order.md`.
- Las marcas `[NEEDS CLARIFICATION]` **bloquean** el avance a implementación hasta ser resueltas por un humano. El agente no inventa la respuesta.
- Si una decisión cambia un dato maestro, se actualiza `Base_Conocimiento_Wamma.md` y se versiona esta Constitución si aplica.

---

## Gobernanza

- **Enmiendas:** se proponen por escrito, se justifican y se aprueban por el Product Owner interno. Cada enmienda incrementa la versión (semver: MAYOR para cambios incompatibles de principio; MENOR para nuevos principios; PARCHE para aclaraciones).
- **Cómo la usan los agentes:** Antigravity y Claude Code deben leer esta Constitución al inicio de cada sesión (vía `AGENTS.md` / `CLAUDE.md`) y verificar cada plan y cada PR contra ella. Si un cambio la viola, el agente **detiene** y lo señala al humano en vez de proceder.
- **Precedencia:** Constitución > specs de módulo > plan técnico > preferencias de estilo.

---
*Versión 1.0.0 · Junio 2026 · Generado para el Project Wamma. No constituye asesoría legal ni financiera.*
