# WAMMA — Plataforma propia · Repositorio de Especificaciones (SDD)

**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**

Este repositorio define, con metodología **SDD (Spec-Driven Development)**, la plataforma propia de WAMMA: "el Kavak de Venezuela" + suscripción OCN, bajo regulación Sudeban. Está preparado para construirse con **Antigravity 2.0** (IDE/CLI agéntico) apoyado por **Claude Code**, sobre una única fuente de verdad.

> El negocio (cifras, marca, regulación, decisiones) vive en `Base_Conocimiento_Wamma.md`. **No se duplica aquí.** Si un dato falta o cambia, se actualiza ese documento maestro.

## Idea en una frase

Construimos el **MVP que factura** (Fase 1): comprar, certificar, vender, financiar y cobrar autos con cobranza protegida. Diferenciamos (Fase 2) y escalamos con IA (Fase 3) sobre bases sólidas.

## Estructura del repositorio

```
wamma-platform/
├── .specify/memory/constitution.md     # Ley suprema: principios no negociables
├── .agents/                            # Adaptador Antigravity 2.0
│   ├── rules/wamma-core.md             #   Reglas de proyecto (Always On)
│   └── workflows/sdd-pipeline.md       #   Workflow /sdd (constitution→...→implement)
├── AGENTS.md                           # Contexto cross-tool (Antigravity + Claude Code)
├── CLAUDE.md                           # Adaptador Claude Code (memoria + guardrails)
├── README.md                           # Este archivo
└── specs/
    ├── 000-overview/
    │   ├── product-overview.md         # Visión, modelo Kavak→software, 16 módulos, fases
    │   ├── architecture-plan.md        # El CÓMO: stack, capas, infra soberana + DR
    │   ├── data-model.md               # Entidades, ledger partida doble, multi-moneda
    │   ├── research-dependencies.md    # Dependencias críticas a confirmar
    │   └── tasks-build-order.md        # Orden de construcción y dependencias entre módulos
    └── 00X-<modulo>/spec.md            # 9 specs funcionales del MVP (Fase 1)
```

## Cómo se usa (flujo SDD)

1. **Constitución** — leer `.specify/memory/constitution.md`. Es vinculante.
2. **`/specify`** — cada módulo tiene su `spec.md` (QUÉ y POR QUÉ). Ya redactados para la Fase 1.
3. **`/clarify`** — resolver con un humano toda marca `[NEEDS CLARIFICATION]` antes de planificar.
4. **`/plan`** — el CÓMO técnico está en `architecture-plan.md` y `data-model.md`.
5. **`/tasks`** — el orden de construcción y dependencias en `tasks-build-order.md`.
6. **`/analyze`** — verificar consistencia spec ↔ plan ↔ tasks ↔ Constitución.
7. **`/implement`** — recién ahí se escribe código, módulo por módulo, en orden.

### Con Antigravity
- Las reglas de proyecto (`.agents/rules/wamma-core.md`) se cargan **Always On**.
- El workflow `/sdd` (en `.agents/workflows/`) encadena los pasos del pipeline.
- Multi-modelo: planificar con un modelo de razonamiento profundo, implementar con uno rápido.

### Con Claude Code
- `CLAUDE.md` se carga como memoria de proyecto en cada sesión.
- Comandos personalizados (`.claude/commands/`) replican el pipeline SDD.

## Reglas de oro

- **Constitución manda.** Si un cambio la viola, el agente detiene y consulta.
- **No inventar** cifras, posiciones de la estructura ni datos regulatorios. Si falta algo → `[NEEDS CLARIFICATION]`.
- **Soberanía de datos:** el *core* no se aloja en nubes extranjeras.
- **El código es de WAMMA:** repos en organización WAMMA desde el primer commit.

---
*Generado para el Project Wamma · No constituye asesoría legal ni financiera.*
