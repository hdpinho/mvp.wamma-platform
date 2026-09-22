# 010 · Desglose de tareas — Etapa 3: seguimiento comercial en el servidor

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 2 · **Septiembre 2026**
**Referencias:** `./spec.md` Rev. 2 (QUÉ) · `./plan.md` Rev. 2 (CÓMO) · D-48
**Estado:** **Aprobado** por el Product Owner el 21 de septiembre de 2026 (D-48). Backend en **Spring Boot (Java 21)**, paquete `com.wamma.crm`

> Tareas ordenadas por dependencia. Cada una declara cómo se verifica. Todo se construye y se prueba **en local**, contra el PostgreSQL embebido. Supabase, Render y Vercel no se tocan en esta etapa (plan §11).
>
> La Rev. 1, escrita para Go, queda en el historial de Git. Sus olas 1 y 2 (núcleo y maqueta) se completaron el 10/09/2026 y sus pantallas son la base de la ola F.

---

## 0. Puerta de entrada

| Bloqueante | Bloquea | Estado |
|---|---|---|
| Plan y spec Rev. 2 | Todo | **Cerrado** (D-48) |
| Aprobación de estas tareas | Todo | **Cerrado** (21/09/2026) |
| C3, C8, C9, C10 y C11 | C4, C5, C6, D3, F3 | **Cerrados** (D-48) |
| C2: retención | Nada de esta etapa | Abierta: nada se borra |
| C6: avisar al cliente | Nada de esta etapa | Abierta: solo el `mailto:` del asesor |
| Módulos 001 y 005 en el servidor | Todo | **Hechos** (etapas 1 y 2) |

---

## Ola A · Núcleo puro (`crm.domain`, sin Spring ni base)

### A1 — Etapas, motivos y transiciones
`Stage`, `LossReason` y `TransitionRules`, con la tabla de `plan.md` §4: avance, cierre con motivo (`otro` exige texto), retroceso con nota y etapas terminales.
**Verifica:** **100 % de ramas**. CA-010.2, CA-010.3 y CA-010.10. Los mismos casos que `evaluarTransicion` del frontend.

### A2 — Normalización
`CedulaNormalizer` y `PhoneNormalizer` (E.164 venezolano).
**Verifica:** **100 % de ramas**. Cédula con puntos, guiones, espacios y letra en minúscula. `0414…`, `414…`, `58414…` y `+58414…` dan el mismo número. Se rechazan los valores vacíos y los que no son venezolanos. Mismos casos que `normalizarTelefono` del frontend.

### A3 — Métricas
`FunnelMetrics` sobre filas ya leídas: conversión entre etapas, tiempo en etapa y estancadas por umbral.
**Verifica:** **100 % de ramas**. CA-010.9. Una oportunidad viva cuenta el tiempo hasta ahora.

### A4 — Plazos y enlace
- Vencimiento de la reserva (24 h) y del enlace (7 días), calculados con `Clock`.
- Generación del token (32 bytes aleatorios, Base64 URL) y su SHA-256.

**Verifica:** límites exactos del vencimiento; el token nunca se repite en 10.000 generaciones; su hash tiene 64 caracteres hexadecimales.

### A5 — Reglas de arquitectura y cobertura
ArchUnit (dependencia de pruebas) y JaCoCo (plugin), con umbral del 100 % de ramas solo sobre `com.wamma.crm.domain`.
**Verifica:** la prueba falla si `inventory` importa `crm` o si `crm.domain` importa Spring o JDBC. `mvn verify` falla si baja la cobertura del dominio.

---

## Ola B · Datos

### B1 — Migración V0017
Los cambios de `plan.md` §3:
- `oportunidad.moneda` en EUR y VES;
- `cita_inspeccion.reserva_vence_en`, con su índice parcial.

**Verifica:**
- si hay oportunidades en USD, la migración falla con un mensaje claro;
- pruebas nuevas en `pruebas-esquema.sql`;
- desde cero en local y en la CI;
- no toca `flyway_schema_history`.

### B2 — Repositorios JDBC
Persona (con sus teléfonos cifrados e índices ciegos), oportunidad, cita, interacción, historial de etapas y fusión.
**Verifica:** las pruebas de integración ejecutan cada consulta contra el esquema real.

---

## Ola C · Servicios

### C1 — Resolución de identidad
`IdentityResolver`: por cédula, por cualquier teléfono o nueva, con `ON CONFLICT DO NOTHING` y relectura (`plan.md` §5).
**Verifica:**
- **CA-010.1** con **dos hilos concurrentes** que insertan la misma cédula: queda una sola persona;
- **CA-010.11**: consulta directa a la base sin ninguna cédula, teléfono ni correo en claro.

### C2 — Confirmación, consolidación y fusión
Al confirmar, la cédula se adjunta o se fusiona. La fusión reasigna oportunidades, citas, teléfonos e interacciones, conserva la copia en `fusion_persona` y deja la absorbida en `fusionado`, todo en una transacción.
**Verifica:**
- una cédula ya existente produce la fusión sin perder ningún teléfono;
- el principal pasa a ser el de la cita más reciente;
- la bitácora registra `persona.fusionada` con el criterio;
- un fallo a mitad de la operación no deja nada a medias.

### C3 — Transiciones con efecto en el inventario
Cambio de etapa, historial y bitácora en una transacción, con `version`. El efecto en el inventario pasa por el servicio de `inventory`.
**Verifica:**
- CA-010.5 y CA-010.6;
- el cierre perdido **no** libera un vehículo que otra oportunidad abierta reclama;
- el intento inválido queda en la bitácora;
- dos cambios con la misma versión: el segundo recibe 409.

### C4 — Captación pública
`AppointmentService.schedule`:
- validación y vehículo disponible en la vitrina;
- persona por teléfono y oportunidad nueva o reutilizada;
- cita pendiente;
- reserva de 24 h con un `UPDATE … WHERE estado = 'exhibicion'` atómico.

`CaptureRateLimiter`: 5 citas por IP y 2 por teléfono cada 24 h, en memoria.
**Verifica:**
- dos citas simultáneas al mismo vehículo producen una sola reserva y un 409;
- un doble envío no duplica;
- la sexta cita desde la misma IP y la tercera con el mismo teléfono reciben 429;
- la respuesta no incluye datos personales.

### C5 — Vencimiento de la reserva
Tarea `@Scheduled` cada 15 minutos (y `@EnableScheduling`). La vitrina también aplica el vencimiento al leer la disponibilidad.
**Verifica:**
- con el reloj adelantado 24 h, el vehículo vuelve a disponible, la cita sigue pendiente sin reserva y queda `cita.reserva_vencida`;
- una cita confirmada no vence;
- con la tarea detenida, la vitrina ya muestra el vehículo disponible.

### C6 — Venta y enlace de financiamiento
- **Contado:** `cerrado_ganado` y el vehículo vendido.
- **Financiamiento:** `negociacion` y emisión del enlace (hash, emisión y vencimiento a 7 días). Reemitirlo invalida el anterior.
- La validación del enlace no consume su uso: eso es de la etapa 4.

**Verifica:**
- el token vuelve una sola vez y en la base solo está su hash;
- un enlace vencido o reemplazado no es válido;
- «Vender» sin asistencia previa devuelve 422.

### C7 — Interacciones
Alta append-only con `Idempotency-Key`, oportunidad opcional y corrección que referencia la anterior.
**Verifica:**
- un reintento con la misma clave devuelve la misma interacción;
- **CA-010.4**: con `SET ROLE wamma_app`, `UPDATE`, `DELETE` y `TRUNCATE` sobre `interaccion` y `etapa_historial` fallan por privilegio.

### C8 — Métricas en la base
La consulta de `plan.md` §9, sin caché.
**Verifica:** coincide con A3 sobre los mismos datos; **< 500 ms con 5.000 oportunidades abiertas** sintéticas.

---

## Ola D · API

### D1 — Rutas públicas
`POST /v1/citas` y `GET /v1/enlaces-financiamiento/{token}`, abiertas en `SecurityConfig`.
**Verifica:** sin sesión funcionan; con datos inválidos, 422 en formato Problem Details; ninguna devuelve datos personales.

### D2 — Bandeja de citas
Listado, confirmación, descarte y asistencia.
**Verifica:** el asesor ve las citas de sus oportunidades y las sin dueño; el coordinador ve todas.

### D3 — Oportunidades
Listado por cursor, etapa con `If-Match`, asesor (asignar o tomar sin dueño), próxima acción y venta.
**Verifica:**
- **CA-010.8**;
- una oportunidad ajena devuelve 404 y queda en la bitácora;
- el asesor no puede quitarle una oportunidad a otro (403);
- dos `PATCH` concurrentes: el segundo recibe 409.

### D4 — Personas e interacciones
Búsqueda (nombre en texto; cédula y teléfono por índice ciego), ficha 360 y alta de interacción.
**Verifica:** **CA-010.7**: ninguna respuesta del CRM tiene campos financieros; la búsqueda por cédula funciona sin descifrar.

### D5 — Métricas y catálogos
`GET /v1/crm/metricas/embudo` (`crm.ver_todas`) y `GET /v1/crm/catalogos`.
**Verifica:** el asesor recibe 403 en las métricas; los catálogos coinciden con los sembrados en V0010.

---

## Ola E · Datos de desarrollo

### E1 — Siembra local
`LocalDevServer` crea asesores y coordinador ficticios, y algunas personas y citas de ejemplo, **solo** en el PostgreSQL embebido.
**Verifica:** nada de esto corre con el perfil `supabase`.

---

## Ola F · Frontend

### F1 — Clientes de la API
`api/citas.ts` (público) y `api/crm.ts` (backoffice), con los tipos de los contratos.
**Verifica:** `tsc -b` limpio.

### F2 — Contexto del CRM con dos modos
`state/crm.tsx`: con servidor y sesión, lee y escribe en la API, con operaciones asíncronas y errores visibles; sin servidor, queda la maqueta.
**Verifica:** las pantallas no cambian de forma. Si alguna cambia, se documenta por qué.

### F3 — Agendar cita
`ModalAgendarCita` envía a `POST /v1/citas`, muestra el 409 y el 429 y reintenta una vez si el servidor está dormido. Se retira el rango de ingresos, también en la maqueta.
**Verifica:** el mensaje correcto en cada caso; tras agendar, la ficha muestra «Con cita».

### F4 — Bandeja
`O3_GestionCitas`: confirmar (pide la cédula), descartar, asistió, vender (contado o financiamiento) y registrar interacción tras WhatsApp. El enlace se muestra una vez, con «Copiar».
**Verifica:** registrar una interacción sigue costando un clic y la nota (`plan.md` Rev. 1 §7.4).

### F5 — Embudo, personas y ficha
`O7_*` con datos del servidor. En el embudo, filtro por asesor y «Tomar» en las sin dueño.
**Verifica:** el asesor no ve oportunidades ajenas; el coordinador sí, con el filtro.

### F6 — Enlace en la solicitud
`C9` valida el enlace contra el servidor. El resto de la solicitud sigue en la maqueta hasta la etapa 4.
**Verifica:** un enlace válido abre la solicitud con el vehículo; uno vencido o reemplazado lo explica.

### F7 — Calidad
**Verifica:** `tsc -b`, `npm run lint` y `npm run test` en verde.

---

## Ola G · Verificación y cierre de la etapa

### G1 — Recorrido en navegador
Playwright, contra el backend local:
1. agendar;
2. «Con cita» en la vitrina;
3. confirmar con una cédula ya existente (fusión);
4. asistió;
5. vender con financiamiento;
6. el enlace abre la solicitud;
7. un descarte libera el vehículo.

**Verifica:** todo pasa, sin errores de consola ni de CSP.

### G2 — Manual de usuario (D-20)
Capítulo 03 al día, con capturas del recorrido: lo que hace, quién lo usa, paso a paso, reglas y mensajes.
**Verifica:** describe lo que la plataforma hace de verdad; lo que sigue en la maqueta queda marcado.

### G3 — Documentación técnica
- `data-model.md` y `database-schema-design.md` con V0017;
- el spec de `solicitud-credito`, con el insumo D15 cerrado (`lead_id` = `oportunidad.id`);
- este archivo, con el avance.

**Verifica:** ningún documento contradice lo construido.

---

## Criterio de «terminado» de la etapa

Además del criterio general de `../000-overview/tasks-build-order.md` §3:

1. Pasan los once criterios de aceptación del spec §11.
2. `crm.domain` tiene **100 % de ramas** (JaCoCo).
3. Pasan las tres pruebas irrenunciables: la carrera de la deduplicación, la inmutabilidad frente al rol de aplicación y el aislamiento del expediente de crédito.
4. Pasa el recorrido de G1 y el manual está al día (G2).
5. **No se despliega:** el paso a Supabase, Render y Vercel es la etapa 5 y se decide con el PO (`plan.md` §11).

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
