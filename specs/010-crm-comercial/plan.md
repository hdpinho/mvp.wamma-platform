# 010 · Plan técnico — Seguimiento comercial de prospectos

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Septiembre 2026**
**Spec de referencia:** `./spec.md`
**Estado:** **Aprobado** por el Product Owner (septiembre 2026)

> El QUÉ está en `spec.md`. Aquí va el **CÓMO**: encaje arquitectónico, modelo físico, máquina de estados, contratos y estrategia de pruebas. `../000-overview/architecture-plan.md` manda sobre las decisiones transversales.

---

## 1. Supuestos adoptados

| # | Punto | Decisión | Reversibilidad |
|---|---|---|---|
| S1 | **Alcance del módulo** | Capa propia y ligera dentro de la plataforma. **No** se integra ni se compra un CRM externo en esta fase | Los datos quedan normalizados (una persona por cédula), que es justo lo que un CRM externo necesitaría para importar |
| S2 | **Canal de contacto** | Enlaces `wa.me`, como ya hace el backoffice. Sin WhatsApp Business API | El registro de interacción es manual; migrar a la API de Meta añadiría el registro automático sin cambiar el modelo |
| S3 | **Identidad del asesor** | `asesor_id` es FK a `usuario` (módulo 001). Mientras 001 no exista, el campo es **nulo** y la interfaz muestra "sin asignar" | Al llegar 001, se puebla. Ningún dato se pierde |
| S4 | **Moneda del valor estimado** | USD con equivalencia BCV, reusando el tipo `Dinero` de `internal/creditapp/calc` (Principio V) | Ya es multi-moneda por construcción |
| S5 | **Etapas del embudo** | Las siete de `spec.md` §8.1, en tabla de parámetros, **no** en un `ENUM` de código | Añadir o renombrar una etapa es una fila, no un despliegue |
| S6 | **Reapertura** | Prohibida. Retomar contacto crea una oportunidad nueva | Es lo que mantiene honestas las métricas del embudo |

---

## 2. Encaje en la arquitectura

Stack heredado sin cambios: **Go** (monolito modular), **PostgreSQL**, **Redis**, **React**, API `/v1`.

### 2.1 Paquete propio y dirección de las dependencias

```
backend/internal/
├── platform/      # auth, RBAC, auditoría, cifrado (001)   ← dependencia transversal
├── catalog/       # vehículo publicado (005)
├── crm/           # ◄ NUEVO — persona, oportunidad, embudo
├── creditapp/     # captación de solicitudes de crédito
└── risk/          # scoring, AML, decisión (006)
```

Dependencias permitidas:

```
crm      →  catalog     (lee el vehículo, escribe su disponibilidad)
crm      →  platform    (identidad, auditoría, cifrado)
creditapp →  crm        (resuelve la persona, obtiene el lead_id)
```

**Prohibida: `crm → creditapp`.** Es la traducción a límite de compilación de la regla de negocio de `spec.md` §8.3: la capa comercial no puede alcanzar el expediente financiero ni por descuido. Si mañana alguien escribe ese `import`, no compila. Es el mismo argumento que sostiene la separación `creditapp`/`risk` en `../solicitud-credito/plan.md` §2.1.

Para que `creditapp` conozca el estado de la solicitud sin invertir la dependencia, `crm` **publica una interfaz** que `creditapp` implementa:

```go
// crm/domain: lo que la capa comercial necesita saber de una solicitud.
// Deliberadamente pobre: estado y nada más.
type EstadoSolicitud interface {
    EstadoDe(ctx context.Context, solicitudID uuid.UUID) (string, error)
}
```

El asesor ve "solicitud en análisis". No ve el balance del cliente porque **la interfaz no lo expone**, no porque un `if` lo filtre.

### 2.2 Organización interna

```
internal/crm/
├── domain/          # persona, oportunidad, etapas, máquina de estados — sin I/O
├── dedup/           # normalización e índice ciego para deduplicar
├── metrics/         # cálculo del embudo (consultas puras sobre filas ya leídas)
├── store/           # repositorios PostgreSQL
└── http/            # handlers /v1/crm
```

`domain/`, `dedup/` y `metrics/` no importan infraestructura: son puros y por tanto exhaustivamente testeables. Ahí es donde se exige la cobertura alta (§9).

### 2.3 Camino de la maqueta (antes del backend)

El backend de este módulo **depende del 001**, que no existe. Para no quedar bloqueado, el modelo se valida primero en el frontend:

1. Se implementan `persona`, `oportunidad` e `interaccion` en un contexto de React con persistencia local, exactamente con la forma que tendrán las tablas.
2. El equipo comercial usa la maqueta con datos simulados y se corrigen las etapas y los motivos de pérdida **antes** de escribir una migración.
3. Cuando llegue el backend, el contrato ya está probado contra uso real y el frontend solo cambia de fuente de datos.

Es deliberado: los catálogos de etapas y motivos son la parte del diseño que más se equivoca en la primera pasada, y corregirlos en una maqueta cuesta minutos.

---

## 3. Modelo físico

Migraciones Flyway en `backend/src/main/resources/db/migration/`. El modelo base llegó en V0004 y quedó alineado con este plan en V0009–V0012 (septiembre 2026). Los nombres de tabla son singulares, como en el resto del esquema (`../000-overview/database-schema-design.md`).

### 3.1 Convenciones

- **Identificadores:** UUID. La base genera v4 (`gen_random_uuid()`); la aplicación puede asignar v7, ordenable por tiempo, cuando le convenga.
- **Dinero:** `NUMERIC(18,2)` + `moneda VARCHAR(3)` (`USD`/`VES`) + `tasa_bcv NUMERIC(18,8)` + `fecha_tasa DATE`. **Prohibido `float`** (Principio V).
- **Auditoría de fila:** `creado_en`, `creado_por`, `actualizado_en`.
- **Cifrado de campo:** `cedula`, `telefono_whatsapp` y `correo` como `BYTEA` con sobre cifrado vía `platform/crypto`.
- **Índice ciego:** columna `indice_ciego_<campo>` con HMAC-SHA256 determinista y clave separada, para deduplicar sin descifrar.

### 3.2 Tablas

| Tabla | Notas de implementación |
|---|---|
| `persona` | `indice_ciego_cedula` único (admite nulos: la cédula llega en el segundo paso, §5.1). `canal_origen` como texto trazado, sin lista cerrada. `criterio_resolucion` registra si la identidad se resolvió por cédula, por teléfono o es nueva (§5) |
| `persona_telefono` | Un teléfono por fila: `persona_id`, `telefono_cifrado`, `indice_ciego_telefono`, `es_principal` (como mucho uno por persona). Así la deduplicación busca por **cualquiera** de los teléfonos de una persona con un índice (§5.1) |
| `fusion_persona` | **Append-only**, con el tratamiento de §3.3. Sobreviviente, absorbida (queda en estado `fusionado`; no se borra), copia íntegra del registro absorbido con sus datos personales ya cifrados, ids reasignados y momento. Es lo que hace reversible una fusión (§5.1) |
| `oportunidad` | FK a `persona` y `vehiculo`. `etapa` referencia `catalogo_etapa.codigo`. `motivo_perdida` con `CHECK`: obligatorio si y solo si `etapa = 'cerrado_perdido'`. Puntero `solicitud_credito_id` sin unión de datos. Enlace de financiamiento como hash SHA-256 con emisión, vencimiento y uso único. `version` para el `If-Match` de §6. Índices en `(etapa, asesor_id)` y `(persona_id)` |
| `interaccion` | **Append-only.** `corrige_interaccion_id` autorreferencial y nulo. `idempotency_key` única (§6). Índice en `(persona_id, ocurrido_en DESC)` |
| `etapa_historial` | **Append-only.** `oportunidad_id`, `etapa_anterior`, `etapa_nueva` (códigos del catálogo), `nota`, `actor_id`, `creado_en`. Índice en `(oportunidad_id, creado_en)` |
| `cita_inspeccion` | Evento dentro de una oportunidad (§7.1): `oportunidad_id`, `dia_preferido`, `franja` (`manana`/`tarde`), `estado` (`pendiente`/`confirmada`/`descartada`) |
| `catalogo_etapa` | Código, nombre, orden, `es_terminal`, `umbral_estancada_dias` (`spec.md` §8.6; nulo en las terminales). Se siembra con las siete etapas de `spec.md` §8.1 |
| `catalogo_motivo_perdida` | Código, nombre, `exige_texto`. Se siembra con el catálogo de `spec.md` §8.2 |

### 3.3 Inmutabilidad real, no por convención

`interaccion` y `etapa_historial`, como toda tabla append-only del esquema, reciben tres barreras (V0009):

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON interaccion, etapa_historial FROM wamma_app;
CREATE TRIGGER trg_interaccion_inmutable
  BEFORE UPDATE OR DELETE ON interaccion
  FOR EACH ROW EXECUTE FUNCTION prevenir_modificacion_inmutable();
CREATE TRIGGER trg_interaccion_sin_truncate
  BEFORE TRUNCATE ON interaccion
  FOR EACH STATEMENT EXECUTE FUNCTION prevenir_modificacion_inmutable();
```

El `REVOKE` protege del error honesto; el *trigger* de fila, de una conexión con privilegios de más; el de sentencia cubre `TRUNCATE`, que los de fila no ven. Una nota de seguimiento es la clase de dato que alguien querrá "arreglar" cuando una venta se caiga y haya que explicar por qué — y ese es exactamente el momento en que debe ser inmutable.

`CA-010.4` verifica esto con **prueba de integración obligatoria**: sin base de datos real, la prueba no demuestra nada.

### 3.4 Por qué `etapa_historial` es una tabla aparte

Es la única entidad que añado sobre lo estrictamente descrito, y tiene una razón concreta: sin historial de transiciones, "tiempo medio en etapa" y "conversión entre etapas" **no se pueden calcular** — solo se conoce la foto actual del embudo, que es justo lo que no sirve para decidir.

Se consideró registrarlas como `interacciones` con canal `sistema`. Se descartó: mezcla el registro de contacto humano con la traza de la máquina de estados, y obliga a filtrar por canal en toda consulta de ambas. Cinco columnas separadas cuestan menos que ese acoplamiento.

---

## 4. Máquina de estados

Tabla de transiciones, validada por origen **y** por actor (mismo criterio que `../solicitud-credito/plan.md` §5).

| Desde | Hacia | Condición |
|---|---|---|
| `nuevo` | `contactado`, `cita_confirmada`, `visito`, `negociacion`, `cerrado_ganado` | Avance libre |
| `contactado` | `cita_confirmada`, `visito`, `negociacion`, `cerrado_ganado` | Avance libre |
| `cita_confirmada` | `visito`, `negociacion`, `cerrado_ganado` | Avance libre |
| `visito` | `negociacion`, `cerrado_ganado` | Avance libre |
| `negociacion` | `cerrado_ganado` | Avance libre |
| *cualquiera abierta* | `cerrado_perdido` | **Exige motivo** del catálogo |
| *cualquiera abierta* | *cualquier etapa anterior* | **Exige nota** no vacía |
| `cerrado_ganado`, `cerrado_perdido` | — | **Terminal.** Ninguna transición |

Toda transición, válida o no:

1. Se valida contra esta tabla en `domain/` (sin I/O, por tanto testeable al 100 %).
2. Si es válida, escribe `etapa_historial` **en la misma transacción** que el cambio de `oportunidades.etapa`. No hay ventana en que la etapa cambie sin quedar registrada.
3. Si es inválida, se rechaza y se registra el intento en la auditoría del módulo 001 (`CA-010.3`).

**Efectos laterales sobre el inventario** (RF-010.12), en la misma transacción:

| Transición | Efecto en `vehiculo.estado` |
|---|---|
| → `cerrado_ganado` | `vendido` |
| → `cerrado_perdido` | `disponible`, **solo si** ninguna otra oportunidad abierta lo reclama |

Esa última condición importa: si dos personas negocian el mismo auto y una se cae, el vehículo **no** vuelve a disponible mientras la otra siga viva.

---

## 5. Deduplicación

El algoritmo, en `dedup/` (puro):

1. **Normalizar** la cédula (quitar puntos, guiones y espacios; mayúscula en la letra) y el teléfono a formato E.164 venezolano (`0414…` → `+58414…`, reusando la lógica que ya vive en `O3_GestionCitas.tsx`).
2. **Buscar por `cedula_bidx`.** Si hay coincidencia, es la misma persona.
3. Si no hay cédula, **buscar por `telefono_bidx`**. Si hay coincidencia, es la misma persona *probable*: se reutiliza y se registra el criterio usado.
4. Si no hay coincidencia, crear.

**La condición de carrera es real y se resuelve en la base, no en la aplicación.** Dos citas simultáneas con la misma cédula pasarían ambas el paso 2 antes de que cualquiera inserte. La inserción usa:

```sql
INSERT INTO personas (...) VALUES (...)
ON CONFLICT (cedula_bidx) DO NOTHING
RETURNING id;
```

Si no devuelve fila, se relee por `cedula_bidx`. El índice único parcial es lo que garantiza `CA-010.1`; el chequeo previo es solo una optimización.

Se registra **qué criterio** resolvió la deduplicación (cédula o teléfono). Una fusión por teléfono puede ser errónea —un teléfono familiar compartido— y hay que poder auditarla y deshacerla.

### 5.1 Consolidación al llegar la cédula (decisión C1)

Con la captura en dos pasos, la persona nace resuelta **por teléfono** y la cédula llega después, al confirmar la cita. Ese momento tiene tres desenlaces:

| Situación | Acción |
|---|---|
| La cédula no existe en ninguna otra persona | Se adjunta a la persona actual |
| La cédula ya existe en **otra** persona | **Fusión**: las dos son la misma gente. Sobrevive la más antigua; las oportunidades, citas e interacciones de la otra se reasignan. **Ningún dato se descarta** (ver abajo) |
| La cédula ya está en **esta** persona | Nada que hacer |

La fusión es la operación delicada del módulo: mueve historial entre registros. Va en **una transacción**, deja traza del origen y del destino, y es la razón por la que §5 exige guardar el criterio de deduplicación — sin él no se puede revisar una fusión dudosa.

#### Qué se conserva en una fusión (corregido en septiembre 2026)

La primera implementación en la maqueta eliminaba la persona absorbida y guardaba solo su id. El recorrido en navegador lo detectó: se perdía el teléfono que el cliente dio en esa cita, la fusión no se podía deshacer y, además, el siguiente contacto desde ese teléfono volvía a crear una persona duplicada — la fusión se deshacía sola. La regla vigente:

1. **Todos los teléfonos se conservan.** El principal pasa a ser el de la cita más reciente —si el cliente agendó con un número nuevo, por ahí quiere que lo contacten— y los demás van a `telefonos_adicionales`.
2. **La deduplicación por teléfono mira todos**, no solo el principal. Si no, la fusión se deshace en el próximo contacto.
3. **Se guarda una copia íntegra** del registro absorbido junto con la lista de oportunidades, citas e interacciones que se le reasignaron (`fusion_persona`, append-only). Es lo que permite auditar y revertir. El botón de revertir no está construido en la maqueta; los datos para hacerlo, sí.

---

## 6. Contratos de API

Todos bajo `/v1/crm`, autenticados, con RBAC del módulo 001.

| Método y ruta | Notas |
|---|---|
| `GET /v1/crm/personas?q=` | Busca por nombre, cédula o teléfono. La búsqueda por cédula y teléfono va contra el **índice ciego**, no descifra |
| `GET /v1/crm/personas/{id}` | Ficha 360: persona + oportunidades + interacciones paginadas |
| `POST /v1/crm/personas` | **Idempotente por cédula** (§5) |
| `GET /v1/crm/oportunidades?etapa=&asesor=&estancadas=&cursor=` | Paginación por cursor. Filtrada por RBAC: el asesor solo ve las suyas y las sin asignar (`CA-010.8`) |
| `POST /v1/crm/oportunidades` | Crea sobre una persona resuelta |
| `PATCH /v1/crm/oportunidades/{id}/etapa` | `{etapa, motivo_perdida?, nota?}`. Valida la máquina de estados y aplica los efectos del §4 |
| `PATCH /v1/crm/oportunidades/{id}/asesor` | Asignación y reasignación |
| `POST /v1/crm/oportunidades/{id}/interacciones` | Requiere cabecera `Idempotency-Key`: un reintento de red no debe duplicar una nota en un historial append-only |
| `GET /v1/crm/metricas/embudo?desde=&hasta=` | §8 |

Los `PATCH` de etapa llevan **`If-Match` con la versión de la oportunidad**. Dos asesores moviendo la misma oportunidad a la vez es un escenario cotidiano en un backoffice: el segundo recibe `409` y relee, en vez de sobrescribir en silencio.

---

## 7. Frontend

### 7.1 Refactorización previa: separar el contexto

`frontend-web/src/state/vehiculosContexto.tsx` lleva hoy **221 líneas y tres responsabilidades**: inventario, imperfecciones y citas. Añadirle personas, oportunidades e interacciones lo convertiría en el cajón de sastre del proyecto.

```
state/
├── vehiculosContexto.tsx    # inventario + imperfecciones (se reduce)
└── crmContexto.tsx          # ◄ NUEVO — personas, oportunidades, interacciones, citas
```

Las **citas migran al contexto de CRM**: una cita es un evento dentro de una oportunidad, no un atributo del inventario. El acoplamiento que queda es el bloqueo del vehículo, que se expresa como una llamada explícita entre contextos y no como estado compartido.

### 7.2 Tipos

`CitaSolicitud` deja de cargar los datos de contacto embebidos y gana `personaId` y `oportunidadId`. Los tipos nuevos van a `types/crm.ts`; `types/vehiculo.ts` se queda solo con el vehículo.

**Migración de datos locales:** la maqueta ya tiene citas guardadas con claves `wamma_*_v1`. Al subir de versión se escribe una función que, al arrancar, lee `v1`, agrupa las citas por cédula, crea personas y oportunidades, y guarda `v2`. Es el ensayo en pequeño de la migración real: si no funciona con 20 citas simuladas, tampoco con 2.000 reales.

### 7.3 Pantallas

| Pantalla | Estado | Contenido |
|---|---|---|
| `screens/admin/O7_EmbudoComercial.tsx` | **Nueva** | Tablero por etapa con conteo y monto por columna; filtro por asesor; marca visual de estancadas y de próxima acción vencida |
| `screens/admin/O7_FichaPersona.tsx` | **Nueva** | Ficha 360: datos de contacto, oportunidades (abiertas y cerradas con su motivo) e historial de interacciones |
| `screens/admin/O3_GestionCitas.tsx` | **Modificada** | La tarjeta gana etapa, asesor y próxima acción. Tras pulsar WhatsApp, ofrece registrar la interacción (RF-010.11) |
| `components/ModalAgendarCita.tsx` | **Modificada** | Sin cambio visible para el cliente: al enviar, resuelve o crea la persona y abre la oportunidad |
| `components/admin/AdminLayout.tsx` | **Modificada** | Entradas de navegación para embudo y personas |

Rutas nuevas: `/admin/embudo`, `/admin/personas`, `/admin/personas/:id`.

### 7.4 Registro de interacción con la mínima fricción

Es el punto donde este tipo de módulo se abandona. Si registrar una llamada cuesta seis campos, nadie registra nada y las métricas quedan vacías.

El formulario por defecto trae **canal, dirección y fecha ya rellenados** por el contexto desde el que se abre (pulsar WhatsApp implica canal `whatsapp`, dirección `saliente`, fecha ahora). Queda **un solo campo obligatorio: la nota.** Guardar y cerrar en un clic.

---

## 8. Métricas del embudo

La consulta no obvia es el tiempo en etapa. Se calcula sobre `etapa_historial` con una función de ventana, tomando la diferencia contra la transición siguiente de la misma oportunidad:

```sql
SELECT
  etapa_nueva AS etapa,
  AVG(COALESCE(siguiente_ts, now()) - ts) AS tiempo_medio
FROM (
  SELECT
    oportunidad_id, etapa_nueva, ts,
    LEAD(ts) OVER (PARTITION BY oportunidad_id ORDER BY ts) AS siguiente_ts
  FROM etapa_historial
  WHERE ts >= $1 AND ts < $2
) t
GROUP BY etapa_nueva;
```

`COALESCE(siguiente_ts, now())` es lo que hace que una oportunidad **todavía viva** cuente el tiempo que lleva parada. Sin eso, las estancadas —precisamente las que hay que ver— quedarían fuera del promedio.

La conversión entre etapas consecutivas sale de contar oportunidades distintas que alcanzaron cada etapa en el período. Los resultados se **cachean en Redis** con vencimiento corto: son consultas de tablero, no de transacción.

---

## 9. Estrategia de pruebas

| Objeto | Nivel | Exigencia |
|---|---|---|
| Máquina de estados (`domain/`) | Unitaria, sin I/O | **100 % de ramas.** Toda transición válida e inválida, incluidos los intentos desde estado terminal |
| Deduplicación (`dedup/`) | Unitaria | **100 % de ramas.** Normalización de cédula y teléfono; coincidencia por cédula, por teléfono y sin coincidencia |
| Condición de carrera de deduplicación | Integración | Dos inserciones concurrentes con la misma cédula producen **una** persona (`CA-010.1`) |
| Inmutabilidad append-only | Integración | `UPDATE` y `DELETE` sobre `interacciones` y `etapa_historial` fallan desde el usuario de aplicación (`CA-010.4`) |
| Efectos sobre el inventario | Integración | Cierre ganado/perdido y el caso de la segunda oportunidad viva (§4) |
| Aislamiento del expediente de crédito | Integración | Un asesor no obtiene ningún campo financiero (`CA-010.7`) |
| Métricas | Unitaria sobre datos fijos | Tiempo en etapa con oportunidad viva incluida |

Las tres pruebas de integración obligatorias son las que no pueden simularse: la carrera, la inmutabilidad a nivel de motor y el filtrado por rol. Todo lo demás es puro y rápido.

---

## 10. Insumos ausentes y cómo se aíslan

Mismo criterio que `../solicitud-credito/plan.md` §12: lo que falta va **detrás de un adaptador** o de un catálogo, para que su llegada no toque el dominio.

| Pregunta abierta | Aislamiento mientras no se resuelva |
|---|---|
| ~~**C1**~~ cédula obligatoria | **Cerrada**: captura en dos pasos (`spec.md` §8.5). Exige la consolidación de cédula descrita en §5 |
| **C2** retención | Nada se borra. Cuando haya política, se implementa como tarea programada |
| **C3** reparto de oportunidades | `asesor_id` nulo = sin asignar. El reparto automático sería una capa encima |
| ~~**C4**~~ identidad del asesor | **Cerrada** con el 001 (D-24): `asesor_id` apunta a `usuario`, y el CRM lo llena al pasar al servidor (etapa 3) |
| ~~**C5**~~ umbral de estancada | **Cerrada**: umbral por etapa 2/3/7/7/14 días, en tabla de parámetros y no en código |
| **C6** notificación al cliente | El módulo no notifica. Si se decide que sí, se apoya en el motor de notificaciones del 009 |
| ~~**C7**~~ enmienda constitucional | **Cerrada** en la Constitución v2.0.0 |

---

## 11. Bloqueante de arquitectura

Igual que `creditapp`, este módulo necesita `internal/platform` —cifrado de campo, auditoría, RBAC— para **todo lo que toque persistencia**. Ese paquete es el **módulo 001**, ola 0 del proyecto, y aún no se ha construido.

En concreto, sin el 001 no hay: autor real de una interacción, dueño real de una oportunidad, filtrado por rol (`CA-010.8`), ni cifrado de cédula (`CA-010.11`).

**Lo que sí se puede hacer sin el 001:** todo el §2.3 (validar el modelo en la maqueta) y las olas 1 y 2 de `./tasks.md` (dominio puro y deduplicación), que no tocan I/O.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
