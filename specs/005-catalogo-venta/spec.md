# 005 · Catálogo y venta (web y móvil)

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**
**Pilar Kavak:** Venta con garantía
**Depende de:** 001 (roles/auditoría); 004 (solo autos certificados); 002 (comprador verificado)
**Estado:** Draft para `/clarify`

> Spec del QUÉ y el POR QUÉ. CÓMO en `../000-overview/`. Principios en `../../.specify/memory/constitution.md`.

## 1. Objetivo
La vitrina pública: listado de autos certificados con filtros, fichas detalladas, simulador de cuotas y gestión de garantía y devoluciones.

## 2. Por qué importa
Es **donde el cliente compra**. Replica la experiencia de comprar un auto "como quien compra en línea", con certidumbre total.

## 3. Alcance
**Incluye (MVP):** catálogo web/móvil con filtros (marca, modelo, año, precio); ficha detallada con evidencia de inspección; **simulador de cuotas**; flujo de compra; gestión de **garantía** y **devoluciones**.
**No incluye:** favoritos, alertas de baja de precio ni simulación de pagos adelantados (Fase 2, módulo 12).

## 4. Actores y roles
Comprador; asesor comercial; administrador de catálogo; Defensor del Cliente (visibilidad de garantías/devoluciones).

## 5. Historias de usuario
- Como **comprador**, quiero filtrar autos certificados y ver su ficha con la evidencia de la inspección, para comprar con confianza.
- Como **comprador**, quiero simular la cuota de financiamiento, para entender el costo antes de decidir.
- Como **administrador**, quiero que solo aparezcan autos **certificados** (módulo 004), para no exponer inventario no apto.

## 6. Requisitos funcionales (RF)
- **RF-005.1** Catálogo con filtros por marca, modelo, año y precio.
- **RF-005.2** Solo se publican vehículos con **certificación aprobada** (módulo 004).
- **RF-005.3** Ficha detallada con fotos, resultado de inspección y precio en **USD + equivalencia BCV**.
- **RF-005.4** **Simulador de cuotas** (sin requerir aprobación de crédito todavía).
- **RF-005.5** Flujo de compra que, para financiamiento, deriva al motor de riesgo (módulo 006).
- **RF-005.6** Gestión de **garantía** y política de **devoluciones**.

## 7. Requisitos no funcionales y cumplimiento
Precios multi-moneda (Principio V). La política de garantía/devolución debe ser visible y trazable. Solo compradores verificados (módulo 002) cierran compra.

## 8. Reglas de negocio
El precio de venta proviene del proceso de certificación/precio (módulos 003/004). La compra financiada exige aprobación del módulo 006.

## 9. Entidades de datos
`publicacion`, `garantia`, `devolucion`, `vehiculo` (estado: exhibición/reservado/vendido) (ver `data-model.md`).

## 10. Integraciones
Object storage nacional (evidencia). El simulador usa parámetros de financiamiento (4% mensual / 48% anual; ver `Base_Conocimiento_Wamma.md`).

## 11. Criterios de aceptación (Given/When/Then)
- **CA-005.1** Dado un auto no certificado, cuando se intenta publicar, entonces el sistema lo impide.
- **CA-005.2** Dado un comprador, cuando usa el simulador, entonces obtiene cuota estimada en USD + equivalencia BCV.
- **CA-005.3** Dado un comprador no verificado, cuando intenta cerrar compra, entonces el sistema exige verificación (módulo 002).
- **CA-005.4** Dada una venta, cuando se concreta, entonces la garantía queda registrada y el estado del vehículo cambia a vendido (auditado).

## 12. Métricas de éxito
Conversión visita → compra; uso del simulador; reclamos de garantía dentro de lo esperado.

## 13. Preguntas abiertas
- `[NEEDS CLARIFICATION: P4 — quién asume costos de traspaso (debe coincidir con el contrato)]`
- `[NEEDS CLARIFICATION: condiciones exactas de garantía y ventana de devolución]`

## 14. Trazabilidad
Constitución: Principios IV, V. Overview: módulo 005. Dependencias: 001, 002, 004; deriva a 006; research P4.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
