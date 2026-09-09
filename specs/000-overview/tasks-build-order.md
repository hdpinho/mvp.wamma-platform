# 000 · Orden de construcción y dependencias — MVP WAMMA

**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**

> El orden refleja prioridad estratégica y dependencias técnicas. Un agente **no** implementa un módulo cuyas dependencias no estén listas (Constitución, Principio VII).

## 1. Grafo de dependencias

```
001 Cumplimiento y seguridad  ← base de TODO (RBAC, auditoría, cifrado)
        │
        ├──► 002 KYC
        │        │
        │        ├──► 003 Captación / K-Price
        │        ├──► 005 Catálogo y venta ◄── 004 Inspección 240 puntos
        │        └──► 006 Riesgo, scoring y AML
        │                     │
        │                     └──► 007 Pagos, deuda y ledger
        │                                  │
        │                                  └──► 008 GPS con corte de ignición
        │
        └──► 004 Inspección 240 puntos

009 Tablero y tesorería  ← consume estado de inventario (003/004/005),
                           pagos y ledger (007); se construye en paralelo
                           y se completa al final.
```

## 2. Secuencia recomendada (olas)

| Ola | Módulos | Por qué en este orden |
|---|---|---|
| **0 — Cimientos** | 001 | Sin RBAC, auditoría y cifrado no se puede operar legalmente. Es la "base sólida desde el día uno". |
| **1 — Entrada** | 002, 004 | Identidad verificada (002) e inspección/certificación (004) habilitan inventario confiable. 003 (K-Price) puede iniciar aquí en paralelo. |
| **2 — Vitrina y crédito** | 003, 005, 006 | Catálogo (005) requiere autos certificados (004). El motor de riesgo (006) requiere KYC (002). |
| **3 — Dinero** | 007 | El ledger y los pagos requieren crédito aprobado (006). Pieza más crítica: máxima cobertura de pruebas. |
| **4 — Cobranza** | 008 | El corte por mora requiere créditos y cuotas vivas (007) + consentimiento legal. |
| **Transversal** | 009 | Tablero/tesorería consume todo; se construye en paralelo y cierra al final. |

## 3. Criterio de "terminado" por módulo (Definition of Done)

Un módulo de la Fase 1 está terminado cuando:
1. Cumple todos sus **criterios de aceptación** (Given/When/Then del `spec.md`).
2. No quedan `[NEEDS CLARIFICATION]` sin resolver.
3. Cada acción sensible queda en la **bitácora de auditoría** (módulo 001).
4. El control de accesos (RBAC) aplica el **mínimo privilegio**.
5. Las reglas de negocio críticas tienen **pruebas** (cuotas, ledger, scoring, corte GPS).
6. Si toca dinero: operaciones **idempotentes** y conciliables; montos con moneda + tasa BCV.
7. La documentación técnica para el **expediente Sudeban** está actualizada.

## 4. Hitos del MVP atados al financiamiento (referencia)

Según `Base_Conocimiento_Wamma.md`, el SAFE se desembolsa por hitos. La Fase 1 (esta plataforma) sostiene el paso de **Hito 1** (validación físico-digital, 80–100 autos, validar cobranza) hacia **Hito 2** (app propia, escalar a 200 autos). El orden de olas arriba prioriza primero la capacidad de **operar y cobrar**.

> Las cifras y montos del SAFE son datos maestros: ver `Base_Conocimiento_Wamma.md`. No se duplican aquí.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
