# 000 · Visión de producto — Plataforma WAMMA

**Proyecto:** WAMMA by Token Pago POS · Plataforma propia
**Clasificación:** Confidencial · **Rev.:** 1 · **Fecha:** Junio 2026

> Documento de orientación. Datos maestros en `Base_Conocimiento_Wamma.md`. Principios vinculantes en `.specify/memory/constitution.md`.

## 1. Tesis

WAMMA es **"el Kavak de Venezuela"**: replica el modelo probado de Kavak (comprar autos, certificarlos, venderlos y financiarlos bajo un mismo techo), adaptado a las particularidades venezolanas (cambiarias, regulatorias, logísticas y de confianza), con un diferenciador propio: la **suscripción / rent-to-own (modelo OCN)**. Todo sobre una plataforma que es **propiedad de WAMMA**.

El primer objetivo no es el sistema perfecto, sino el **sistema mínimo que permite operar y cobrar** para ser pioneros, y luego crecer sobre bases sólidas.

## 2. El modelo Kavak traducido a software

| Pilar del modelo Kavak | Cómo lo resuelve la plataforma | Fase |
|---|---|---|
| Compra de autos al cliente | Cotización instantánea (motor K-Price) + captación "vende tu auto" | 1 (MVP) |
| Certificación / confianza | App de inspección de **240 puntos** + validación legal por OCR | 1 (MVP) |
| Venta con garantía | Catálogo web/móvil + gestión de garantía y devoluciones | 1 (MVP) |
| Financiamiento propio (Kavak Capital) | Motor de riesgo + scoring + pasarela de pagos + libro contable | 1 (MVP) |
| Precio algorítmico | K-Price: tabla de referencia (MVP) → modelo predictivo | 1 → 2 |
| Recuperación de cartera | Integración GPS con corte de ignición remoto por mora | 1 (MVP) |
| Suscripción / rent-to-own (OCN, no está en Kavak) | Módulo de suscripción: cuota mensual con opción de compra | 2 |
| Escala con IA | Visión por computadora para inspección + agentes de IA | 3 |

## 3. Mapa de los 16 módulos por fase

### Fase 1 · MVP (alcance de este repositorio, a detalle)
Meta: ejecutar el ciclo completo en su versión esencial — recibir un auto, certificarlo, publicarlo, financiarlo, cobrar la cuota y proteger esa cobranza. Es un **MVP que factura**.

| # | Módulo | Spec | Pilar Kavak |
|---|---|---|---|
| 001 | Núcleo de cumplimiento y seguridad | `specs/001-nucleo-cumplimiento-seguridad/` | Habilitador regulatorio |
| 002 | Onboarding y verificación de identidad (KYC) | `specs/002-onboarding-kyc/` | Industrialización de la confianza |
| 003 | Captación y cotización instantánea (K-Price MVP) | `specs/003-captacion-kprice/` | Compra · Precio algorítmico |
| 004 | Inspección de 240 puntos y validación legal | `specs/004-inspeccion-240-puntos/` | Certificación / confianza |
| 005 | Catálogo y venta (web y móvil) | `specs/005-catalogo-venta/` | Venta con garantía |
| 006 | Motor de riesgo, scoring y AML | `specs/006-motor-riesgo-scoring-aml/` | Financiamiento propio |
| 007 | Ecosistema fintech: pagos, deuda y ledger | `specs/007-fintech-pagos-ledger/` | Financiamiento propio |
| 008 | Integración GPS con corte de ignición | `specs/008-gps-corte-ignicion/` | Recuperación de cartera |
| 009 | Tablero administrativo y tesorería | `specs/009-tablero-tesoreria/` | Operación full-stack |

### Fase 2 · Diferenciación (roadmap, sin spec detallada todavía)
10. Suscripción / rent-to-own (OCN) — diferenciador clave de WAMMA · 11. K-Price avanzado (precio inteligente con datos reales) · 12. Marketplace (favoritos, alertas, pagos adelantados) · 13. Post-venta e inteligencia de negocio (BI).

### Fase 3 · Escala con IA (roadmap)
14. Visión por computadora para inspección · 15. Agentes de IA (atención y cobranza) · 16. Plataforma B2B y preparación de expansión (multi-sede, multi-moneda; Colombia, Panamá).

> Las Fases 2 y 3 se especifican a fondo **cuando toque construirlas**, no antes (buena práctica SDD: no especificar lo que aún no se va a implementar).

## 4. Arquitectura en capas (resumen; detalle en `architecture-plan.md`)

- **Presentación:** web (React) y app móvil (Flutter).
- **Negocio:** reglas de cotización, crédito, cuotas (backend Go, monolito modular).
- **Datos:** PostgreSQL (incluido el ledger), Redis (caché/colas), object storage nacional (fotos/documentos).
- **Integración:** bancos (C2P/Pago Móvil), buró (Access Datametrics), GPS, validación de identidad/OCR.
- **Seguridad y cumplimiento:** transversal a todas las capas.

## 5. Riesgos del entorno y mitigaciones (heredados a las specs)

| Riesgo | Mitigación |
|---|---|
| Cobranza en mercado informal | GPS con corte de ignición desde el primer auto financiado (módulo 008) |
| Documentación vehicular falsificada | Validación legal por OCR cruzada contra robo y deudas (módulo 004) |
| Inestabilidad de servicios/conectividad | Infra nacional + DR + réplica de BD + doble proveedor de internet |
| Dependencia de nubes extranjeras (sanciones) | Alojamiento soberano nacional para el core |
| Talento escaso en Go | Equipo senior reducido para el núcleo crítico; agentes de IA para trabajo rutinario |
| Realidad cambiaria | Precios USD con equivalencia BCV; el ledger registra ambas referencias |

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
