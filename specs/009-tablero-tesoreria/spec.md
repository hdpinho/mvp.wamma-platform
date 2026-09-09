# 009 · Tablero administrativo y tesorería

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**
**Pilar Kavak:** Operación full-stack (gestión del inventario propio)
**Depende de:** 001; consume 003/004/005 (inventario), 007 (pagos/ledger)
**Estado:** Draft para `/clarify`

> Spec del QUÉ y el POR QUÉ. CÓMO en `../000-overview/`. Principios en `../../.specify/memory/constitution.md`. Se construye en paralelo y cierra al final.

## 1. Objetivo
El centro de mando interno: control de **inventario por sede y estado** (en reparación, en exhibición, listo para entrega), **conciliación** automática de cobros contra extractos bancarios, generación de **reportes regulatorios** y **notificaciones** automáticas (recordatorios de pago, confirmaciones).

## 2. Por qué importa
Es **donde el equipo opera el negocio día a día**. La conciliación automática reduce errores humanos y acelera la disponibilidad de fondos.

## 3. Alcance
**Incluye (MVP):** tablero de inventario por sede y estado; vista de conciliación de pagos; generación de **reportes regulatorios Sudeban**; motor de **notificaciones** (recordatorios y confirmaciones).
**No incluye:** BI estratégico avanzado y post-venta (Fase 2, módulo 13).

## 4. Actores y roles
Operaciones; Tesorería; Oficial de Cumplimiento (reportería); Administración por sede.

## 5. Historias de usuario
- Como **Operaciones**, quiero ver el inventario por sede y estado, para gestionar el flujo de autos.
- Como **Tesorería**, quiero la vista de conciliación, para confirmar que los cobros cuadran con el banco.
- Como **Oficial de Cumplimiento**, quiero generar los reportes que exige Sudeban en su formato, para cumplir en plazo.
- Como **cliente**, quiero recibir recordatorios y confirmaciones de pago, para no caer en mora por olvido.

## 6. Requisitos funcionales (RF)
- **RF-009.1** Tablero de **inventario** por sede y estado, alimentado por los cambios de estado del vehículo (auditados).
- **RF-009.2** Vista de **conciliación** de pagos contra extractos (apoyada en módulo 007).
- **RF-009.3** Generación de **reportes regulatorios** en los formatos que exige Sudeban.
- **RF-009.4** Motor de **notificaciones** (recordatorios de pago, confirmaciones) multicanal.
- **RF-009.5** Toda acción administrativa relevante queda **auditada** (módulo 001).

## 7. Requisitos no funcionales y cumplimiento
Los formatos de reportería son **dato regulatorio** a confirmar `[NEEDS CLARIFICATION: L1]`. Acceso por rol con mínimo privilegio.

## 8. Reglas de negocio
El tablero **no** es fuente de verdad: refleja datos de inventario (003/004/005) y financieros (007). La reportería se genera desde datos conciliados.

## 9. Entidades de datos
`movimiento_inventario`, `reporte_regulatorio`, `notificacion` (ver `data-model.md`).

## 10. Integraciones
Canal de notificaciones (correo/SMS/push). `[NEEDS CLARIFICATION: canal(es) de notificación]`.

## 11. Criterios de aceptación (Given/When/Then)
- **CA-009.1** Dado un cambio de estado de un vehículo, cuando ocurre, entonces el tablero lo refleja y queda auditado.
- **CA-009.2** Dada una fecha de cierre, cuando se genera un reporte regulatorio, entonces se produce en el formato exigido por Sudeban.
- **CA-009.3** Dada una cuota próxima a vencer, cuando corresponde, entonces el sistema envía el recordatorio.
- **CA-009.4** Dado un usuario sin permiso, cuando intenta generar reportería, entonces el sistema lo deniega.

## 12. Métricas de éxito
% de cobros conciliados automáticamente; reportería entregada en plazo; reducción de mora por olvido vía recordatorios.

## 13. Preguntas abiertas
- `[NEEDS CLARIFICATION: L1 — formatos exactos de reportería Sudeban]`
- `[NEEDS CLARIFICATION: canales de notificación y plantillas]`

## 14. Trazabilidad
Constitución: Principios I, V, VI. Overview: módulo 009. Dependencias: 001, 003, 004, 005, 007; research L1.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
