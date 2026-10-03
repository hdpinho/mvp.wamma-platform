# 000 · Orden de construcción y dependencias — MVP WAMMA (Venta de Publicados)

**Clasificación:** Confidencial · **Rev.:** 3 · **Septiembre 2026**

> El orden refleja prioridad estratégica y dependencias técnicas para el MVP enfocado en venta y financiamiento de inventario vehicular publicado. Un agente **no** implementa un módulo cuyas dependencias no estén listas (Constitución, Principio VII).

## 1. Grafo de dependencias

```
001 Cumplimiento y seguridad  ← base de TODO (RBAC, auditoría, cifrado)
        │
        ├──► 004 Inspección 240 puntos y certificación
        │        │
        │        └──► 005 Catálogo de publicados y venta
        │                     │
        │                     ├──► 010 Seguimiento comercial (CRM ligero)
        │                     │              │ entrega el lead_id
        │                     │              ▼
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
| **2 — Vitrina, Prospectos y Solicitud** | 005, 010, Solicitud Crédito | Publicación en catálogo (005), seguimiento del interés que esa vitrina genera (010) y captura digital de solicitudes WMA-F-FIN-001. El 010 entrega el `lead_id` que la solicitud declara como insumo ausente (D15). |
| **3 — Evaluación y Dinero** | 006, 007 | Scoring/riesgo (006) y contabilidad inmutable en ledger + pagos C2P (007). |
| **Transversal** | 009 | Tablero y tesorería para administración de inventario y liquidaciones. |

### Estado de Ejecución en Desarrollo (2 de octubre de 2026)

Estado verificado en local. Nada está desplegado (D-56) ni tiene commit en `main`: el resguardo vive en la rama local `resguardo/mvp-2026-10-03`. Alcance de la entrega: hasta la aprobación del crédito (D-65, D-68).

| Módulo / Fase | Componentes Clave | Estado | Verificación |
|---|---|---|---|
| **001 — Seguridad y Accesos** | Ingreso con 2FA, RBAC por rol, bitácora inmutable, cifrado AES-GCM, límite de ingreso en base (V0021, spec 011) | **Listo en local** | Backend 212 pruebas; API R1 26/26 |
| **004 / 005 — Catálogo e Inventario** | Publicación, fotos S3/disco, tasa BCV diaria | **Listo en local** (servidor + web). Fotos de demostración: 7 con crédito verificado y 9 imágenes de prueba que no se publican (D-58, D-79); en producción las carga el usuario | `/v1/catalogo`, `/v1/inventario`, `/v1/tasa-bcv` |
| **010 — CRM Comercial y Citas** | Citas públicas, bandeja, embudo, personas, enlace de financiamiento de 7 días, reserva de 24 h, servidor como fuente de verdad | **Listo en local.** «Tomar» y «repartir» quedan fuera del MVP (D-73) | API R2 39/39; navegador 23/23 |
| **Solicitud de crédito (WMA-F-FIN-001)** | Formulario de 8 pasos, recaudos en contenedor privado con enlace firmado, expediente cifrado, número con contador atómico, cálculo de cuota y capacidad en el servidor | **Listo en local** | API R3 14/14; V0019 y V0020 |
| **Análisis y dictamen** | Dictamen manual con justificación obligatoria (D-63); reabrir expediente y recaudos (D-70, D-71) | **En trabajo** (Plan Final, F2) | — |
| **006 — Scoring, AML y Score Buró** | Existe el código, apagado con `WAMMA_RIESGO_MOTOR=false` | **Fuera de alcance** (D-63). No se reactiva sin spec, plan y tareas aprobados | Las pruebas del motor corren con la bandera activa |
| **007 Fintech/ledger, 009 Tesorería** | — | **No iniciados** (fuera del MVP) | — |

> **Qué se puede construir antes del 001.** El grafo describe dependencias de *módulo terminado*, no de *cada tarea*. Varios módulos tienen un núcleo puro —sin I/O, sin identidad, sin persistencia— que no depende del 001 y se puede escribir hoy: `solicitud-credito` tuvo un núcleo puro en Go (`calc` y `validation`, 100 % de cobertura), archivado en `backend/_legacy-go/` como referencia para la reescritura en Java. El 010 declara sus olas 1 y 2 en la misma condición. Lo que el 001 bloquea es **dar un módulo por terminado**, no empezarlo por donde no toca persistencia.

## 3. Criterio de "terminado" por módulo (Definition of Done)

Un módulo de la Fase 1 está terminado cuando:
1. Cumple todos sus **criterios de aceptación** (Given/When/Then del `spec.md`).
2. No quedan `[NEEDS CLARIFICATION]` sin resolver.
3. Cada acción sensible queda en la **bitácora de auditoría** (módulo 001).
4. El control de accesos (RBAC) aplica el **mínimo privilegio**.
5. Las reglas de negocio críticas tienen **pruebas** (cálculo de cuotas, asientos del ledger, scoring).
6. Si toca dinero: operaciones **idempotentes** y conciliables; montos con moneda + tasa BCV.
7. La documentación técnica y el material del **manual de usuario** (`docs/manual-usuario/`) están actualizados (decisión D-20). *(Antes: expediente Sudeban, que no aplica desde la Constitución v2.0.0.)*

## 4. Hitos del MVP (referencia)

La Fase 1 (esta plataforma) sostiene el modelo de venta directa y financiamiento de inventario vehicular publicado propio de WAMMA, priorizando la capacidad de **operar y cobrar** con cumplimiento normativo pleno.

---
*WAMMA · Confidencial · Rev. 3 · No constituye asesoría legal ni financiera.*
