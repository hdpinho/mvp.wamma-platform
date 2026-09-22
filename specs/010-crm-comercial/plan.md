# 010 · Plan técnico — Etapa 3: seguimiento comercial en el servidor

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 2 · **Septiembre 2026**
**Spec de referencia:** `./spec.md` (Rev. 1, con los ajustes de §0.2)
**Estado:** **Aprobado** por el Product Owner el 21 de septiembre de 2026 (D-48), con la opción recomendada en cada punto de §1. La Rev. 1 (escrita para Go) queda en el historial de Git

> El QUÉ está en `spec.md`. Aquí va el CÓMO. `../000-overview/architecture-plan.md` manda sobre lo transversal. El plan del 001 fija la seguridad, la bitácora y la persistencia con `JdbcClient`; el del 005, el inventario y la disponibilidad.

---

## 0. Qué cambia respecto de la Rev. 1

### 0.1 Lo que se conserva

El modelo de dominio de la Rev. 1 **sigue vigente**, porque la ola 2 lo validó en la maqueta con uso real:
- las siete etapas y la máquina de estados (§4);
- el catálogo cerrado de motivos de pérdida;
- la deduplicación por cédula o por cualquier teléfono, con la consolidación y la fusión reversible (§5);
- las tres tablas append-only;
- el cálculo de métricas sobre `etapa_historial` (§9).

El esquema ya existe: V0004, alineado con este plan en V0010–V0011. Tampoco cambian los catálogos sembrados.

### 0.2 Lo que cambia

| Punto | Rev. 1 | Rev. 2 | Motivo |
|---|---|---|---|
| Stack | Go, `internal/crm/…` | Spring Boot, `com.wamma.crm`, `JdbcClient` | Migración del backend a Spring Boot (`architecture-plan.md`) |
| Moneda (S4) | USD | **EUR**, con la tasa BCV fijada al publicar | Constitución v3.0.0 (D-21): deuda declarada que se paga en esta etapa |
| Caché de métricas | Redis | Consulta directa, sin caché | Redis está fuera del MVP (`AGENTS.md`) |
| Identidad (S3, C4) | `asesor_id` nulo hasta el 001 | Usuario real de la sesión (`CurrentUser`) | El 001 ya existe (D-24) |
| Aviso al buzón comercial (spec §10) | Correo al buzón en cada captura | **Se retira**; la captura se ve en el backoffice | D-18 |
| Modalidad al agendar (spec §8.8) | Contado o financiamiento | **Siempre financiamiento** | D-30 |
| Reserva al agendar (RF-010.18) | Indefinida hasta que el asesor actúe | Con **plazo** (E4) | Con captación pública real, una reserva sin plazo deja que cualquiera vacíe la vitrina |

Con la aprobación (D-48), el spec pasa a Rev. 2 con estos ajustes, y las preguntas C3 y C8 a C11 quedan cerradas en su §13.

---

## 1. Decisiones y propuestas

| # | Punto | Aprobado (D-48) | Estado |
|---|---|---|---|
| E1 | Paquete y dependencias | `com.wamma.crm`, con `crm.domain` puro: etapas, transiciones, normalización y métricas, sin Spring ni I/O. `crm` usa `platform` (usuario, bitácora, cifrado) e `inventory`, este último **solo a través de su servicio** de disponibilidad, nunca por SQL directo. Nadie importa `crm` salvo el futuro `creditapp`. La regla `crm ↛ creditapp` se comprueba con una prueba de arquitectura (ArchUnit, dependencia nueva solo para pruebas) | Aprobado (D-48) |
| E2 | Moneda | `oportunidad.moneda` pasa a `EUR`/`VES`, por omisión `EUR`. El `valor_estimado` es el **precio publicado**, con la tasa y la fecha que la publicación fijó al publicarse. No se recalcula | Aprobado (D-48) |
| E3 | Captación pública | `POST /v1/citas` sin sesión. Pide lo mismo que el formulario actual: nombre, WhatsApp, correo opcional, vehículo, día y franja. Resuelve o crea la persona **por teléfono** (la cédula llega al confirmar, §8.5 del spec), abre la oportunidad en `nuevo` y la cita en `pendiente`. Si ya existe una oportunidad abierta de esa persona sobre ese vehículo, la reutiliza: un doble envío no duplica nada | Aprobado (D-48) |
| E4 | Plazo de la reserva al agendar (**C8**, pendiente de D-26) | **A (recomendada):** la cita pendiente reserva el vehículo durante un plazo (**propuesto: 24 h**). Si nadie la confirma en ese plazo, el vehículo vuelve a disponible; la cita sigue pendiente en la bandeja, ya sin reserva. **B:** agendar no reserva; se reserva al confirmar. Es lo más simple, pero contradice RF-010.18. **C:** reserva sin plazo, como la maqueta. Así, cualquiera podría bloquear toda la vitrina con citas falsas | **Aprobado** (D-48): A, 24 h |
| E5 | Límite de captación | Tope de citas públicas por IP y por teléfono en una ventana (**propuesto: 5 por IP y 2 por teléfono cada 24 h**). En memoria, con el mismo mecanismo que el límite de ingreso del 001. Sin CAPTCHA en esta etapa: exigiría un proveedor externo (Principio II) | **Aprobado** (D-48): 5 por IP y 2 por teléfono cada 24 h |
| E6 | Venta de contado (**C10**) | D-30 retiró el contado del formulario público, pero la bandeja todavía ofrece «Vender de contado». **A (recomendada):** se mantiene en el backoffice, porque un cliente puede decidir pagar de contado en la visita. **B:** se retira también de la venta | **Aprobado** (D-48): A |
| E7 | Enlace de financiamiento (**C9**) | Al vender con financiamiento se emite un token aleatorio de 32 bytes. En la base solo se guarda su SHA-256, con emisión y vencimiento; el token se muestra **una sola vez**, para que el asesor lo envíe. `GET /v1/enlaces-financiamiento/{token}` (público) dice si es válido y a qué vehículo apunta, sin ningún dato personal. Se marca como usado cuando se envíe la solicitud, que es de la etapa 4. Vencimiento propuesto: **7 días**. Reemitirlo invalida el anterior | **Aprobado** (D-48): 7 días |
| E8 | Reparto sin dueño (**C3**) | El coordinador asigna (`crm.asignar`). Además, **un asesor puede tomar una oportunidad sin dueño** para sí mismo; no puede quitársela a otro. Sin eso, nada avanza mientras no haya coordinador. El reparto automático queda fuera | **Aprobado** (D-48) |
| E9 | Rango de ingresos al agendar (**C11**) | Hoy el formulario lo pide, pero **no se guarda en ninguna parte**. Pedir un dato que no se usa va contra el mínimo privilegio (Principio I), y el ingreso es del expediente de crédito, no de la capa comercial (§8.3). **A (recomendada):** retirar el campo del formulario. **B:** guardarlo, y entonces el PO define para qué y quién lo ve | **Aprobado** (D-48): A |
| E10 | Datos de la maqueta | No se migran al servidor: son simulados. El servidor arranca con el CRM vacío. El servidor local de desarrollo (`LocalDevServer`) sí siembra algunas personas y citas ficticias para los recorridos | Aprobado (D-48) |
| E11 | Cédula en el backoffice | Se muestra completa a quien tiene `crm.ver_propias` o `crm.ver_todas`, porque la necesita para confirmar y fusionar (§8.3). En la bitácora va siempre enmascarada (`Masking`). La búsqueda por cédula o teléfono usa el índice ciego y no descifra nada | Aprobado (D-48) |
| E12 | Etiqueta «Reservado para cita» (D-44) | No se toca en esta etapa. Si el PO decide que se derive de la disponibilidad (pendiente en `decisiones-po.md`), es un cambio pequeño en el catálogo público | Nota |
| E13 | Alta manual de personas (RF-010.1) | Fuera de esta etapa: la maqueta no tiene esa pantalla. Las personas entran por la cita pública | Aprobado (D-48) |

---

## 2. Encaje en la arquitectura

```
backend/src/main/java/com/wamma/
├── platform/        # 001: seguridad, bitácora, cifrado, errores
├── inventory/       # 004 parcial + 005: vehículo, publicación, disponibilidad
├── catalog/         # vitrina pública
├── exchangerate/    # tasa BCV
└── crm/             # ◄ NUEVO
    ├── domain/      # puro: Stage, TransitionRules, LossReason, PhoneNormalizer,
    │                #        CedulaNormalizer, FunnelMetrics
    ├── PersonRepository, OpportunityRepository, InteractionRepository,
    │   AppointmentRepository, StageHistoryRepository
    ├── IdentityResolver        # deduplicación y consolidación (§5)
    ├── AppointmentService      # captación pública, confirmación, descarte, asistencia
    ├── OpportunityService      # etapas, asesor, próxima acción, venta, enlace
    ├── InteractionService
    ├── FunnelService           # métricas
    ├── PublicAppointmentController, CrmController, FinancingLinkController
    └── CaptureRateLimiter
```

- **Dependencias:** `crm → platform` (usuario, bitácora, `FieldCipher`, `BlindIndex`, errores) y `crm → inventory` (leer el vehículo y su publicación; cambiar la disponibilidad). `inventory` no conoce `crm`.
- **Estado de la solicitud de crédito:** `crm.domain` declara un puerto `CreditApplicationStatus` que devuelve **solo el estado**. Hasta la etapa 4 no hay implementación, y la oportunidad muestra «sin solicitud». El asesor no verá el balance del cliente porque el puerto no lo expone, no porque un `if` lo filtre (spec §8.3).
- **Persistencia:** `JdbcClient`. Cada operación escribe sus cambios, su historial y su registro en la bitácora **en una sola transacción**.
- **Dinero:** `platform.money.Money` (EUR), nunca `double`.

---

## 3. Modelo físico — migración V0017

Las tablas ya existen (V0004, V0010, V0011). Solo se ajusta:

| Tabla | Cambio |
|---|---|
| `oportunidad` | `moneda`: por omisión `EUR` y `CHECK (moneda IN ('EUR', 'VES'))` (E2). `modalidad_pago` conserva `contado` y `financiamiento` (E6-A) |
| `cita_inspeccion` | + `reserva_vence_en` (TIMESTAMPTZ), por E4-A. Nulo = la cita ya no reserva. Índice parcial sobre las que todavía reservan, para la tarea de vencimiento |

Reglas de toda migración nueva (`database-schema-design.md` §5):
- no toca `flyway_schema_history`;
- falla con un mensaje claro si encuentra oportunidades en `USD`, en lugar de convertirlas en silencio;
- tiene pruebas en `pruebas-esquema.sql` y se prueba desde cero en local y en la CI;
- se ensaya contra Supabase en una transacción que se revierte antes del despliegue, con tu confirmación.

**Numeración:** V0017 es el siguiente número libre en `main`. El PR #1 reserva V0016–V0018 para el spec 011; como se mezcla al final del proyecto, **sus migraciones se renumeran al mezclar** para ir después de las de `main`.

---

## 4. Máquina de estados

Sin cambios respecto de la Rev. 1. Vive en `crm.domain.TransitionRules`, sin I/O:

| Desde | Hacia | Condición |
|---|---|---|
| Cualquier etapa abierta | Una posterior | Avance libre, incluso saltando etapas |
| Cualquier etapa abierta | `cerrado_perdido` | **Exige motivo** del catálogo; `otro` exige además texto |
| Cualquier etapa abierta | Una anterior | **Exige nota** no vacía |
| `cerrado_ganado`, `cerrado_perdido` | — | **Terminal.** Ninguna transición |

Toda transición:
1. se valida en el dominio;
2. si es válida, escribe `etapa_historial` y la bitácora **en la misma transacción** que el cambio de etapa, con control optimista por `version` (`If-Match`);
3. si es inválida, se rechaza con 422 y el intento queda en la bitácora (`oportunidad.transicion_rechazada`, CA-010.3).

**Efectos sobre el inventario**, en la misma transacción y a través del servicio de `inventory`:

| Hecho | Disponibilidad del vehículo |
|---|---|
| Cita pública agendada | `cita_agendada`, con el plazo de E4 |
| Oportunidad → `cerrado_ganado` | `vendido` |
| Oportunidad → `cerrado_perdido`, cita descartada o reserva vencida | `disponible`, **solo si** ninguna otra oportunidad abierta lo reclama |
| Venta con financiamiento | Sigue reservado: la oportunidad pasa a `negociacion` |

Un vehículo con cita o vendido **no admite una cita pública nueva** (409, RF-010.18). El control es de la base, no del formulario: dos visitantes que agendan el mismo auto a la vez producen **una** reserva, gracias a un `UPDATE … WHERE estado = 'exhibicion'`, que es atómico.

---

## 5. Deduplicación y consolidación

La regla es la de la Rev. 1 (§5 y §5.1), portada a Java:

1. **Normalizar** (`crm.domain`, puro):
   - la cédula, sin puntos, guiones ni espacios y con la letra en mayúscula;
   - el teléfono, a E.164 venezolano (`0414…`, `414…`, `58414…` y `+58414…` son el mismo número). La normalización del frontend (`types/crm.ts`) es la referencia y se prueba con los mismos casos.
2. **Índice ciego** con `BlindIndex`, con un contexto distinto por campo (`persona.cedula`, `persona_telefono.telefono`, `persona.correo`). El valor en claro se cifra con `FieldCipher` bajo el mismo contexto.
3. **Resolver:** por cédula si la hay; si no, por **cualquier** teléfono de la persona; si no, se crea una persona nueva. Se guarda `criterio_resolucion`.
4. **Carrera:** el índice único de `indice_ciego_cedula` es la garantía de CA-010.1. La inserción usa `ON CONFLICT DO NOTHING` y, si no devuelve fila, vuelve a leer.

**Al confirmar la cita** llega la cédula:
- si no existe en otra persona, se adjunta;
- si existe en **otra**, se **fusionan**: sobrevive la más antigua, se reasignan oportunidades, citas, teléfonos e interacciones, la absorbida queda en estado `fusionado` y en `fusion_persona` queda una copia íntegra, ya cifrada;
- el teléfono principal pasa a ser el de la cita más reciente, y los demás se conservan.

La fusión se hace en **una transacción**, queda en la bitácora con el criterio que la produjo y **no se borra nada**. El botón de revertir sigue fuera de alcance; los datos para hacerlo, no.

---

## 6. Flujos

### 6.1 Agendar (sitio público)
`POST /v1/citas` →
1. límite de E5;
2. validación (fecha de hoy en adelante, franja, teléfono venezolano válido);
3. el vehículo debe estar en la vitrina y disponible;
4. se resuelve la persona por teléfono;
5. se crea o reutiliza la oportunidad (`nuevo`, modalidad financiamiento, valor = precio publicado);
6. se crea la cita `pendiente` y se reserva el vehículo durante 24 h (E4);
7. bitácora `cita.agendada`, sin actor.

La respuesta no devuelve ningún dato personal: solo el día, la franja y el estado.

### 6.2 Bandeja de citas (backoffice)
- **Confirmar:** pide la cédula (consolida o fusiona, §5) y permite corregir el correo, el día y la franja. Lleva la oportunidad a `cita_confirmada`, quita el vencimiento de la reserva y devuelve los datos para el `mailto:` del asesor, como hoy.
- **Descartar:** pide un motivo del catálogo. Descarta la cita, cierra la oportunidad en `cerrado_perdido` y libera el vehículo si nadie más lo reclama.
- **Asistió:** lleva la oportunidad a `visito`.
- **Vender:** pide confirmar la modalidad (E6-A). De contado cierra en `cerrado_ganado` y el vehículo pasa a vendido. Con financiamiento, la oportunidad pasa a `negociacion` y se emite el enlace (E7).
- **WhatsApp:** abre `wa.me` y después **ofrece** registrar la interacción (RF-010.11).

### 6.3 Vencimiento de la reserva (E4-A, 24 h)
Una tarea programada (`@Scheduled`, cada 15 minutos; es la primera del backend, así que se activa `@EnableScheduling`) libera los vehículos cuya reserva venció y deja en la bitácora `cita.reserva_vencida`. La consulta de disponibilidad de la vitrina aplica el vencimiento por su cuenta, así que un servidor dormido (D-19) no deja vehículos bloqueados de más.

### 6.4 Embudo, personas e interacciones
Son las pantallas de la ola 2, ahora con datos del servidor. El asesor ve sus oportunidades y las que no tienen dueño (`crm.ver_propias`); el coordinador y el auditor ven todas (`crm.ver_todas`).

---

## 7. Contratos de API

| Método y ruta | Permiso | Notas |
|---|---|---|
| `POST /v1/citas` | Público | E3, E5. 409 si el vehículo ya tiene cita, está vendido o no está en la vitrina |
| `GET /v1/enlaces-financiamiento/{token}` | Público | E7: `{valido, vehiculo}` o 404; nunca datos personales |
| `GET /v1/crm/citas?estado=` | `crm.ver_propias` / `crm.ver_todas` | Bandeja, filtrada por rol |
| `POST /v1/crm/citas/{id}/confirmacion` | `crm.operar` | `{cedula, correo?, dia?, franja?}` → consolidación o fusión |
| `POST /v1/crm/citas/{id}/descarte` | `crm.operar` | `{motivo, texto?}` |
| `POST /v1/crm/citas/{id}/asistencia` | `crm.operar` | → `visito` |
| `POST /v1/crm/oportunidades/{id}/venta` | `crm.operar` | `{modalidad}`. Con financiamiento devuelve el enlace **una sola vez** |
| `GET /v1/crm/oportunidades?etapa=&asesor=&estancadas=&cursor=` | `crm.ver_propias` / `crm.ver_todas` | Paginación por cursor; CA-010.8 |
| `PATCH /v1/crm/oportunidades/{id}/etapa` | `crm.operar` | `{etapa, motivo?, texto?, nota?}` con `If-Match`; 409 si otro la movió antes |
| `PUT /v1/crm/oportunidades/{id}/asesor` | `crm.asignar`, o `crm.operar` para tomar una sin dueño (E8) | |
| `PUT /v1/crm/oportunidades/{id}/proxima-accion` | `crm.operar` | `{accion, fecha}` |
| `GET /v1/crm/personas?q=` · `GET /v1/crm/personas/{id}` | `crm.ver_propias` / `crm.ver_todas` | Búsqueda por nombre (texto) o por cédula y teléfono (índice ciego). Ficha 360 |
| `POST /v1/crm/personas/{id}/interacciones` | `crm.operar` | Con `Idempotency-Key`; `oportunidadId` opcional; `corrigeInteraccionId` opcional |
| `GET /v1/crm/metricas/embudo?desde=&hasta=` | `crm.ver_todas` | §9 |
| `GET /v1/crm/catalogos` | `crm.ver_propias` / `crm.ver_todas` | Etapas con umbrales y motivos de pérdida, desde la base |

- **Visibilidad:** un asesor que pide una oportunidad ajena recibe **404**, no 403, para no confirmar que existe. El intento queda en la bitácora.
- **Errores:** en el formato Problem Details de la etapa 0.
- **Eventos nuevos de la bitácora:**
  - `cita.agendada`, `cita.confirmada`, `cita.descartada`, `cita.reserva_vencida`;
  - `persona.creada`, `persona.fusionada`;
  - `oportunidad.etapa_cambiada`, `oportunidad.transicion_rechazada`, `oportunidad.asesor_asignado`, `oportunidad.venta_contado`;
  - `enlace_financiamiento.emitido`;
  - `interaccion.registrada`.

  Los datos personales van enmascarados.

---

## 8. Frontend

- **Clientes de la API:** `api/citas.ts` (público) y `api/crm.ts` (backoffice).
- **`state/crm.tsx`:**
  - con servidor y sesión, lee y escribe en `/v1/crm`, con operaciones asíncronas que devuelven errores que la pantalla muestra;
  - sin servidor, sigue en modo maqueta, como hoy;
  - las pantallas no deberían cambiar de forma. Si alguna tiene que cambiar, se documenta por qué: el contrato de la ola 2 estaba mal (tarea B6 de la Rev. 1).
- **`ModalAgendarCita`:** con servidor, envía a `POST /v1/citas` y muestra el 409 («este vehículo ya tiene una cita») y el 429. Se retira el campo de rango de ingresos (E9-A), también en modo maqueta.
- **Vitrina y ficha:** el «Con cita» sale de la disponibilidad del servidor, que ya viene en `/v1/catalogo`.
- **Bandeja (`O3_GestionCitas`):** confirmar, descartar, asistió, vender y registrar interacción contra el servidor. El enlace de financiamiento se muestra una vez, con «Copiar» y el mensaje de WhatsApp.
- **Embudo, personas y ficha 360 (`O7_*`):** con filtro por asesor, que antes estaba bloqueado por C4.
- **Solicitud (`C9`):** valida el enlace con `GET /v1/enlaces-financiamiento/{token}`. El resto de la solicitud sigue en la maqueta hasta la etapa 4.
- **Sin cambios:** `correoCita.ts` (`mailto:`) y los enlaces `wa.me`.

---

## 9. Métricas del embudo

Se conserva la consulta de la Rev. 1 sobre `etapa_historial`, con `LEAD()` y `COALESCE(siguiente, now())`, para que las oportunidades vivas cuenten el tiempo que llevan paradas.

**Corrección respecto de la Rev. 1:**
- **Tiempo en etapa.** La consulta filtraba por período *antes* de calcular `LEAD()`. Así, si la oportunidad dejaba la etapa después del período, su tiempo se contaba hasta hoy. Ahora `LEAD()` se calcula sobre todo el historial y el filtro por período va después.
- **Conversión.** Se mide sobre la **cohorte** de oportunidades creadas en el período. Llegar a una etapa es llegar a ella o a una posterior; «Perdido» no cuenta como avance.
- **Referencia.** Las dos reglas están en `crm.domain.FunnelMetrics`, y la consulta de C8 se prueba contra ella.

Sin Redis:
- se calcula en cada consulta, con los índices de V0012;
- objetivo del spec: **< 500 ms con 5.000 oportunidades abiertas**. Se mide con una prueba de integración sobre datos sintéticos.

Si no se cumple, se añade una caché en memoria de vencimiento corto, sin servicios externos.

---

## 10. Estrategia de pruebas

| Objeto | Nivel | Exigencia |
|---|---|---|
| `crm.domain`: transiciones, normalización y métricas | Unitaria, sin Spring | **100 % de ramas**, medido con JaCoCo (plugin nuevo en el pom) solo sobre ese paquete. CA-010.2, CA-010.3 y CA-010.10. Una oportunidad viva cuenta hasta ahora (CA-010.9) |
| Deduplicación y fusión | Integración (PostgreSQL embebido) | CA-010.1 con **dos inserciones concurrentes** de la misma cédula; la fusión reasigna todo y conserva la copia |
| Inmutabilidad | Integración, con `SET ROLE wamma_app` | CA-010.4: `UPDATE`, `DELETE` y `TRUNCATE` sobre `interaccion` y `etapa_historial` fallan por privilegio |
| Efectos sobre el inventario | Integración | CA-010.5 y CA-010.6. El cierre perdido **no** libera un vehículo que otra oportunidad reclama. Dos citas simultáneas al mismo vehículo producen una sola reserva. Reserva vencida (E4) |
| Visibilidad por rol | Integración | CA-010.8: el asesor ve las suyas y las sin dueño; una ajena devuelve 404 y queda en la bitácora |
| Aislamiento del expediente | Integración | CA-010.7: ninguna respuesta del CRM incluye campos financieros |
| Cifrado | Integración | CA-010.11: la base no tiene ninguna cédula, teléfono ni correo en claro |
| Captación pública | Integración | Límite de E5 (429); doble envío sin duplicados; 409 en un vehículo con cita |
| Arquitectura | ArchUnit | `crm` no depende de `creditapp`; `inventory` no depende de `crm` |
| Rendimiento del embudo | Integración | < 500 ms con 5.000 abiertas |
| V0017 | `SchemaTestRunner` y CI | Desde cero; en Supabase, ensayo antes del despliegue |
| Recorrido en navegador | Playwright | Agendar → la vitrina lo marca «Con cita» → confirmar con una cédula ya existente (fusión) → asistió → vender con financiamiento → el enlace abre la solicitud. Sin errores de consola ni de CSP |

---

## 11. Despliegue (acciones del PO, al final de la etapa)

Esta etapa **no despliega sola**. Render aplica todas las migraciones pendientes al arrancar (`FLYWAY_ENABLED=true`), así que el primer deploy que arranque bien llevará Supabase de V0012 a V0017 de una vez. Antes de eso:
1. revisar los desfases de V0015 (`database-schema-design.md` §6);
2. hacer el ensayo de V0013–V0017 contra Supabase, en una transacción que se revierte;
3. configurar en Render los secretos que faltan (BD, `WAMMA_CLAVE_*`, administrador inicial y fotos);
4. poner `VITE_API_URL` en Vercel.

Es la etapa 5 del plan (D-02). Se decide con el PO.

---

## 12. Riesgos y limitaciones

| Riesgo | Mitigación |
|---|---|
| Citas falsas que bloquean la vitrina | Reserva de 24 h (E4) y límite de 5 citas por IP y 2 por teléfono cada 24 h (E5). Sin CAPTCHA en esta etapa |
| El límite por IP depende de la IP de origen. En `main`, `X-Forwarded-For` todavía no está endurecido; lo corrige el PR #1 | Se añade además el límite por teléfono, que no depende de la IP. Al mezclar el PR, el límite de captación usa su lectura de IP |
| Una fusión por teléfono equivocada (teléfono familiar compartido) | Solo se fusiona al llegar la **cédula**; por teléfono solo se reutiliza la persona, y queda el criterio. La copia en `fusion_persona` permite revertir |
| La cédula se ve completa en el backoffice | Solo con permisos del CRM (E11); la bitácora la enmascara |
| Servidor dormido (D-19) al agendar | El formulario espera y reintenta una vez; si falla, lo dice y no pierde lo escrito |
| Choques con el PR #1 al mezclar | Archivos comunes: `SecurityConfig` (rutas públicas nuevas) y `application.yml` (bloque `wamma.crm` nuevo y separado). La numeración de migraciones se resuelve al mezclar |
| C2 (retención) sigue abierta | Nada se borra. Cuando haya política, será una tarea programada |
| C6 (avisar al cliente) sigue abierta | El módulo no notifica. La confirmación va por el `mailto:` del asesor, como hoy |

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
