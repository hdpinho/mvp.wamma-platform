# 000 · Dependencias críticas a confirmar (research)

**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**

> Las decisiones aquí listadas **bloquean** la implementación de su módulo hasta resolverse (Constitución, Principio VII). Ninguna debe ser inventada por un agente. Las de carácter legal/regulatorio o de política comercial las decide el negocio; las de proveedor las confirma el Product Owner interno.

## 1. Proveedores e integraciones técnicas

| # | Dependencia | Bloquea | Pregunta a resolver |
|---|---|---|---|
| D1 | Proveedor de KYC biométrico operable en Venezuela | 002 | ¿Qué proveedor de reconocimiento facial + prueba de vida + OCR (cédula/RIF) usaremos? ¿API, costos, latencia? |
| D2 | Dispositivos GPS con corte de ignición | 008 | ¿Qué fabricante/modelo? ¿Protocolo de telemetría y de corte remoto? ¿SLA? |
| D3 | Convenios bancarios C2P / Pago Móvil | 007 | ¿Con qué banco(s) y en qué estatus están los convenios? ¿Certificación requerida? |
| D4 | API de Access Datametrics (Credicard) | 006 | Contrato técnico exacto, formato de respuesta del puntaje (100–800) y de las 6 variables, ambiente de pruebas |
| D5 | Fuente de listas OFAC / PEP | 006 | ¿Proveedor o descarga oficial? Frecuencia de actualización. Mientras tanto: control manual documentado |
| D6 | Bases oficiales de robo / deudas vehiculares | 004 | ¿Qué fuente(s) para el cruce legal del vehículo? ¿Acceso vía API o consulta manual? |
| D7 | Proveedor de centro de datos nacional Tier III + sitio DR | infra | ¿Cuál? ¿Capacidad, certificación Tier III, ubicación del DR? |
| D8 | Object storage nacional | infra | ¿Proveedor para fotos/videos de inspección y documentos? |

## 2. Decisiones de política comercial (negocio)

> Varias coinciden con campos abiertos `[●]` del portafolio legal. Deben quedar idénticas en contrato y en software.

| # | Decisión | Bloquea | Nota |
|---|---|---|---|
| P1 | Horas de gracia antes del corte GPS por mora | 008 | Debe coincidir con el contrato de crédito y el consentimiento GPS |
| P2 | Avisos previos al corte (cantidad, canal, plazos) | 008 | Requisito de debido proceso de cobranza |
| P3 | Penalidad por terminación anticipada | 007 | Campo abierto en contratos |
| P4 | Quién asume costos de traspaso | 005 | Campo abierto en contratos |
| P5 | Criterios exactos de aprobación/rechazo de crédito | 006 | Umbral de puntaje, capacidad de pago, política de riesgo |
| P6 | Plazo(s) de financiamiento ofrecidos | 006/007 | Confirmar plazos estándar (cuotas fijas, 48% anual) |

## 3. Decisiones legales / regulatorias (asesores)

| # | Tema | Nota |
|---|---|---|
| L1 | Formatos exactos de reportería que exige Sudeban | Define el output del módulo 009 |
| L2 | Texto del consentimiento GPS y de la cláusula de corte | Base contractual del módulo 008 |
| L3 | Requisitos de retención y residencia de datos personales | Refuerza Principio II |
| L4 | Niveles de KYC y umbrales que exige el regulador | Define los dos niveles del módulo 002 |

> *Nota:* los puntos de la sección 3 requieren validación de los asesores legales de WAMMA. Este documento no constituye asesoría jurídica ni financiera.

## 4. Designación previa al desarrollo

- **Product Owner / líder técnico interno de WAMMA** designado antes de iniciar `/implement` (Constitución, Principio III). Es quien aprueba entregas y resuelve los `[NEEDS CLARIFICATION]` de proveedor.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
