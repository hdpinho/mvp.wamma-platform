# 010 · Desglose de tareas — Seguimiento comercial de prospectos

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Septiembre 2026**
**Referencias:** `./spec.md` (QUÉ) · `./plan.md` (CÓMO)
**Estado:** Draft para validación del Product Owner

> Tareas ejecutables, ordenadas por dependencia. Cada una declara qué la desbloquea y cómo se verifica.
> Ninguna tarea arranca si una pregunta abierta de `spec.md` §13 la afecta directamente (Constitución, Principio VII).

---

## 0. Puerta de entrada

| Bloqueante | Bloquea | Estado |
|---|---|---|
| **C1** ¿cédula obligatoria para agendar? | F2, N2 (solo la rama por teléfono) | Pendiente de decisión de producto |
| **C2** período de conservación de datos | Nada del MVP; tarea futura | Ausente |
| **C3** reparto de oportunidades sin dueño | B4 (solo el reparto automático) | Ausente — mitigado con `asesor_id` nulo |
| **C4** identidad del asesor (módulo 001) | Olas 3, 4 y 5 completas | **Bloqueante duro** — el 001 no existe |
| **C5** umbral de "estancada" | F3, B5 | Ausente — mitigado con parámetro configurable |
| **C6** ¿se notifica al cliente? | Nada del MVP | Ausente |
| **C7** enmienda de la Constitución | Nada técnico; afecta la coherencia documental | Pendiente del Product Owner |
| **Módulo 001** (`internal/platform`) | Olas 3, 4 y 5 | **No construido** |

**Las olas 1 y 2 se pueden ejecutar hoy**, íntegras: son núcleo puro y maqueta, sin I/O ni identidad. Lo que **no** se puede es dar el módulo por terminado.

---

## Ola 1 · Núcleo puro (cero I/O, máxima cobertura)

Arranca sin dependencias externas. Es la parte del módulo que sobrevive a cualquier decisión de infraestructura.

### N1 — Entidades y catálogos del dominio
Crear `backend/internal/crm/domain/` con `Persona`, `Oportunidad`, `Interaccion` y los catálogos de etapas y motivos de pérdida de `spec.md` §8.1 y §8.2 como datos, no como constantes dispersas.
**Depende de:** nada.
**Verifica:** compila; prueba de arquitectura con `go list` que confirma que `crm` **no** importa `creditapp` (`plan.md` §2.1).

### N2 — Normalización y deduplicación
Módulo `dedup/`: normalización de cédula (puntos, guiones, letra en mayúscula) y de teléfono venezolano a E.164. Resolución por cédula, por teléfono y sin coincidencia, devolviendo **qué criterio** resolvió.
**Depende de:** N1. **Afectada por:** C1.
**Verifica:** **100 % de cobertura de ramas.** Casos: cédula con formato sucio, teléfono con y sin prefijo, `0414`/`+58414`/`58414` como el mismo número, cédula ausente, ambos ausentes.
**Nota:** la lógica de normalización telefónica ya existe en `frontend-web/src/screens/admin/O3_GestionCitas.tsx`; se porta a Go como fuente única, igual que se hizo con `mocks/financiamiento.ts` → `calc` (ver `../solicitud-credito/tasks.md` N3).

### N3 — Máquina de estados del embudo
Tabla de transiciones de `plan.md` §4, con validación de origen **y** de actor. Incluye la exigencia de motivo al cerrar en perdido y de nota al retroceder.
**Depende de:** N1.
**Verifica:** **100 % de ramas.** Toda transición válida e inválida; cierre sin motivo rechazado (`CA-010.2`); retroceso sin nota rechazado (`CA-010.10`); toda salida desde etapa terminal rechazada (`CA-010.3`).

### N4 — Cálculo de métricas del embudo
Módulo `metrics/`: conversión entre etapas, tiempo en etapa y detección de estancadas, operando sobre filas ya leídas (sin consultar la base).
**Depende de:** N1, N3.
**Verifica:** cobertura alta sobre datos fijos. Caso obligatorio: una oportunidad **abierta** cuenta el tiempo transcurrido hasta ahora, no queda fuera del promedio (`plan.md` §8).

---

## Ola 2 · Maqueta (valida el modelo antes de migrar)

Arranca en paralelo con la ola 1. Su propósito es que el equipo comercial corrija etapas y motivos **antes** de que exista una migración (`plan.md` §2.3).

### F1 — Separar el contexto de CRM
Extraer `frontend-web/src/state/crmContexto.tsx` con personas, oportunidades, interacciones y citas. `vehiculosContexto.tsx` se queda con inventario e imperfecciones. Tipos nuevos en `types/crm.ts`.
**Depende de:** nada.
**Verifica:** el inventario y los favoritos siguen funcionando igual; `npm run build` limpio; ningún componente importa ambos contextos para una sola tarea.

### F2 — Resolución de persona al capturar
`ModalAgendarCita.tsx` deja de crear una cita suelta: resuelve o crea la persona y abre la oportunidad en etapa `nuevo`.
**Depende de:** F1. **Afectada por:** C1.
**Verifica:** **`CA-010.1`** — dos citas con la misma cédula producen una persona y dos oportunidades. Prueba manual documentada, más prueba automatizada si ya existe arnés.

### F3 — Migración de los datos locales v1 → v2
Función de arranque que lee las claves `wamma_*_v1`, agrupa las citas existentes por cédula, crea personas y oportunidades, y persiste `v2`. Es el ensayo de la migración real.
**Depende de:** F1, F2. **Afectada por:** C5 (marca de estancadas).
**Verifica:** con 20 citas simuladas de 12 personas distintas, el resultado son 12 personas y 20 oportunidades, sin pérdida de datos ni duplicados. La v1 no se borra hasta confirmar.

### F4 — Pantalla de embudo
`screens/admin/O7_EmbudoComercial.tsx`: columnas por etapa con conteo y monto, filtro por asesor, marca de estancadas y de próxima acción vencida.
**Depende de:** F1, F3.
**Verifica:** mover una oportunidad respeta la máquina de estados; cerrar en perdido exige motivo en la interfaz, no solo en el modelo.

### F5 — Ficha 360 y registro de interacción
`screens/admin/O7_FichaPersona.tsx` con oportunidades e historial. En `O3_GestionCitas.tsx`, tras pulsar WhatsApp se ofrece registrar la interacción con canal, dirección y fecha ya rellenados y **un solo campo obligatorio** (`plan.md` §7.4).
**Depende de:** F4.
**Verifica:** registrar una interacción tras usar WhatsApp cuesta un clic y escribir la nota. Si cuesta más, la tarea no está terminada — es el punto donde este módulo se abandona.

---

## Ola 3 · Cimientos de datos

**Bloqueada por el módulo 001.** No arranca antes.

### O1 — Migraciones base
Las seis tablas de `plan.md` §3.2. UUID v7, `NUMERIC(18,2)` para el valor estimado, `BYTEA` + `_bidx` para cédula, teléfono y correo.
**Depende de:** módulo 001 (`platform/crypto`).
**Verifica:** la migración sube y baja limpia; ningún campo monetario es `float`; el índice único parcial sobre `cedula_bidx` existe.

### O2 — Inmutabilidad a nivel de motor
`REVOKE UPDATE, DELETE` + *trigger* `abortar_mutacion()` sobre `interacciones` y `etapa_historial`.
**Depende de:** O1.
**Verifica:** **`CA-010.4`** — `UPDATE` y `DELETE` fallan desde el usuario de aplicación. **Prueba de integración obligatoria**; sin base real no demuestra nada.

### O3 — Siembra de catálogos
`catalogo_etapas` y `catalogo_motivos_perdida` con los valores de `spec.md` §8.1 y §8.2, ya corregidos por lo aprendido en la ola 2.
**Depende de:** O1, F4.
**Verifica:** los catálogos sembrados coinciden con los que el equipo validó en la maqueta. Ninguna etapa ni motivo inventado.

---

## Ola 4 · Backend con I/O

### B1 — Repositorios
`store/` con las consultas de `personas`, `oportunidades`, `interacciones` y `etapa_historial`. Deduplicación con `ON CONFLICT ... DO NOTHING` y relectura (`plan.md` §5).
**Depende de:** O1, N2.
**Verifica:** **prueba de integración de la condición de carrera** — dos inserciones concurrentes con la misma cédula producen una sola persona.

### B2 — Transición de etapa transaccional
Cambio de `oportunidades.etapa` + escritura de `etapa_historial` + efecto sobre el inventario, todo en **una transacción**.
**Depende de:** B1, N3.
**Verifica:** `CA-010.5` y `CA-010.6`; el caso del §4 en que un cierre perdido **no** libera el vehículo porque otra oportunidad abierta lo reclama. Fallo simulado a mitad de la transacción no deja etapa cambiada sin historial.

### B3 — Interfaz de estado de solicitud
`EstadoSolicitud` de `plan.md` §2.1, implementada por `creditapp`. Expone estado y nada más.
**Depende de:** B1.
**Verifica:** **`CA-010.7`** — un asesor obtiene el estado de la solicitud y **ningún** campo financiero. Prueba de integración con rol real.

### B4 — API `/v1/crm`
Los nueve endpoints de `plan.md` §6. Paginación por cursor, `Idempotency-Key` en interacciones, `If-Match` en transición de etapa.
**Depende de:** B1, B2, B3, módulo 001 (RBAC).
**Verifica:** `CA-010.8` (filtrado por rol); un reintento de `POST` de interacción con la misma clave no duplica la nota; dos `PATCH` de etapa concurrentes → el segundo recibe `409`.

### B5 — Endpoint de métricas
`GET /v1/crm/metricas/embudo` con la consulta de `plan.md` §8 y caché en Redis de vencimiento corto.
**Depende de:** B1, N4. **Afectada por:** C5.
**Verifica:** `CA-010.9`; el resultado coincide con el cálculo puro de N4 sobre los mismos datos.

### B6 — Conmutar el frontend a la API
El `crmContexto` cambia de fuente: de persistencia local a `/v1/crm`. Las pantallas no cambian.
**Depende de:** B4, F5.
**Verifica:** las pantallas de la ola 2 funcionan contra el backend sin cambios de interfaz. Si hubo que rediseñar una pantalla, el contrato de la ola 2 estaba mal y se documenta por qué.

---

## Ola 5 · Verificación transversal

### V1 — Cifrado y búsqueda ciega
Confirmar que cédula, teléfono y correo están cifrados en reposo y que la búsqueda opera contra el índice ciego sin descifrar.
**Depende de:** O1, B1.
**Verifica:** **`CA-010.11`** — consulta directa a la base no muestra ninguna cédula en claro.

### V2 — Auditoría de acciones comerciales
Toda transición de etapa, reasignación de asesor y fusión de personas queda en la bitácora del módulo 001, incluidos los intentos rechazados.
**Depende de:** B2, B4, módulo 001.
**Verifica:** `CA-010.3`; una fusión por teléfono queda auditada con el criterio que la produjo (`plan.md` §5).

### V3 — Cierre del insumo D15
Confirmar que `oportunidad.id` es el `lead_id` que `../solicitud-credito/spec.md` §13 declara ausente, y actualizar ese spec para cerrar D15.
**Depende de:** B4.
**Verifica:** una solicitud de crédito creada desde una oportunidad queda vinculada en ambos sentidos; D15 deja de figurar como insumo ausente.

---

## Criterio de "terminado" del módulo

Además del criterio general de `../000-overview/tasks-build-order.md` §3:

1. Los once criterios de aceptación de `spec.md` §11 pasan.
2. `domain/`, `dedup/` y `metrics/` tienen **100 % de cobertura de ramas**.
3. Las tres pruebas de integración irrenunciables pasan: condición de carrera, inmutabilidad a nivel de motor y aislamiento del expediente de crédito.
4. Ninguna pregunta abierta de `spec.md` §13 que afecte a una tarea entregada queda sin resolver.
5. La **cobertura de registro** (métrica de `spec.md` §12) se mide sobre uso real: si el equipo no registra interacciones, el módulo no está terminado aunque el código funcione.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
