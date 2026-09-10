# 000 · Visión de producto — Plataforma WAMMA

**Proyecto:** WAMMA by Token Pago POS · Plataforma propia
**Clasificación:** Confidencial · **Rev.:** 4 · **Fecha:** Septiembre 2026

> Documento de orientación. Datos maestros en `Base_Conocimiento_Wamma.md`. Principios vinculantes en `.specify/memory/constitution.md`.

## 1. Tesis

WAMMA es **"el Kavak de Venezuela"**: replica el modelo probado de Kavak (comprar autos, certificarlos, venderlos y financiarlos bajo un mismo techo), adaptado a las particularidades venezolanas (cambiarias, logísticas y de confianza). La **suscripción / rent-to-own (modelo OCN)** sigue siendo el diferenciador de largo plazo, pero queda **fuera del alcance de este MVP** (ver §2). Todo sobre una plataforma que es **propiedad de WAMMA**.

El primer objetivo no es el sistema perfecto, sino el **sistema mínimo que permite operar y cobrar** para ser pioneros, y luego crecer sobre bases sólidas.

## 2. El modelo Kavak traducido a software

| Pilar del modelo | Cómo lo resuelve la plataforma | Fase |
|---|---|---|
| Certificación / confianza | Inspección de **240 puntos** + validación legal | 1 (MVP) |
| Venta de vehículos publicados | Catálogo web + ficha técnica + reservas | 1 (MVP) |
| Financiamiento propio | Formulario WMA-F-FIN-001 + motor de riesgo + amortización + ledger | 1 (MVP) |
| Operación administrativa | Tablero administrativo y tesorería | 1 (MVP) |
| Seguimiento comercial del interés | Embudo de prospectos, historial de contacto y ficha 360 | 1 (MVP) |
| Captación de inventario de terceros | Cotización instantánea (motor K-Price) | Roadmap posterior |
| Telemetría vehicular | Dispositivos GPS y corte remoto | Descartado de este MVP |
| Suscripción / rent-to-own | Módulo de suscripción OCN | Descartado de este MVP |

## 3. Mapa de módulos del MVP (Venta de Vehículos Publicados)

Meta: ejecutar el ciclo de **venta y financiamiento de vehículos publicados** — inventario certificado, publicación en vitrina, solicitud de financiamiento, aprobación contable en ledger y liquidación.

| # | Módulo | Spec | Función |
|---|---|---|---|
| 001 | Núcleo de cumplimiento y seguridad | `specs/001-nucleo-cumplimiento-seguridad/` | Habilitador regulatorio y seguridad |
| 004 | Inspección de 240 puntos y certificación | `specs/004-inspeccion-240-puntos/` | Certificación del inventario publicado |
| 005 | Catálogo y venta de publicados | `specs/005-catalogo-venta/` | Vitrina, búsqueda, ficha y guardados |
| 006 | Motor de riesgo, scoring y AML | `specs/006-motor-riesgo-scoring-aml/` | Evaluación del solicitante de crédito |
| 007 | Ecosistema fintech: pagos, deuda y ledger | `specs/007-fintech-pagos-ledger/` | Ledger inmutable, cuotas y pagos |
| 009 | Tablero administrativo y tesorería | `specs/009-tablero-tesoreria/` | Gestión de inventario y tesorería |
| 010 | Seguimiento comercial de prospectos (CRM ligero) | `specs/010-crm-comercial/` | Embudo, interacciones y ficha 360 del prospecto |
| — | Solicitud de crédito digital | `specs/solicitud-credito/` | Formulario WMA-F-FIN-001 digitalizado |

## 4. Arquitectura en capas (resumen; detalle en `architecture-plan.md`)

- **Presentación:** web (React) y app móvil (Flutter).
- **Negocio:** reglas de venta, crédito y cuotas (backend Go, monolito modular).
- **Datos:** PostgreSQL (incluido el ledger), Redis (caché/colas), object storage (fotos/documentos).
- **Integración:** bancos (C2P/Pago Móvil), buró de crédito.
- **Seguridad y cumplimiento:** transversal a todas las capas.

## 5. Riesgos del entorno y mitigaciones (heredados a las specs)

| Riesgo | Mitigación |
|---|---|
| Documentación vehicular irregular | Validación de inspección y antecedentes legales antes de publicar (módulo 004) |
| Inestabilidad de servicios/conectividad | Respaldo con pruebas de restauración + réplica de BD + arquitectura portable |
| Interrupción del proveedor de alojamiento (sanciones o decisión unilateral) | Riesgo **asumido y evaluado**, ya no prohibido: contenedores e infraestructura como código para poder migrar sin reescribir (Constitución v2.0.0, Principio II) |
| Talento escaso en Go | Equipo senior reducido para el núcleo crítico; agentes de IA para trabajo rutinario |
| Realidad cambiaria | Precios USD con equivalencia BCV; el ledger registra ambas referencias |

---
*WAMMA · Confidencial · Rev. 4 · No constituye asesoría legal ni financiera.*
