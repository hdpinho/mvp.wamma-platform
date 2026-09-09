# 003 · Captación y cotización instantánea (K-Price MVP)

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**
**Pilar Kavak:** Compra de autos al cliente · Precio algorítmico
**Depende de:** 001 (auditoría/roles); 002 (vendedor verificado para formalizar)
**Estado:** Draft para `/clarify`

> Spec del QUÉ y el POR QUÉ. CÓMO en `../000-overview/`. Principios en `../../.specify/memory/constitution.md`.

## 1. Objetivo
La sección "vende tu auto": el dueño ingresa los datos de su vehículo y recibe una **oferta preliminar al instante**, calculada con una tabla de precios de referencia del mercado venezolano.

## 2. Por qué importa
Es la **puerta de entrada del inventario**. Replica el "compramos tu auto en minutos" de Kavak. En el MVP usa una tabla de referencia; en Fase 2 evoluciona a modelo inteligente (K-Price avanzado, módulo 11).

## 3. Alcance
**Incluye (MVP):** formulario "vende tu auto"; motor de cotización basado en **tabla de referencia** (marca/modelo/año/estado); oferta preliminar instantánea en USD con equivalencia BCV; agenda de inspección.
**No incluye:** scraping de portales ni aprendizaje con datos reales (eso es Fase 2); cierre de compra (eso ocurre tras inspección).

## 4. Actores y roles
Vendedor particular; operador de captación; administrador de la tabla de referencia.

## 5. Historias de usuario
- Como **vendedor**, quiero ingresar los datos de mi auto y recibir una oferta preliminar al instante, para decidir si avanzo.
- Como **administrador**, quiero mantener la tabla de precios de referencia, para que las ofertas reflejen el mercado venezolano.

## 6. Requisitos funcionales (RF)
- **RF-003.1** Formulario de captación con datos del vehículo (marca, modelo, año, kilometraje, estado declarado).
- **RF-003.2** Motor de cotización que calcula una oferta preliminar a partir de la **tabla de referencia**.
- **RF-003.3** La oferta se expresa en **USD con equivalencia a tasa BCV** y registra la tasa aplicada.
- **RF-003.4** La oferta tiene **vigencia** (validez temporal) explícita.
- **RF-003.5** Tras aceptar la oferta preliminar, el vendedor puede **agendar inspección** (módulo 004).
- **RF-003.6** Administración mantiene la tabla de referencia con control de cambios auditado.

## 7. Requisitos no funcionales y cumplimiento
Multi-moneda obligatoria (Principio V). La oferta preliminar **no** es vinculante hasta inspección. Cambios a la tabla quedan en auditoría.

## 8. Reglas de negocio
La oferta preliminar se ajusta tras la inspección de 240 puntos (módulo 004). El precio final de compra depende del estado real verificado.

## 9. Entidades de datos
`cotizacion`, `vehiculo` (estado: captado) (ver `data-model.md`).

## 10. Integraciones
Ninguna externa en el MVP (tabla interna). Fase 2 añade fuentes de mercado.

## 11. Criterios de aceptación (Given/When/Then)
- **CA-003.1** Dado un vehículo con datos completos, cuando el vendedor solicita cotización, entonces recibe una oferta preliminar en USD + equivalencia BCV de forma inmediata.
- **CA-003.2** Dada una oferta vencida, cuando el vendedor intenta avanzar, entonces el sistema solicita recotizar.
- **CA-003.3** Dado un cambio en la tabla de referencia, cuando se guarda, entonces queda registrado en auditoría.

## 12. Métricas de éxito
Tiempo de cotización (objetivo: instantáneo); tasa de captación que avanza a inspección.

## 13. Preguntas abiertas
- `[NEEDS CLARIFICATION: fuente y estructura inicial de la tabla de referencia de precios del mercado venezolano]`
- `[NEEDS CLARIFICATION: vigencia estándar de la oferta preliminar]`

## 14. Trazabilidad
Constitución: Principios IV, V. Overview: módulo 003. Conecta con 004. Dependencias: 001, 002.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
