# 006 · Motor de riesgo, scoring y AML

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**
**Pilar Kavak:** Financiamiento propio (Kavak Capital → Token Pago Capital)
**Depende de:** 001 (auditoría/roles); 002 (KYC)
**Estado:** Draft para `/clarify`

> Spec del QUÉ y el POR QUÉ. CÓMO en `../000-overview/`. Principios en `../../.specify/memory/constitution.md`.

## 1. Objetivo
El sistema que decide a quién financiar: recibe la solicitud, consulta el scoring crediticio de **Access Datametrics (Credicard)**, revisa la capacidad de pago y verifica al solicitante contra listas de sanciones (**OFAC**) y personas políticamente expuestas (**PEP**). Aprueba o rechaza con criterios claros.

## 2. Por qué importa
Es el músculo **más rentable** del negocio (el financiamiento) y a la vez el **más sensible** ante el regulador. Combina ganar dinero con cumplir la ley.

## 3. Alcance
**Incluye (MVP):** solicitud de crédito; consulta de scoring a Access Datametrics; evaluación de capacidad de pago; **screening AML** (OFAC + PEP); decisión auditable (aprobado/rechazado) con criterios.
**No incluye:** modelos de riesgo propios entrenados con datos reales (madura con la operación).

## 4. Actores y roles
Solicitante (comprador verificado); Líder de Crédito y Política de Riesgo; Oficial de Cumplimiento (AML).

## 5. Historias de usuario
- Como **solicitante verificado**, quiero solicitar financiamiento y recibir una decisión con criterios claros.
- Como **Líder de Crédito**, quiero que la decisión combine scoring del buró y capacidad de pago, para mantener la morosidad baja.
- Como **Oficial de Cumplimiento**, quiero que toda solicitud pase screening OFAC/PEP, para cumplir AML/CFT.

## 6. Requisitos funcionales (RF)
- **RF-006.1** Registro de **solicitud de crédito** asociada a un comprador verificado y a un vehículo.
- **RF-006.2** Consulta de **scoring** a Access Datametrics (escala 100–800, 6 variables).
- **RF-006.3** Evaluación de **capacidad de pago**.
- **RF-006.4** **Screening AML**: cruce contra listas **OFAC** y **PEP**.
- **RF-006.5** **Decisión** (aprobado/rechazado) con criterios explícitos y aprobador registrado.
- **RF-006.6** La decisión y todas sus entradas quedan **auditadas**.

## 7. Requisitos no funcionales y cumplimiento
AML/CFT (SENACOFI/UNIF). Si la integración de listas no está disponible, se admite **control manual documentado** como transitorio (Constitución, Principio I), nunca su omisión. Datos de scoring tratados con confidencialidad.

## 8. Reglas de negocio
Un solicitante con **coincidencia OFAC/PEP positiva** no se aprueba automáticamente: requiere tratamiento de cumplimiento. La aprobación habilita la creación del crédito en el módulo 007.

## 9. Entidades de datos
`solicitud_credito`, `consulta_scoring`, `screening_aml`, `decision_credito` (ver `data-model.md`).

## 10. Integraciones
**Access Datametrics (Credicard)** — viable y recomendado. Listas **OFAC/PEP**. `[NEEDS CLARIFICATION: D4 — contrato técnico Access Datametrics]`, `[NEEDS CLARIFICATION: D5 — fuente de listas OFAC/PEP]`.

## 11. Criterios de aceptación (Given/When/Then)
- **CA-006.1** Dada una solicitud, cuando se evalúa, entonces se consulta el scoring y se registra el puntaje y las variables.
- **CA-006.2** Dada una coincidencia en OFAC/PEP, cuando se evalúa, entonces la solicitud no se aprueba automáticamente y se marca para cumplimiento.
- **CA-006.3** Dada una decisión de crédito, cuando se emite, entonces incluye criterios, aprobador y queda auditada.
- **CA-006.4** Dado que la integración de listas no esté disponible, cuando se procesa, entonces se exige el control manual documentado.

## 12. Métricas de éxito
Morosidad objetivo < 6% (dato maestro); 100% de solicitudes con screening AML; tiempo de decisión bajo.

## 13. Preguntas abiertas
- `[NEEDS CLARIFICATION: P5 — criterios exactos de aprobación/rechazo (umbral de puntaje, capacidad de pago)]`
- `[NEEDS CLARIFICATION: D4 / D5 — integraciones de scoring y listas]`

## 14. Trazabilidad
Constitución: Principios I, V, VI. Overview: módulo 006. Habilita 007. Dependencias: 001, 002; research D4, D5, P5.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
