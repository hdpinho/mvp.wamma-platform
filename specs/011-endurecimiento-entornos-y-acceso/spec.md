# 011 · Endurecimiento de entornos, acceso a datos y desacople del proveedor

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.: 1** · **Septiembre 2026**
**Pilar Kavak:** — (transversal: habilita los demás)
**Depende de:** 001 (roles, sesiones, bitácora), 005 (vitrina y parámetros de financiamiento)
**Estado:** **Borrador — pendiente de aprobación del Product Owner.** No se implementa nada de este spec hasta su aprobación (Principio VII).

> Spec del QUÉ y el POR QUÉ. El CÓMO detallado irá a `./plan.md` **después** de aprobado.
> Principios en `../../.specify/memory/constitution.md`.
>
> **Nota de formato:** por pedido expreso del PO, cada corrección incluye aquí sus *archivos afectados*, *riesgo* y *cómo se prueba*. Es detalle que normalmente vive en `plan.md`; se adelanta para que la aprobación se dé con el costo y el riesgo a la vista.

## 1. Objetivo

Corregir cinco defectos de configuración, acoplamiento y control de acceso detectados en la auditoría de solo lectura del 19/09/2026, **antes** de diseñar cualquier migración a AWS. Ninguno es un cambio de funcionalidad: los cinco reducen riesgo operativo hoy y eliminan ataduras a Supabase que encarecerían la migración.

## 2. Por qué importa

Tres de los cinco hallazgos son riesgos vivos con el despliegue actual, no problemas futuros:

- Cualquier máquina de desarrollo con las variables de entorno cargadas **migra el esquema de producción** al arrancar el backend. Sin confirmación y sin distinción de entorno.
- La aplicación se conecta a la base con el **dueño del esquema**, que puede desactivar triggers y alterar tablas. Eso contradice el mínimo privilegio del Principio I y deja sin efecto las protecciones *append-only* del ledger y la bitácora (Principio V), porque quien las instaló puede retirarlas.
- El límite de intentos de ingreso por IP vive **en memoria del proceso** y descansa en una cabecera que, detrás de un balanceador que la **añade** en vez de reemplazarla, el propio atacante controla.

Los otros dos son deuda de portabilidad: una ruta del frontend que habla directo con la API de datos de Supabase (Principio II: "sin servicios propietarios en el camino crítico") y dos columnas que guardan URL completa en vez de clave de objeto.

## 3. Alcance

**Incluye:** los cinco puntos de la sección 6, en ese orden.

**No incluye:**

| Qué | Dónde queda |
|---|---|
| Mapeo de servicios a AWS (ECS/RDS/S3/CloudFront) y su IaC | Trabajo siguiente, una vez cerrado este spec |
| URL firmadas para el contenedor privado de recaudos (D-09) | Módulo 006 / solicitud de crédito, cuando se implementen |
| Reemplazo del estado en memoria por Redis o equivalente | No hace falta: PostgreSQL basta a la escala del MVP |
| Cambiar el proveedor de alojamiento o de base de datos | Decisión posterior; este spec solo elimina lo que la ataría |

## 4. Actores y roles

| Actor | Qué cambia para él |
|---|---|
| Desarrollador | Arranca en local sin poder tocar producción por descuido |
| Operador del despliegue | `render.yaml` declara todas las variables; ninguna falla en silencio |
| Visitante de la vitrina | Nada visible: los parámetros de cuota llegan por el backend |
| Usuario del backoffice | Bloqueo por cuenta con retardo progresivo además del límite por IP |
| Rol Auditoría | La bitácora deja de poder registrar IPs falsificadas |

## 5. Requisitos no funcionales y cumplimiento

- **Principio I** — mínimo privilegio: la aplicación deja de conectarse como dueño del esquema.
- **Principio II** — portabilidad: se elimina la única llamada a una API propietaria en el camino crítico.
- **Principio V** — el ledger es sagrado: las protecciones *append-only* dejan de ser reversibles por el rol de la aplicación.
- **Principio VI** — secretos nunca en el repositorio: la contraseña de `wamma_app` se fija fuera del control de versiones.
- **Ninguna migración edita ni borra asientos.** V0016 solo toca DDL y una política.

---

## 6. Correcciones

### 6.1 Entornos y Flyway (Punto 1)

**Qué cambia**

1. `FLYWAY_ENABLED` pasa a **`false` por defecto**. Solo `render.yaml` lo pone en `true`. Migrar deja de ser el comportamiento implícito y pasa a ser una decisión del entorno.
2. El perfil por defecto pasa de `supabase` a **`local`**. Arrancar sin configurar entorno ya no apunta a la base compartida.
3. Se elimina el respaldo silencioso `jdbc:postgresql://localhost:5432/wamma`: en el perfil `supabase`, `SUPABASE_DB_URL` no tiene valor por defecto.
4. Flyway migra con **credenciales propias y obligatorias** (`FLYWAY_DB_USER` / `FLYWAY_DB_PASSWORD`), sin caer a `SUPABASE_DB_*`.
5. La aplicación se conecta con **`wamma_app`**, sin permisos DDL.

**Cómo accede `wamma_app` a tablas con RLS y sin políticas**

Ya está resuelto en el esquema y conviene dejarlo explícito, porque es la pregunta que decide si este punto es viable: `wamma_app` **se creó con el atributo `BYPASSRLS`** (`V0009:70`). RLS en este proyecto no autoriza nada —la autorización fina vive en Spring Boot—, es una barrera de denegación por defecto para todo rol que no sea el dueño ni la aplicación. Con `BYPASSRLS`, `wamma_app` lee y escribe con normalidad aunque una tabla tenga RLS activo y cero políticas.

Hay dos cosas que verificar antes de activarlo:

- **`GRANT` efectivo sobre tablas creadas después de V0009.** V0009 fija `ALTER DEFAULT PRIVILEGES` (`V0009:75-76`), pero esos privilegios por defecto solo aplican a lo que cree **el mismo rol** que ejecutó el `ALTER`. `parametros_financiamiento` (V0015) y las tablas de V0013–V0014 nacieron después. V0016 debe **re-otorgar explícitamente** sobre todas las tablas del esquema, en vez de confiar en el mecanismo por defecto.
- **`REVOKE` *append-only*.** `wamma_app` no tiene `UPDATE`/`DELETE` sobre `auditoria_evento`, `asiento`, `linea_asiento`, `interaccion`, `etapa_historial`, `fusion_persona` ni `movimiento_inventario` (`V0009:85-88`). Si algún punto del backend intenta actualizar una de ellas, hoy funciona (es el dueño) y **dejará de funcionar**. Hay que confirmarlo por prueba, no por lectura.

> **Riesgo de portabilidad, a registrar:** `CREATE ROLE ... BYPASSRLS` exige que quien lo ejecuta tenga a su vez `BYPASSRLS` o sea superusuario. En Supabase funcionó. En **RDS/Aurora no está garantizado**, porque `rds_superuser` no lo incluye. Alternativa, si el destino lo rechaza: política permisiva explícita por tabla (`CREATE POLICY ... TO wamma_app USING (true) WITH CHECK (true)`), que es equivalente en efecto y portable, a costa de una política por tabla. **No se adopta ahora**, pero el plan debe dejarla escrita para no descubrirlo durante la migración.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `backend/src/main/resources/application.yml` | `profiles.default`, `flyway.enabled`, quitar respaldos de `datasource.url` y de `FLYWAY_DB_*`; bloque nuevo del perfil `local` |
| `backend/src/main/resources/db/migration/V0016__*.sql` | Re-`GRANT` explícito a `wamma_app` sobre todas las tablas y secuencias del esquema |
| `render.yaml` | `FLYWAY_ENABLED: "true"` (ya está), `FLYWAY_DB_USER` y `FLYWAY_DB_PASSWORD` nuevas |
| `backend/.env.example` | Documentar el arranque local y el cambio de usuario (solo nombres, nunca valores) |
| `backend/src/test/java/com/wamma/support/LocalDevServer.java` | Verificar; no debería requerir cambios |
| `docs/` y `backend/README.md` | Procedimiento de activación de `wamma_app` |

**Riesgo del cambio: alto.** Es el punto que puede dejar producción sin arrancar o con la aplicación sin permisos.

- Activar `wamma_app` exige un paso manual fuera del repositorio (`ALTER ROLE wamma_app WITH LOGIN PASSWORD '<secreto>'`) y cambiar `SUPABASE_DB_USER` en Render. Si se hace en el orden equivocado, el backend no conecta.
- Si algún `GRANT` no alcanzó a una tabla creada después de V0009, el fallo aparece **en tiempo de ejecución** sobre esa tabla concreta, no al arrancar.
- Poner `FLYWAY_ENABLED=false` por defecto significa que **un despliegue mal configurado arranca sin migrar** y falla contra un esquema viejo. Se mitiga con una comprobación al arrancar que compare la versión esperada del esquema contra `flyway_schema_history` y **falle cerrado** si no coincide.
- `LocalDevServer` arranca sobre una base vacía: en el perfil `local`, Flyway **sí** debe quedar habilitado, o no habrá esquema.

**Cómo se prueba**

1. Prueba de integración: arrancar con perfil `supabase` sin `SUPABASE_DB_URL` → falla al arrancar con mensaje que nombra la variable. No arranca contra localhost.
2. Prueba de integración: perfil por defecto, sin variables → no se conecta a nada remoto.
3. `LocalDevServer` arranca, aplica V0001–V0016 sobre PostgreSQL embebido y carga el inventario de demostración. Es la prueba de que el perfil `local` no se rompió.
4. **Prueba nueva de privilegios**, la más importante: sobre el PostgreSQL embebido, crear `wamma_app`, conectar la suite de integración **con ese rol** y correr los recorridos de cada módulo. Verifica de una vez el `BYPASSRLS`, los `GRANT` y que ningún `UPDATE`/`DELETE` choque con los *append-only*.
5. Prueba negativa: con `wamma_app`, un `UPDATE` sobre `asiento` y un `ALTER TABLE` deben ser rechazados.
6. Prueba de la comprobación de versión: historial por debajo de la versión esperada → el arranque falla.

---

### 6.2 Parámetros de financiamiento por el backend (Punto 2)

**Qué cambia**

1. Nuevo **`GET /v1/parametros-financiamiento`**, público (sin sesión), que devuelve la fila activa más reciente de `parametros_financiamiento`.
2. Se elimina del frontend la ruta directa a PostgREST y las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. **V0016** elimina la política `parametros_financiamiento_lectura_publica`, **sin editar V0015** (que ya está aplicada).

**Se mantiene, como pidió el PO:** sin valores de respaldo cuando la carga falla (requisito B.5), y los parámetros se cambian en base de datos **sin redesplegar** nada.

> **Hallazgo que este punto arrastra:** el endpoint `/v1/parametros-financiamiento` que el frontend ya invoca como respaldo (`parametrosFinanciamiento.ts:63`) **no existe en el backend**. Y la ruta a Supabase, en producción, la bloquea la CSP de `vercel.json:24`, cuyo `connect-src` no incluye `supabase.co`. Es decir: es probable que el simulador de cuotas **hoy no cargue parámetros en producción**. Esta corrección lo repara, pero conviene confirmarlo en el navegador antes de implementar, para saber si es una reparación o una mejora.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `backend/src/main/java/com/wamma/catalog/` | Controlador, servicio y repositorio del endpoint nuevo |
| `backend/src/main/java/com/wamma/platform/config/SecurityConfig.java:82` | Añadir la ruta a las públicas por GET |
| `backend/src/main/resources/db/migration/V0016__*.sql` | `DROP POLICY parametros_financiamiento_lectura_publica` |
| `frontend-web/src/services/parametrosFinanciamiento.ts` | Eliminar el bloque PostgREST (líneas 25-60); queda solo la ruta del backend |
| `frontend-web/src/vite-env.d.ts` | Quitar las declaraciones `VITE_SUPABASE_*` |
| `frontend-web/src/version.ts`, `frontend-web/src/components/SimuladorCuota.tsx` | Actualizar comentarios que citan Supabase |
| `frontend-web/vercel.json` | `img-src` **se conserva** (las fotos siguen en Supabase Storage); `connect-src` ya es correcto |

**Riesgo del cambio: bajo en el backend, medio en el frontend.**

- El riesgo real es de **despliegue desordenado**: si V0016 retira la política antes de que el frontend nuevo esté publicado, cualquier build viejo que aún tenga las `VITE_SUPABASE_*` incrustadas deja de leer parámetros. Orden obligatorio: **backend primero, frontend después, V0016 al final.**
- La caché de Vercel puede servir el bundle viejo un rato. Con la CSP bloqueando esa ruta de todos modos, el impacto práctico es menor, pero el orden se respeta igual.
- Si la tabla no tiene ninguna fila activa, el endpoint debe responder **error explícito**, no una fila vacía: el frontend no puede inventar valores.

**Cómo se prueba**

1. Prueba de integración del endpoint: con fila activa devuelve los seis campos; con varias filas activas devuelve la de `vigente_desde` más reciente; sin filas activas responde error, no `200` con nulos.
2. Prueba de que la ruta es pública: `GET` sin sesión responde `200`.
3. Prueba de la política: tras V0016, un rol sin `BYPASSRLS` no lee `parametros_financiamiento`.
4. Prueba del frontend (`node --test`): `obtenerParametrosFinanciamiento` con `VITE_API_URL` definida llama al backend; ante error deja `parametros` en `null` y puebla `error`, sin valores de respaldo.
5. Verificación manual: cambiar un parámetro en base de datos y comprobar que la vitrina lo refleja **sin redesplegar**.

---

### 6.3 Ingreso: IP confiable, límite por cuenta y estado en PostgreSQL (Punto 3)

**Qué cambia**

1. **IP resuelta con proxies de confianza configurables por entorno.** Se sustituye `forward-headers-strategy: framework` —que toma el **primer** elemento de `X-Forwarded-For`, el que el cliente controla— por la estrategia `native` de Tomcat con `internal-proxies` configurable. Tomcat recorre la cabecera **de derecha a izquierda** descartando proxies conocidos, que es la semántica correcta cuando el balanceador **añade** en vez de reemplazar. Es exactamente el comportamiento de un ALB de AWS.
2. **Límite por cuenta además de por IP, con retardo progresivo.** El bloqueo por cuenta ya existe (`UserRepository.java:82-85`, `usuario.intentos_fallidos` / `bloqueado_hasta`, atómico). Se le añade un retardo creciente por intento fallido, antes de llegar al bloqueo.
3. **Estado en PostgreSQL.** `LoginRateLimiter` deja el `ConcurrentHashMap` (`LoginRateLimiter.java:25`) y pasa a una tabla `intento_ingreso` creada en V0016, con purga de filas fuera de ventana.
4. **Fallo cerrado si la IP es nula.** Hoy `check()` retorna sin hacer nada cuando la IP es `null` (`LoginRateLimiter.java:35-37`). Pasa a rechazar la petición.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `backend/src/main/resources/application.yml:20` | `forward-headers-strategy` y `server.tomcat.remoteip.internal-proxies` por variable |
| `backend/src/main/java/com/wamma/platform/web/RequestInfo.java:18` | Sin cambio funcional; `getRemoteAddr()` sigue siendo correcto con la estrategia nueva |
| `backend/src/main/java/com/wamma/platform/auth/LoginRateLimiter.java` | Reescritura: estado en base de datos, fallo cerrado, retardo progresivo |
| `backend/src/main/java/com/wamma/platform/config/SecurityProperties.java` | Parámetros del retardo |
| `backend/src/main/resources/db/migration/V0016__*.sql` | Tabla `intento_ingreso` con índice por `(ip, ocurrido_en)` y `GRANT` a `wamma_app` (incluido `DELETE`, que necesita para purgar: **no es tabla append-only**) |
| `render.yaml` | `WAMMA_PROXIES_CONFIABLES` |

**Riesgo del cambio: alto. Es el punto que puede dejar a todo el personal fuera del sistema.**

- Si el rango de proxies de confianza se configura mal en Render, **todas** las peticiones parecerán venir de la misma IP —la del proxy— y el límite de 20 intentos por IP bloqueará el ingreso de todo el backoffice en minutos. Debe validarse contra la IP real que Render presenta, observándola primero en la bitácora.
- El fallo cerrado ante IP nula es correcto, pero hay que confirmar que **ninguna** ruta de ingreso corre fuera de un hilo de petición: `RequestContextHolder` devolvería `null` y el ingreso quedaría roto. `AuthService.java:90` corre en hilo de controlador; hay que verificar que no existan otras.
- Llevar el estado a la base añade una consulta por intento de ingreso. A la escala del MVP es irrelevante; la tabla necesita purga o crecerá sin control.
- El retardo progresivo **ocupa un hilo del servidor** mientras espera. Con pocos hilos en el plan gratuito de Render, un atacante podría agotarlos: el retardo debe tener **tope** y ser corto.

> **[NEEDS CLARIFICATION — D-40] Curva del retardo progresivo.** Faltan por decidir: retardo inicial, factor de crecimiento y tope por intento. Propuesta a aprobar o corregir: 0 s, 1 s, 2 s, 4 s, 8 s, con tope de 8 s, reiniciando al ingresar bien. No se implementa hasta que el PO fije los valores.

**Cómo se prueba**

1. Prueba unitaria de resolución de IP: petición con `X-Forwarded-For: 1.2.3.4, 10.0.0.7` desde un proxy de confianza → la aplicación ve `1.2.3.4`. La misma cabecera desde un origen **no** confiable → se ignora.
2. **Prueba de regresión de la falsificación:** `X-Forwarded-For: 9.9.9.9` enviada por el cliente no debe poder evadir el límite. Esta prueba falla con el código actual; es la que demuestra que el defecto quedó cerrado.
3. Prueba de integración: superar el umbral por IP responde `429`; superar los intentos por cuenta bloquea la cuenta aunque las IPs varíen.
4. Prueba del retardo: los tiempos crecen según la curva aprobada y se reinician tras un ingreso correcto.
5. Prueba de fallo cerrado: sin IP resoluble, el ingreso se rechaza.
6. Prueba de persistencia: el límite **sobrevive al reinicio** del proceso. Es lo que hoy no ocurre.
7. Prueba de purga: las filas fuera de ventana se eliminan y la tabla no crece indefinidamente.

---

### 6.4 `render.yaml`: variables declaradas y sin respaldos silenciosos (Punto 4)

**Qué cambia**

1. Se declaran con `sync: false` las variables que faltan: `WAMMA_S3_ENDPOINT`, `WAMMA_S3_REGION`, `WAMMA_S3_BUCKET`, `WAMMA_S3_ACCESS_KEY`, `WAMMA_S3_SECRET_KEY`, `WAMMA_FOTOS_URL_PUBLICA`, `FLYWAY_DB_USER`, `FLYWAY_DB_PASSWORD`, `WAMMA_PROXIES_CONFIABLES`.
2. **En el perfil `supabase` desaparecen los valores por defecto que fallan en silencio.** Hoy `WAMMA_S3_BUCKET` cae a `vehiculos` y `WAMMA_FOTOS_URL_PUBLICA` cae a `http://localhost:8080/archivos`: el servidor arranca **verde** y sirve URLs de foto inservibles. Pasan a ser obligatorias en ese perfil.
3. **Validación agrupada al arrancar:** un único informe que nombra **todas** las variables faltantes de una vez, al estilo de `CryptoConfig.java:33`, en vez de fallar de una en una.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `render.yaml` | Nueve claves nuevas con `sync: false` y su comentario |
| `backend/src/main/resources/application.yml` | Quitar respaldos en el perfil `supabase` |
| `backend/src/main/java/com/wamma/platform/config/` | Validador de arranque agrupado |
| `backend/src/main/java/com/wamma/inventory/photos/S3PhotoStorage.java:36-42` | Ceder la validación al validador común |
| `backend/.env.example` | Alinear nombres (solo nombres) |

**Riesgo del cambio: medio, y concentrado en un solo momento.**

El primer despliegue tras este cambio **falla al arrancar** si alguna variable no está cargada en el Dashboard de Render. Es el comportamiento buscado —ruidoso en vez de silencioso—, pero exige cargarlas **antes** de desplegar. Como `render.yaml` no puede llevar los valores (son secretos, Principio VI y D-05), el orden es: cargar en el Dashboard, luego desplegar.

> Conviene aprovechar para comprobar si las variables `WAMMA_S3_*` están hoy cargadas en Render. Si no lo están, el almacén S3 lanza al arrancar (`S3PhotoStorage.java:42`) y el servicio no está funcionando; si lo están, solo faltaba declararlas en el blueprint.

**Cómo se prueba**

1. Prueba de integración: perfil `supabase` con el conjunto incompleto → el arranque falla y el mensaje **nombra todas** las que faltan, no solo la primera.
2. Prueba de que ninguna variable del perfil `supabase` conserva un valor por defecto que apunte a `localhost`.
3. Revisión cruzada, automatizable: cada `${VAR}` del perfil `supabase` en `application.yml` está declarada en `render.yaml`. Es la comprobación que habría evitado este hallazgo.
4. Verificación manual tras desplegar: una foto de la vitrina carga desde el dominio de almacenamiento, no desde `localhost`.

---

### 6.5 `evidencia_url` y `archivo_url` pasan a clave de objeto (Punto 5)

**Qué cambia**

En la misma **V0016**, siguiendo el precedente de `V0014:93` (`RENAME COLUMN url TO clave`):

- `inspeccion_punto.evidencia_url` → `evidencia_clave` (`V0003:83`)
- `solicitud_recaudo.archivo_url` → `archivo_clave` (`V0006:42`)

La URL se arma en tiempo de lectura con la configuración vigente, como ya hace `InventoryViews.java:98`. Cambiar de proveedor deja de exigir reescribir filas.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `backend/src/main/resources/db/migration/V0016__*.sql` | Los dos `RENAME COLUMN` |
| `frontend-web/src/components/Imperfecciones.tsx:293`, `frontend-web/src/mocks/imperfecciones.ts:8` | Solo comentarios que citan el nombre viejo |

**Riesgo del cambio: bajo, con una verificación previa obligatoria.**

Ambos módulos (004 y solicitud de crédito) están **sin implementar**: no hay una sola referencia a estas columnas en `backend/src/main/java`. Renombrar no rompe código. Pero el renombrado supone que **las tablas están vacías**.

> **[NEEDS CLARIFICATION — verificación operativa]** Confirmar en Supabase que `inspeccion_punto` y `solicitud_recaudo` no tienen filas. Si las tuvieran, un renombrado a secas dejaría URLs completas en una columna que el código leerá como clave, y las fotos apuntarían a rutas inválidas. En ese caso hace falta además una transformación que recorte el prefijo público, y este punto vuelve a riesgo medio. No pude consultar la base en una revisión de solo lectura del repositorio.

Nota para cuando se implemente el módulo de recaudos: van en contenedor **privado** (D-09), así que `archivo_clave` **no** debe resolverse con `publicUrl()`, sino con URL firmada. Fuera del alcance de este spec, anotado para que no se herede el patrón de las fotos públicas.

**Cómo se prueba**

1. Verificar que ambas tablas están vacías antes de migrar.
2. `LocalDevServer` aplica V0001–V0016 sobre base vacía sin error.
3. Prueba de esquema: tras V0016, las columnas nuevas existen y las viejas no.
4. La suite completa sigue en verde: ninguna consulta nombra las columnas viejas.

---

## 7. Orden de ejecución

El orden importa; no es la numeración del spec por casualidad.

| # | Paso | Por qué aquí |
|---|---|---|
| 1 | 6.4 — declarar variables en `render.yaml` y cargarlas en el Dashboard | Sin esto, cualquier despliegue posterior falla al arrancar |
| 2 | 6.1 — perfiles, Flyway y validación de versión de esquema | Protege producción antes de tocar nada más |
| 3 | 6.2 (backend) — endpoint `/v1/parametros-financiamiento` | Debe existir antes de que el frontend dependa de él |
| 4 | 6.2 (frontend) — quitar PostgREST y `VITE_SUPABASE_*` | Después del backend, nunca antes |
| 5 | 6.3 — ingreso: IP, límites y estado en base | Necesita la tabla de V0016 |
| 6 | **V0016** — `DROP POLICY`, tabla `intento_ingreso`, `GRANT` a `wamma_app`, dos `RENAME COLUMN` (6.5) | Una sola migración, al final |
| 7 | Activar `wamma_app` en producción (paso manual, fuera del repositorio) | Lo último: es lo que menos se puede revertir en caliente |

**Reversión:** los pasos 1–5 se revierten con un despliegue anterior. El paso 6 **no se revierte editando V0016**: haría falta una V0017 compensatoria. El paso 7 se revierte devolviendo `SUPABASE_DB_USER` al dueño del esquema.

## 8. Criterios de aceptación

- **CA-011.1** — Dado un entorno de desarrollo con las variables de producción cargadas, cuando se arranca el backend, entonces Flyway **no** migra, porque `FLYWAY_ENABLED` es `false` salvo que el entorno lo active.
- **CA-011.2** — Dado el backend en producción, cuando se conecta a la base, entonces lo hace con `wamma_app`, que no puede ejecutar DDL ni `UPDATE`/`DELETE` sobre las tablas *append-only*.
- **CA-011.3** — Dado el frontend desplegado, cuando carga los parámetros de financiamiento, entonces la única petición sale al backend de WAMMA; no hay tráfico a `supabase.co` salvo imágenes.
- **CA-011.4** — Dado un parámetro cambiado en base de datos, cuando se recarga la vitrina, entonces muestra el valor nuevo **sin redespliegue**; y si la carga falla, no muestra cuota alguna.
- **CA-011.5** — Dado un cliente que envía `X-Forwarded-For` falsificada, cuando intenta ingresar repetidamente, entonces el límite lo detiene igual, y la bitácora registra su IP real.
- **CA-011.6** — Dado un reinicio del proceso, cuando se reanudan los intentos de ingreso, entonces el límite conserva la cuenta previa.
- **CA-011.7** — Dado el perfil `supabase` con una variable faltante, cuando arranca el servidor, entonces falla y nombra **todas** las faltantes; ninguna cae a un valor por defecto que apunte a `localhost`.
- **CA-011.8** — Dada la base tras V0016, cuando se inspecciona el esquema, entonces `evidencia_clave` y `archivo_clave` existen, `parametros_financiamiento` no tiene políticas, y `intento_ingreso` sí.

## 9. Preguntas abiertas

| # | Pregunta | Bloquea |
|---|---|---|
| P-1 | **D-40:** curva del retardo progresivo (inicial, factor, tope). Propuesta: 0/1/2/4/8 s, tope 8 s | 6.3 |
| P-2 | ¿`inspeccion_punto` y `solicitud_recaudo` están vacías en Supabase? | 6.5 |
| P-3 | ¿`PARAMETROS_APROBADOS` sobrevive como modo maqueta sin servidor, o se elimina? Hoy convive con "sin valores de respaldo" porque solo actúa sin ninguna variable configurada | 6.2 |
| P-4 | ¿Las `WAMMA_S3_*` están hoy cargadas en el Dashboard de Render? Decide si 6.4 repara o solo formaliza | 6.4 |
| P-5 | Rango real de proxies de Render para `WAMMA_PROXIES_CONFIABLES`. Se obtiene observando la bitácora antes de activar el cambio | 6.3 |

P-1 y P-2 **bloquean implementación** de sus puntos (Principio VII). P-3, P-4 y P-5 se resuelven durante el trabajo sin detenerlo.

## 10. Trazabilidad

| Origen | Destino |
|---|---|
| Constitución, Principio I (mínimo privilegio) | 6.1 |
| Constitución, Principio II (portabilidad) | 6.2, 6.5 |
| Constitución, Principio V (ledger sagrado) | 6.1 (`REVOKE` append-only ya no reversible por la aplicación) |
| Constitución, Principio VI (secretos, mínimo privilegio) | 6.1, 6.3, 6.4 |
| D-05 (secretos en variables de Render) | 6.4 |
| D-09 (almacén compatible con S3; recaudos privados) | 6.5 |
| D-26 (parámetros financieros) | 6.2 |
| Auditoría de solo lectura del 19/09/2026 | Los cinco puntos |

---
*WAMMA · Confidencial · Rev. 1 · Borrador pendiente de aprobación · No constituye asesoría legal ni financiera.*
