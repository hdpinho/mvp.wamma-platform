# 008 · Integración GPS con corte de ignición

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**
**Pilar Kavak:** Recuperación de cartera
**Depende de:** 001 (auditoría/roles); 007 (créditos y cuotas vivas)
**Estado:** Draft para `/clarify`

> Spec del QUÉ y el POR QUÉ. CÓMO en `../000-overview/`. Principios en `../../.specify/memory/constitution.md`.

## 1. Objetivo
Conectar la plataforma con el dispositivo GPS instalado en cada auto financiado. Permite ubicar el vehículo en tiempo real y, ante mora, enviar la **orden de apagado remoto del motor** según las reglas y avisos pactados en el contrato.

## 2. Por qué importa
Es la **principal herramienta de cobranza** y recuperación del activo en un mercado de alta informalidad. Protege la cartera desde el primer auto financiado.

## 3. Alcance
**Incluye (MVP):** registro del dispositivo GPS por vehículo/crédito; **telemetría** de ubicación; **orden de corte de ignición** por mora según reglas y avisos; registro del **consentimiento** contractual.
**No incluye:** analítica predictiva de cobranza ni agentes de IA de cobranza (Fase 3, módulo 15).

## 4. Actores y roles
Gestor de cobranza; Líder de Crédito; cliente deudor (recibe avisos); Defensor del Cliente (vela por el debido proceso).

## 5. Historias de usuario
- Como **gestor de cobranza**, quiero ver la ubicación del vehículo financiado, para gestionar la recuperación.
- Como **gestor de cobranza**, quiero que el corte de ignición se ejecute **solo** tras los avisos pactados y la mora confirmada, para respetar el contrato.
- Como **cliente**, quiero recibir los avisos previos al corte, para tener oportunidad de regularizar.

## 6. Requisitos funcionales (RF)
- **RF-008.1** Registro de **dispositivo GPS** asociado a vehículo y crédito.
- **RF-008.2** Recepción y almacenamiento de **telemetría** (posición) del vehículo.
- **RF-008.3** **Orden de corte de ignición** ejecutable de forma remota.
- **RF-008.4** El corte se dispara **solo** ante mora confirmada (módulo 007) y tras los **avisos** y **plazos de gracia** pactados.
- **RF-008.5** Registro del **consentimiento** contractual del corte (base legal).
- **RF-008.6** Toda orden de corte y todo aviso quedan **auditados**.

## 7. Requisitos no funcionales y cumplimiento
El corte debe respetar el **debido proceso** definido en el contrato (avisos + gracia). El texto del consentimiento y la cláusula de corte requieren validación legal `[NEEDS CLARIFICATION: L2]`.

## 8. Reglas de negocio
Sin **consentimiento registrado** no puede ejecutarse el corte. Las reglas (horas de gracia, número de avisos) deben coincidir exactamente con el contrato de crédito y el módulo 007.

## 9. Entidades de datos
`dispositivo_gps`, `posicion_gps`, `consentimiento_gps`, `orden_corte` (ver `data-model.md`).

## 10. Integraciones
Dispositivos/telemetría GPS. `[NEEDS CLARIFICATION: D2 — fabricante, protocolo de telemetría y de corte]`.

## 11. Criterios de aceptación (Given/When/Then)
- **CA-008.1** Dado un crédito en mora, cuando aún no se han emitido los avisos pactados, entonces el corte **no** se ejecuta.
- **CA-008.2** Dado un crédito sin consentimiento de corte registrado, cuando se intenta cortar, entonces el sistema lo impide.
- **CA-008.3** Dada una mora confirmada con avisos cumplidos y plazo de gracia vencido, cuando se ordena el corte, entonces se ejecuta y queda auditado.
- **CA-008.4** Dado un pago que regulariza la mora, cuando se concilia (módulo 007), entonces se habilita el restablecimiento de ignición.

## 12. Métricas de éxito
Recuperación vía GPS > 95% (dato maestro); 0 cortes sin consentimiento ni avisos; tiempo de restablecimiento tras pago bajo.

## 13. Preguntas abiertas
- `[NEEDS CLARIFICATION: P1 — horas de gracia antes del corte]`
- `[NEEDS CLARIFICATION: P2 — avisos previos (cantidad, canal, plazos)]`
- `[NEEDS CLARIFICATION: D2 — proveedor/dispositivo GPS]`
- `[NEEDS CLARIFICATION: L2 — texto del consentimiento y cláusula de corte (legal)]`

## 14. Trazabilidad
Constitución: Principios I, IV, VI. Overview: módulo 008. Dependencias: 001, 007; research D2, P1, P2, L2.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
