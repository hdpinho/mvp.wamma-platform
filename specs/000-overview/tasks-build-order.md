# 000 · Orden de construcción y dependencias — MVP WAMMA (Venta de Publicados)

**Clasificación:** Confidencial · **Rev.:** 2 · **Junio 2026**

> El orden refleja prioridad estratégica y dependencias técnicas para el MVP enfocado en venta y financiamiento de inventario vehicular publicado. Un agente **no** implementa un módulo cuyas dependencias no estén listas (Constitución, Principio VII).

## 1. Grafo de dependencias

```
001 Cumplimiento y seguridad  ← base de TODO (RBAC, auditoría, cifrado)
        │
        ├──► 004 Inspección 240 puntos y certificación
        │        │
        │        └──► 005 Catálogo de publicados y venta
        │                     │
        │                     └──► Solicitud de crédito (WMA-F-FIN-001)
        │                                  │
        │                                  └──► 006 Motor de riesgo y scoring
        │                                            │
        │                                            └──► 007 Pagos, deuda y ledger

009 Tablero y tesorería  ← consume estado de inventario publicado (004/005),
                           pagos y ledger (007); se construye en paralelo
                           y se completa al final.
```

## 2. Secuencia recomendada (olas)

| Ola | Módulos | Por qué en este orden |
|---|---|---|
| **0 — Cimientos** | 001 | Sin RBAC, auditoría y cifrado no se puede operar legalmente. Base sólida desde el día 1. |
| **1 — Certificación de Inventario** | 004 | Inspección de 240 puntos para certificar los vehículos que se publicarán en vitrina. |
| **2 — Vitrina y Solicitud** | 005, Solicitud Crédito | Publicación en catálogo (005) y captura digital de solicitudes WMA-F-FIN-001. |
| **3 — Evaluación y Dinero** | 006, 007 | Scoring/riesgo (006) y contabilidad inmutable en ledger + pagos C2P (007). |
| **Transversal** | 009 | Tablero y tesorería para administración de inventario y liquidaciones. |

## 3. Criterio de "terminado" por módulo (Definition of Done)

Un módulo de la Fase 1 está terminado cuando:
1. Cumple todos sus **criterios de aceptación** (Given/When/Then del `spec.md`).
2. No quedan `[NEEDS CLARIFICATION]` sin resolver.
3. Cada acción sensible queda en la **bitácora de auditoría** (módulo 001).
4. El control de accesos (RBAC) aplica el **mínimo privilegio**.
5. Las reglas de negocio críticas tienen **pruebas** (cálculo de cuotas, asientos del ledger, scoring).
6. Si toca dinero: operaciones **idempotentes** y conciliables; montos con moneda + tasa BCV.
7. La documentación técnica para el **expediente Sudeban** está actualizada.

## 4. Hitos del MVP (referencia)

La Fase 1 (esta plataforma) sostiene el modelo de venta directa y financiamiento de inventario vehicular publicado propio de WAMMA, priorizando la capacidad de **operar y cobrar** con cumplimiento normativo pleno.

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
