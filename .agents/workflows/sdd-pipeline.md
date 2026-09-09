# Workflow: /sdd — Pipeline SDD WAMMA

**Descripción:** Ejecuta el ciclo Spec-Driven Development de WAMMA para un módulo dado, respetando la Constitución y el orden de construcción. Invocación: `/sdd <id-modulo>` (ej. `/sdd 007-fintech-pagos-ledger`).

## Pasos

1. **Cargar Constitución.** Abre `.specify/memory/constitution.md`. Si cualquier paso siguiente la contradice, detente y reporta.
2. **Specify.** Abre `specs/<id-modulo>/spec.md`. Resume objetivo, alcance, requisitos funcionales y criterios de aceptación.
3. **Clarify.** Lista todas las marcas `[NEEDS CLARIFICATION]` del spec. Si hay alguna sin resolver, **detente** y solicita la decisión al humano. No inventes la respuesta.
4. **Dependencias.** Verifica en `specs/000-overview/tasks-build-order.md` que las dependencias del módulo ya están implementadas. Si no, detente y avísalo.
5. **Plan.** Cruza el spec con `specs/000-overview/architecture-plan.md` y `specs/000-overview/data-model.md`. Propón un plan técnico breve para este módulo (componentes, entidades tocadas, integraciones, pruebas).
6. **Tasks.** Deriva la lista ordenada de tareas a partir del plan. Marca dependencias internas.
7. **Analyze.** Verifica consistencia spec ↔ plan ↔ tasks ↔ Constitución. Reporta cualquier conflicto antes de tocar código.
8. **Implement.** Solo tras aprobación humana del plan: implementa en orden, con pruebas para reglas de negocio críticas. Commits en español `tipo(modulo): descripción`.
9. **Verify.** Ejecuta pruebas; para UI, verifica en navegador. Genera el resumen de entrega (qué se hizo, qué falta, riesgos).

## Guardas
- Cumplimiento Sudeban, soberanía de datos, propiedad del código, ledger inmutable y seguridad transversal **no se negocian**.
- El módulo financiero no se da por terminado sin bitácora de auditoría, control de accesos y reportería operativos.
