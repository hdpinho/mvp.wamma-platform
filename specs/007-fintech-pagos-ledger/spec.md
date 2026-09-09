# 007 · Ecosistema fintech: pagos, deuda y libro contable (ledger)

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**
**Pilar Kavak:** Financiamiento propio (Kavak Capital)
**Depende de:** 001 (auditoría/roles); 006 (crédito aprobado)
**Estado:** Draft para `/clarify`

> Spec del QUÉ y el POR QUÉ. CÓMO en `../000-overview/`. Principios en `../../.specify/memory/constitution.md`. **Módulo más crítico del MVP.**

## 1. Objetivo
Tres piezas unidas: (a) la **pasarela de pagos C2P y Pago Móvil** para cobrar las cuotas; (b) el **panel de deuda** donde el cliente ve su deuda, próxima cuota y tabla de amortización; y (c) el **libro contable auditable (ledger)**, donde cada bolívar cobrado, interés y reversión queda registrado con **partida doble e inmutable**.

## 2. Por qué importa
El **ledger es la pieza más crítica** de toda fintech: hace que las cifras cuadren con los bancos y resistan una auditoría de Sudeban. El panel da transparencia al cliente; la pasarela permite cobrar.

## 3. Alcance
**Incluye (MVP):** creación del crédito y **tabla de amortización**; pasarela de cobro **C2P/Pago Móvil**; **panel de deuda** del cliente; **ledger de partida doble inmutable**; conciliación contra extractos bancarios.
**No incluye:** simulación de pagos adelantados con abono a capital (Fase 2, módulo 12).

## 4. Actores y roles
Cliente deudor; Tesorería; Contabilidad; Auditoría Interna.

## 5. Historias de usuario
- Como **cliente**, quiero ver mi deuda, mi próxima cuota y la tabla de amortización, para saber exactamente qué debo.
- Como **cliente**, quiero pagar mi cuota por C2P/Pago Móvil, para cumplir sin fricción.
- Como **Tesorería**, quiero que cada pago se concilie automáticamente contra el extracto bancario, para reducir errores y acelerar la disponibilidad de fondos.
- Como **Auditor**, quiero un ledger inmutable de partida doble, para auditar sin riesgo de manipulación.

## 6. Requisitos funcionales (RF)
- **RF-007.1** Al aprobarse un crédito (módulo 006), el sistema genera el **crédito** y su **tabla de amortización** (cuotas fijas; 4% mensual / 48% anual).
- **RF-007.2** Pasarela de cobro **C2P** y **Pago Móvil**; cada pago es **idempotente**.
- **RF-007.3** **Panel de deuda**: deuda total, próxima cuota, estado de cada cuota, tabla de amortización.
- **RF-007.4** **Ledger de partida doble**: por cada movimiento, Σ debe = Σ haber; registros **inmutables** (append-only).
- **RF-007.5** Toda fila monetaria registra **moneda (USD/VES)** y **tasa BCV** aplicada; sin `float`.
- **RF-007.6** **Conciliación** automática de pagos contra extractos bancarios.
- **RF-007.7** Las correcciones se hacen por **asiento compensatorio**, nunca editando ni borrando.

## 7. Requisitos no funcionales y cumplimiento
Integridad financiera absoluta (Constitución, Principio V). Cobertura de pruebas **alta** para amortización, asientos y conciliación. Toda transacción auditada (módulo 001).

## 8. Reglas de negocio
El ledger es la fuente de verdad financiera. Un pago no conciliado queda marcado hasta cruzarse. La mora detectada alimenta la cobranza (módulo 008).

## 9. Entidades de datos
`cuenta_contable`, `asiento`, `asiento_linea`, `credito`, `cuota`, `pago`, `conciliacion` (ver `data-model.md`).

## 10. Integraciones
Bancos vía **C2P/Pago Móvil**. `[NEEDS CLARIFICATION: D3 — convenios bancarios y certificación]`.

## 11. Criterios de aceptación (Given/When/Then)
- **CA-007.1** Dado un crédito aprobado, cuando se crea, entonces se genera su tabla de amortización con cuotas fijas.
- **CA-007.2** Dado un asiento contable, cuando se registra, entonces Σ debe = Σ haber, y no puede editarse ni borrarse.
- **CA-007.3** Dado un pago repetido con la misma clave de idempotencia, cuando se procesa, entonces no se duplica.
- **CA-007.4** Dado un pago, cuando se registra, entonces guarda moneda y tasa BCV aplicada.
- **CA-007.5** Dada una corrección, cuando se aplica, entonces se hace por asiento compensatorio que referencia al original.
- **CA-007.6** Dado un extracto bancario, cuando se concilia, entonces cada pago queda cruzado o marcado como pendiente.

## 12. Métricas de éxito
Cuadre contable 100%; pagos conciliados sin intervención manual (alto %); 0 duplicaciones de pago.

## 13. Preguntas abiertas
- `[NEEDS CLARIFICATION: D3 — bancos, canales y certificación C2P/Pago Móvil]`
- `[NEEDS CLARIFICATION: P3 — penalidad por terminación anticipada]`
- `[NEEDS CLARIFICATION: P6 — plazos de financiamiento ofrecidos]`

## 14. Trazabilidad
Constitución: Principios I, V, VI. Overview: módulo 007. Habilita 008. Dependencias: 001, 006; research D3, P3, P6.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
