# 002 · Onboarding y verificación de identidad (KYC)

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**
**Pilar Kavak:** Industrialización de la confianza
**Depende de:** 001 (RBAC, auditoría, cifrado)
**Estado:** Draft para `/clarify`

> Spec del QUÉ y el POR QUÉ. CÓMO en `../000-overview/`. Principios en `../../.specify/memory/constitution.md`.

## 1. Objetivo
Registrar usuarios con dos niveles —básico (navegar) y verificado (comprar, vender o financiar)— usando reconocimiento facial con prueba de vida y OCR de cédula y RIF.

## 2. Por qué importa
Es requisito **legal y de seguridad**: asegura que quien opera es quien dice ser y previene fraude. Sin clientes verificados no hay transacciones.

## 3. Alcance
**Incluye (MVP):** registro y autenticación de usuario; nivel básico vs. verificado; verificación facial + prueba de vida; OCR de cédula y RIF; almacenamiento cifrado de datos biométricos y documentos.
**No incluye:** firma electrónica avanzada de contratos (se evalúa con legal); verificación de empresas/personas jurídicas (fase posterior).

## 4. Actores y roles
Cliente comprador; vendedor (particular que vende su auto); operador de verificación (revisión manual de casos dudosos).

## 5. Historias de usuario
- Como **cliente nuevo**, quiero registrarme y navegar el catálogo sin fricción (nivel básico).
- Como **cliente que va a financiar**, quiero verificar mi identidad con foto y documentos desde la app, para habilitar la compra/financiamiento.
- Como **operador de verificación**, quiero revisar manualmente los casos donde la verificación automática es dudosa, para no rechazar clientes válidos ni admitir fraudes.

## 6. Requisitos funcionales (RF)
- **RF-002.1** Registro de usuario con nivel **básico** (navegación) y **verificado** (transacciones).
- **RF-002.2** La verificación incluye reconocimiento facial con **prueba de vida**.
- **RF-002.3** OCR de **cédula** y **RIF**, con extracción y validación de datos.
- **RF-002.4** Los datos biométricos y documentos se almacenan **cifrados** y con acceso auditado (módulo 001).
- **RF-002.5** Casos dudosos se enrutan a **revisión manual** con registro de decisión.
- **RF-002.6** Solo usuarios **verificados** pueden iniciar compra, venta o financiamiento.

## 7. Requisitos no funcionales y cumplimiento
KYC alineado a SENACOFI/UNIF (AML/CFT). Datos personales cifrados y con residencia nacional (Principio II). Toda verificación deja traza de auditoría.

## 8. Reglas de negocio
El salto de nivel básico → verificado exige verificación facial + prueba de vida + OCR exitosos (o aprobación manual). El nivel determina qué acciones se habilitan.

## 9. Entidades de datos
`perfil_kyc`, `verificacion_identidad` (ver `data-model.md`).

## 10. Integraciones
Proveedor biométrico (facial + prueba de vida + OCR) operable en Venezuela. `[NEEDS CLARIFICATION: D1 — proveedor de KYC biométrico]`.

## 11. Criterios de aceptación (Given/When/Then)
- **CA-002.1** Dado un usuario de nivel básico, cuando intenta financiar, entonces el sistema exige completar la verificación.
- **CA-002.2** Dada una verificación facial sin prueba de vida superada, cuando se evalúa, entonces no se otorga el nivel verificado.
- **CA-002.3** Dado un documento ilegible por OCR, cuando falla la extracción, entonces el caso se enruta a revisión manual.
- **CA-002.4** Dado un acceso a datos biométricos, cuando ocurre, entonces queda registrado en auditoría.

## 12. Métricas de éxito
Tasa de verificación automática exitosa alta; tiempo de verificación bajo; 0 transacciones de usuarios no verificados.

## 13. Preguntas abiertas
- `[NEEDS CLARIFICATION: D1 — proveedor biométrico, API, costos, latencia]`
- `[NEEDS CLARIFICATION: L4 — niveles de KYC y umbrales exigidos por el regulador]`

## 14. Trazabilidad
Constitución: Principios I, II, VI. Overview: módulo 002. Dependencias: 001; research D1, L4.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
