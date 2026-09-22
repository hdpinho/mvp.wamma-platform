# Manual de usuario — material de base

> Aquí se reúne, etapa por etapa, todo lo necesario para redactar el manual de usuario de la plataforma WAMMA: qué hace cada módulo, quién lo usa, cómo se usa paso a paso, qué reglas aplica el sistema y qué mensajes puede ver el usuario. Todavía no es el manual final: es su fuente verificada.

## Cómo se mantiene

- Cada etapa del backend actualiza los capítulos de los módulos que toca **antes** de darse por terminada (decisión D-20 de `specs/000-overview/decisiones-po.md`).
- Se describe lo que la plataforma hace **de verdad**. Lo simulado o lo que aún no existe se marca como tal, con la etapa en que se construye.
- Las capturas de pantalla se añaden al cerrar cada etapa, en `capturas/<capítulo>/`, numeradas por paso. Salen del recorrido automático en navegador de esa etapa, sobre un entorno de prueba con datos ficticios.

## Capítulos

| Capítulo | Módulo | Estado |
|---|---|---|
| [01 · Acceso, roles y seguridad](01-acceso-roles-y-seguridad.md) | 001 | **Completo** (etapa 1), con capturas: ingreso con 2FA, roles, usuarios, bitácora, mi cuenta y estado del servidor |
| [02 · Inventario y catálogo](02-inventario-y-catalogo.md) | 004 / 005 | **Completo** (etapa 2), con capturas: inventario, fotos, publicación, tasa BCV y vitrina. Textos al día con D-44 a D-47 (21/09/2026); las capturas de la vitrina y la portada son anteriores y se rehacen en el próximo recorrido |
| [03 · Seguimiento comercial](03-seguimiento-comercial.md) | 010 | Flujos de la maqueta, con los recaudos informativos de la cita (D-45). Pasa a datos reales en la etapa 3 |
| [04 · Financiamiento](04-financiamiento.md) | Simulador, parámetros, solicitud y bandeja | Flujos de la maqueta. Pasa a datos reales en la etapa 4 |

Las decisiones que el manual deja como **pendiente del PO** están en la tabla *Pendientes derivados* de `specs/000-overview/decisiones-po.md`.

## Glosario

| Término | Significado |
|---|---|
| **Sitio público** | Lo que ve cualquier visitante: catálogo, ficha del vehículo, simulador y solicitud de crédito |
| **Backoffice** | Área interna del personal de WAMMA, bajo `/admin` |
| **Persona** | Alguien que mostró interés en un vehículo. Puede no llegar nunca a ser cliente |
| **Oportunidad** | El interés de una persona en un vehículo concreto. Avanza por etapas hasta venderse o perderse |
| **Etapa** | Punto del embudo en que está una oportunidad: nuevo, contactado, cita confirmada, visitó, en negociación, vendido o perdido |
| **Oportunidad estancada** | La que lleva sin actividad más días de los que admite su etapa |
| **Enlace personal de financiamiento** | Enlace que el asesor envía a un cliente para que complete la solicitud de crédito de un vehículo concreto. Es la única vía de acceso a la solicitud |
| **Tasa BCV** | Tasa oficial del Banco Central de Venezuela, usada para mostrar equivalencias en bolívares |
| **Recaudos** | Documentos que respaldan una solicitud de crédito: cédula, RIF, constancia de ingresos, estados de cuenta, etc. |
