# 004 · Inspección de 240 puntos y validación legal

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**
**Pilar Kavak:** Certificación / confianza
**Depende de:** 001 (auditoría/roles)
**Estado:** Draft para `/clarify`

> **Etapa 2 del backend (septiembre 2026):** de este módulo solo se construye la **certificación simplificada**, que es lo que muestra la maqueta: el rol Inventario declara certificado el vehículo y registra sus imperfecciones sobre el diagrama. El checklist de 240 puntos, el OCR y los cruces legales siguen esperando sus preguntas abiertas. Ver `../005-catalogo-venta/plan.md`.

> Spec del QUÉ y el POR QUÉ. CÓMO en `../000-overview/`. Principios en `../../.specify/memory/constitution.md`.

## 1. Objetivo
La aplicación que usa el inspector en el patio para revisar el auto **punto por punto** (mecánica, estética y legal), cargar fotos y registrar el estado. En paralelo, valida por OCR los documentos y cruza contra reportes de robo y deudas.

## 2. Por qué importa
Es el **corazón de la confianza**, el pilar de Kavak. Convierte un auto usado en un **"producto certificado"**, que es lo que diferencia a WAMMA de un clasificado y justifica un mejor precio.

## 3. Alcance
**Incluye (MVP):** checklist de **240 puntos** (mecánica/estética/legal); carga de fotos/evidencia por punto; validación legal por **OCR** de documentos; cruce contra **robo y deudas**; resultado de certificación que alimenta el catálogo.
**No incluye:** visión por computadora para detectar daños (eso es Fase 3, módulo 14).

## 4. Actores y roles
Inspector de patio; supervisor de certificación; operador legal.

## 5. Historias de usuario
- Como **inspector**, quiero recorrer los 240 puntos en la app y cargar fotos por punto, para registrar el estado real del vehículo.
- Como **operador legal**, quiero que el sistema lea los documentos por OCR y los cruce contra robo y deudas, para no certificar un auto con problemas legales.
- Como **supervisor**, quiero aprobar la certificación, para que el auto pase a catálogo.

## 6. Requisitos funcionales (RF)
- **RF-004.1** Checklist de **exactamente 240 puntos** organizados por categoría (mecánica, estética, legal).
- **RF-004.2** Cada punto admite resultado y **evidencia** (foto/video) almacenada en object storage nacional.
- **RF-004.3** Validación legal por **OCR** de los documentos del vehículo.
- **RF-004.4** Cruce de la información legal contra **reportes de robo** y **deudas**.
- **RF-004.5** El sistema produce un **resultado de certificación** (apto/no apto/observaciones) que habilita o bloquea la publicación.
- **RF-004.6** La inspección queda **auditada** (quién, cuándo, qué resultado).

## 7. Requisitos no funcionales y cumplimiento
El número de puntos es **240** (dato maestro; no 250). Evidencia con residencia nacional. Trazabilidad completa de la certificación.

## 8. Reglas de negocio
Un auto **no apto legalmente** (robo/deuda) no puede publicarse ni certificarse. El resultado de la inspección ajusta el precio respecto de la oferta preliminar (módulo 003).

## 9. Entidades de datos
`inspeccion`, `inspeccion_punto`, `validacion_legal`, `vehiculo` (estado: inspección/reacondicionamiento) (ver `data-model.md`).

## 10. Integraciones
Motor OCR; fuente(s) de robo/deudas vehiculares. `[NEEDS CLARIFICATION: D6 — fuente oficial de robo/deudas]`.

## 11. Criterios de aceptación (Given/When/Then)
- **CA-004.1** Dada una inspección, cuando faltan puntos por evaluar, entonces no puede marcarse como completa.
- **CA-004.2** Dado un cruce que detecta robo o deuda, cuando se evalúa la validación legal, entonces el vehículo queda bloqueado para publicación.
- **CA-004.3** Dada una inspección aprobada, cuando el supervisor certifica, entonces el vehículo queda habilitado para catálogo (módulo 005).
- **CA-004.4** El checklist contiene 240 puntos.

## 12. Métricas de éxito
Tiempo de inspección por unidad; % de autos certificados sin reproceso; 0 publicaciones de autos con problema legal.

## 13. Preguntas abiertas
- `[NEEDS CLARIFICATION: catálogo definitivo de los 240 puntos por categoría]`
- `[NEEDS CLARIFICATION: D6 — fuente y método de cruce de robo/deudas]`

## 14. Trazabilidad
Constitución: Principios I, IV. Overview: módulo 004. Alimenta 005. Dependencias: 001; research D6.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
