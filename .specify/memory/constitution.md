# Constitución de Ingeniería — Plataforma WAMMA

**Proyecto:** WAMMA by Token Pago POS · Plataforma propia
**Clasificación:** Confidencial · **Versión:** 3.0.0 · **Fecha:** Septiembre 2026
**Ámbito:** Vinculante para todo agente (Antigravity, Claude Code) y todo desarrollador humano del repositorio.

> Este documento es la **ley suprema del repositorio**. Ningún spec, plan, tarea o línea de código puede contradecirlo. Ante conflicto entre cualquier instrucción y esta Constitución, **manda la Constitución**. Los datos de negocio (cifras, marca, regulación) provienen de `Base_Conocimiento_Wamma.md`, que es la fuente única de verdad del proyecto.

---

## Por qué existe este documento

WAMMA mueve dinero de terceros, financia activos y custodia datos sensibles de ciudadanos venezolanos. **No opera bajo supervisión de Sudeban en esta etapa** (ver Registro de enmiendas), pero eso no cambia la naturaleza de lo que maneja: un descuadre en el ledger es dinero real, y una fuga de datos es el expediente financiero de una persona real.

En este contexto, ciertas decisiones **no se negocian con la velocidad**. La Constitución fija esos límites para que un agente de IA, optimizando por rapidez, no proponga un atajo que cueste el dinero o la confianza de un cliente.

---

## Principio I — Protección del dato personal y trazabilidad (NO diferible)

*Reformulado en v2.0.0. El encuadre de cumplimiento Sudeban queda derogado; la protección del dato, no.*

Dejar de estar supervisado quita al regulador, **no la responsabilidad sobre el dato de un tercero**. La plataforma custodia cédulas, ingresos declarados, cuentas bancarias y teléfonos de personas que confiaron en ella. Eso se protege por ingeniería, no porque alguien vaya a fiscalizarlo.

- El **Núcleo de Seguridad y Control de Accesos (módulo 001)** sigue siendo prerrequisito de todo módulo que toque dinero, crédito o datos personales. Ninguno se da por terminado sin bitácora de auditoría y control de accesos operativos.
- **Separación de funciones reflejada en el RBAC:** Auditoría, Riesgo, Seguridad de la Información y la operación del negocio son roles con permisos independientes. Es buena ingeniería con o sin regulador: impide que quien ejecuta una operación sea también quien la aprueba y quien puede borrar su rastro.
- **Mínimo privilegio por defecto** en todo acceso a datos personales. Quien no necesita un dato para hacer su trabajo, no lo ve.
- Todo dato personal tiene **período de conservación declarado**. Guardar indefinidamente lo que ya no se usa es pasivo, no activo.
- **ISO 27001 e ISO 22301** se conservan como marcos de referencia técnica voluntarios, no como exigencia de cumplimiento.

> **Si el proyecto vuelve al perímetro supervisado** —licencia propia, alianza bancaria o cambio regulatorio—, este principio recupera su forma anterior: expediente técnico Sudeban, verificación AML/CFT (OFAC + PEP) y el marco Res. 641.09 BCV / Res. 119.10 y 119.18 Sudeban / LISB Art. 70–80 y 76 / Circular SIB-II / SENACOFI-UNIF. El texto derogado **no se ha perdido**: vive en la v1.0.0, recuperable del historial de Git.

> *Nota legal:* todo detalle regulatorio citado es referencia técnica, no asesoría jurídica. Cualquier interpretación normativa con efecto contractual debe ser validada por los asesores legales de WAMMA.

## Principio II — Portabilidad de la infraestructura

*Reformulado en v2.0.0. La exigencia de residencia de datos en Venezuela queda **derogada** por decisión del Product Owner. Se conserva lo que el principio tenía de valioso con independencia del regulador.*

- La arquitectura debe ser **portable**: contenedores, infraestructura como código, sin servicios propietarios en el camino crítico. Ningún proveedor debe ser difícil de abandonar.
- La elección de proveedor de alojamiento es **decisión de ingeniería y de negocio**, no de cumplimiento. Se admiten proveedores extranjeros.
- **Sigue exigido** un plan de continuidad: respaldos con **pruebas de restauración periódicas** y capacidad de reconstruir el entorno desde cero.
- Al elegir proveedor se evalúa explícitamente el **riesgo de interrupción** por sanciones o por decisión unilateral del proveedor. No prohíbe ninguna opción; obliga a saber qué se está asumiendo y a tener plan B.

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
- Excepción que NO cede a la velocidad: los Principios I, III, V y VI. La rapidez nunca justifica saltarse la protección del dato personal, la propiedad intelectual, la integridad financiera ni la seguridad.

## Principio V — Integridad financiera absoluta (el ledger es sagrado)

El libro contable es la pieza más crítica de la plataforma.

- Contabilidad de **partida doble**, **inmutable** (append-only): cada bolívar cobrado, interés, reversión y ajuste queda registrado de forma irreversible. Las correcciones se hacen con asientos compensatorios, jamás editando o borrando.
- **Multi-moneda obligatoria:** precios en **euros (EUR)** con equivalencia en bolívares a la tasa BCV del euro. El ledger registra **ambas referencias** y la tasa aplicada en cada operación. *(Moneda de referencia enmendada en v3.0.0; antes, USD.)*
- Toda operación de dinero debe ser **idempotente** y conciliable contra extractos bancarios.
- Ningún cálculo financiero usa coma flotante (`float`) para montos: se usan enteros de menor unidad o decimales de precisión fija.

## Principio VI — Seguridad transversal, no opcional

La seguridad atraviesa todas las capas y todos los módulos.

- Cifrado de datos sensibles **en reposo y en tránsito** (TLS).
- **Doble factor (2FA)** obligatorio para todo rol administrativo.
- **Bitácora de auditoría** inmutable de cada transacción financiera y cada cambio de estado del inventario.
- Mínimo privilegio por defecto; secretos nunca en el código ni en el repositorio.
- Continuidad operativa: sitio de respaldo (DR), réplica de base de datos y pruebas de restauración periódicas.

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

## Registro de enmiendas

| Versión | Fecha | Cambio | Motivo |
|---|---|---|---|
| **1.0.0** | Junio 2026 | Versión inicial | Encuadre de fintech supervisada por Sudeban |
| **2.0.0** | Septiembre 2026 | **Principio I** reformulado: de cumplimiento Sudeban a protección del dato personal y trazabilidad. **Principio II** derogado en su exigencia de residencia de datos y reformulado como portabilidad de infraestructura. Ajustes derivados en los Principios IV y VI | Decisión del Product Owner: la plataforma no operará como fintech supervisada en esta etapa y no existe restricción de residencia de datos. **MAYOR**, por ser cambio incompatible de principio |
| **3.0.0** | 15 de septiembre de 2026 | **Principio V**: la moneda de referencia pasa de USD a **EUR**, con equivalencia en bolívares a la tasa BCV del euro | Decisión del Product Owner: el euro aplica a toda la plataforma (D-21 de `specs/000-overview/decisiones-po.md`). **MAYOR**: todo lo especificado o construido en USD debe migrarse |

**Lo derogado no se ha borrado.** El texto íntegro de la v1.0.0 —marco regulatorio, expediente técnico Sudeban, AML/CFT, soberanía de datos— permanece en el historial de Git y se recupera si el proyecto vuelve al perímetro supervisado. Esta Constitución se enmienda; no se reescribe su historia.

**Deuda declarada de la v3.0.0.** Siguen en USD: los specs 005, 007 y `solicitud-credito`, el plan del 010 (supuesto S4), `ui-design.md`, `data-model.md`, `database-schema-design.md`, la restricción de moneda de la base (`USD`/`VES`) y los precios de la maqueta. Se migran en la etapa que toca cada módulo: la 2 (catálogo y tasa BCV), la 3 (CRM) y la 4 (financiamiento). Mientras tanto, ante conflicto manda esta Constitución.

**Deuda declarada de la v2.0.0.** Los specs **006, 007 y 009** contienen requisitos redactados bajo la v1.0.0 (reportería Sudeban, verificación AML/CFT, alojamiento nacional) y **no han sido revisados**. El **001** se revisó en su Rev. 2 (15 de septiembre de 2026). Exigen criterio módulo por módulo, no un reemplazo mecánico. Mientras no se revisen, ante conflicto manda esta Constitución (ver Precedencia).

---
*Versión 3.0.0 · Septiembre 2026 · Generado para el Project Wamma. No constituye asesoría legal ni financiera.*
