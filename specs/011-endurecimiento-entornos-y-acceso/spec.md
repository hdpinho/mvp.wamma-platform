# 011 · Endurecimiento de entornos, acceso a datos y desacople del proveedor

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.: 2** · **Septiembre 2026**
**Pilar Kavak:** — (transversal: habilita los demás)
**Depende de:** 001 (roles, sesiones, bitácora), 005 (vitrina y parámetros de financiamiento)
**Estado:** **Aprobado** por el Product Owner el 19 de septiembre de 2026, con los ajustes de la Rev. 2 (D-40 a D-43).

> Spec del QUÉ y el POR QUÉ. El CÓMO detallado irá a `./plan.md`.
> Principios en `../../.specify/memory/constitution.md`.
>
> **Nota de formato:** por pedido expreso del PO, cada corrección incluye aquí sus *archivos afectados*, *riesgo* y *cómo se prueba*. Es detalle que normalmente vive en `plan.md`; se adelanta para que la aprobación se dé con el costo y el riesgo a la vista.
>
> **Rev. 2 (aprobación):** resuelve D-40 (retardo sin retener hilos), parte la migración única en **V0016, V0017 y V0018**, añade la convención de migraciones de §6.6, y fija la condición de V0018 sobre datos existentes.

## 1. Objetivo

Corregir cinco defectos de configuración, acoplamiento y control de acceso detectados en la auditoría de solo lectura del 19/09/2026, **antes** de diseñar cualquier migración a AWS. Ninguno es un cambio de funcionalidad: los cinco reducen riesgo operativo hoy y eliminan ataduras a Supabase que encarecerían la migración.

## 2. Por qué importa

Tres de los cinco hallazgos son riesgos vivos con el despliegue actual, no problemas futuros:

- Cualquier máquina de desarrollo con las variables de entorno cargadas **migra el esquema de producción** al arrancar el backend. Sin confirmación y sin distinción de entorno.
- La aplicación se conecta a la base con el **dueño del esquema**, que puede desactivar triggers y alterar tablas. Eso contradice el mínimo privilegio del Principio I y deja sin efecto las protecciones *append-only* del ledger y la bitácora (Principio V), porque quien las instaló puede retirarlas.
- El límite de intentos de ingreso vive **en memoria del proceso** y descansa en una cabecera que, detrás de un balanceador que la **añade** en vez de reemplazarla, controla el propio atacante.

Los otros dos son deuda de portabilidad: una ruta del frontend que habla directo con la API de datos de Supabase (Principio II: "sin servicios propietarios en el camino crítico") y dos columnas que guardan URL completa en vez de clave de objeto.

## 3. Alcance

**Incluye:** los cinco puntos de la sección 6, más la convención de migraciones de §6.6.

**No incluye:**

| Qué | Dónde queda |
|---|---|
| Mapeo de servicios a AWS (ECS/RDS/S3/CloudFront) y su IaC | Trabajo siguiente, una vez cerrado este spec |
| URL firmadas para el contenedor privado de recaudos (D-09) | Módulo 006 / solicitud de crédito, cuando se implementen |
| Reemplazo del estado en memoria por Redis o equivalente | No hace falta: PostgreSQL basta a la escala del MVP |
| Cambiar el proveedor de alojamiento o de base de datos | Decisión posterior; este spec solo elimina lo que la ataría |
| El fallo de `npm run lint` que hoy tiene el CI en rojo en `main` | Ajeno a este spec: corrección de `eslint.config.js` en su propio PR |

## 4. Actores y roles

| Actor | Qué cambia para él |
|---|---|
| Desarrollador | Arranca en local sin poder tocar producción por descuido |
| Operador del despliegue | `render.yaml` declara todas las variables; ninguna falla en silencio |
| Visitante de la vitrina | Nada visible: los parámetros de cuota llegan por el backend |
| Usuario del backoffice | Ante fallos seguidos recibe `429` inmediato con `Retry-After`, no una espera colgada |
| Rol Auditoría | La bitácora deja de poder registrar IPs falsificadas |

## 5. Requisitos no funcionales y cumplimiento

- **Principio I** — mínimo privilegio: la aplicación deja de conectarse como dueño del esquema.
- **Principio II** — portabilidad: se elimina la única llamada a una API propietaria en el camino crítico.
- **Principio V** — el ledger es sagrado: las protecciones *append-only* dejan de ser reversibles por el rol de la aplicación.
- **Principio VI** — secretos nunca en el repositorio: la contraseña de `wamma_app` se fija fuera del control de versiones.
- **Ninguna migración edita ni borra asientos.** V0016–V0018 solo tocan permisos, una política y nombres de columna.

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

- **`GRANT` efectivo sobre tablas creadas después de V0009.** V0009 fija `ALTER DEFAULT PRIVILEGES` (`V0009:75-76`), pero esos privilegios por defecto solo aplican a lo que cree **el mismo rol** que ejecutó el `ALTER`. `parametros_financiamiento` (V0015) y las tablas de V0013–V0014 nacieron después. **V0016** debe re-otorgar explícitamente sobre todas las tablas del esquema, en vez de confiar en el mecanismo por defecto.
- **`REVOKE` *append-only*.** `wamma_app` no tiene `UPDATE`/`DELETE` sobre `auditoria_evento`, `asiento`, `linea_asiento`, `interaccion`, `etapa_historial`, `fusion_persona` ni `movimiento_inventario` (`V0009:85-88`). Si algún punto del backend intenta actualizar una de ellas, hoy funciona (es el dueño) y **dejará de funcionar**. Hay que confirmarlo por prueba, no por lectura.

> **Riesgo de portabilidad, a registrar:** `CREATE ROLE ... BYPASSRLS` exige que quien lo ejecuta tenga a su vez `BYPASSRLS` o sea superusuario. En Supabase funcionó. En **RDS/Aurora no está garantizado**, porque `rds_superuser` no lo incluye. Alternativa, si el destino lo rechaza: política permisiva explícita por tabla (`CREATE POLICY ... TO wamma_app USING (true) WITH CHECK (true)`), equivalente en efecto y portable, a costa de una política por tabla. **No se adopta ahora**, pero el plan debe dejarla escrita para no descubrirlo durante la migración.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `backend/src/main/resources/application.yml` | `profiles.default`, `flyway.enabled`, quitar respaldos de `datasource.url` y de `FLYWAY_DB_*`; bloque nuevo del perfil `local` |
| `backend/src/main/resources/db/migration/V0016__permisos_wamma_app.sql` | Re-`GRANT` explícito sobre todas las tablas y secuencias del esquema |
| `render.yaml` | `FLYWAY_ENABLED: "true"` (ya está), `FLYWAY_DB_USER` y `FLYWAY_DB_PASSWORD` nuevas |
| `backend/.env.example` | Documentar el arranque local y el cambio de usuario (solo nombres, nunca valores) |
| `backend/src/test/java/com/wamma/support/LocalDevServer.java` | Verificar; no debería requerir cambios |
| `docs/` y `backend/README.md` | Procedimiento de activación de `wamma_app` |

**Riesgo del cambio: alto.** Es el punto que puede dejar producción sin arrancar o con la aplicación sin permisos.

- Activar `wamma_app` exige un paso manual fuera del repositorio (`ALTER ROLE wamma_app WITH LOGIN PASSWORD '<secreto>'`) y cambiar `SUPABASE_DB_USER` en Render. Si se hace en el orden equivocado, el backend no conecta.
- Si algún `GRANT` no alcanzó a una tabla creada después de V0009, el fallo aparece **en tiempo de ejecución** sobre esa tabla concreta, no al arrancar. Es justo lo que cierra la prueba universal de §6.6.
- Poner `FLYWAY_ENABLED=false` por defecto significa que **un despliegue mal configurado arranca sin migrar** y falla contra un esquema viejo. Se mitiga con una comprobación al arrancar que compare la versión esperada del esquema contra `flyway_schema_history` y **falle cerrado** si no coincide.
- `LocalDevServer` arranca sobre una base vacía: en el perfil `local`, Flyway **sí** debe quedar habilitado, o no habrá esquema.

**Cómo se prueba**

1. Prueba de integración: arrancar con perfil `supabase` sin `SUPABASE_DB_URL` → falla al arrancar con mensaje que nombra la variable. No arranca contra localhost.
2. Prueba de integración: perfil por defecto, sin variables → no se conecta a nada remoto.
3. `LocalDevServer` arranca, aplica V0001–V0018 sobre PostgreSQL embebido y carga el inventario de demostración. Es la prueba de que el perfil `local` no se rompió.
4. **Prueba nueva de privilegios**, la más importante: sobre el PostgreSQL embebido, crear `wamma_app`, conectar la suite de integración **con ese rol** y correr los recorridos de cada módulo. Verifica de una vez el `BYPASSRLS`, los `GRANT` y que ningún `UPDATE`/`DELETE` choque con los *append-only*.
5. Prueba negativa: con `wamma_app`, un `UPDATE` sobre `asiento` y un `ALTER TABLE` deben ser rechazados.
6. Prueba de la comprobación de versión: historial por debajo de la versión esperada → el arranque falla.

---

### 6.2 Parámetros de financiamiento por el backend (Punto 2)

**Qué cambia**

1. Nuevo **`GET /v1/parametros-financiamiento`**, público (sin sesión), que devuelve la fila activa más reciente de `parametros_financiamiento`.
2. Se elimina del frontend la ruta directa a PostgREST y las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. **V0017** elimina la política `parametros_financiamiento_lectura_publica`, **sin editar V0015** (que ya está aplicada).

**Se mantiene, como pidió el PO:** sin valores de respaldo cuando la carga falla (requisito B.5), y los parámetros se cambian en base de datos **sin redesplegar** nada.

> **Hallazgo que este punto arrastra:** el endpoint `/v1/parametros-financiamiento` que el frontend ya invoca como respaldo (`parametrosFinanciamiento.ts:63`) **no existe en el backend**. Y la ruta a Supabase, en producción, la bloquea la CSP de `vercel.json:24`, cuyo `connect-src` no incluye `supabase.co`. Es decir: es probable que el simulador de cuotas **hoy no cargue parámetros en producción**. Esta corrección lo repara; conviene confirmarlo en el navegador antes de implementar, para saber si es reparación o mejora.
>
> Dato que refuerza la sospecha: `frontend-web/.env.example` **solo declara `VITE_API_URL`**. Las `VITE_SUPABASE_*` nunca se plantillaron, así que o se cargaron a mano en Vercel o nunca estuvieron. Si nunca estuvieron, la ruta a PostgREST jamás se ejecutó y el simulador lleva tiempo sin parámetros.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `backend/src/main/java/com/wamma/catalog/` | Controlador, servicio y repositorio del endpoint nuevo |
| `backend/src/main/java/com/wamma/platform/config/SecurityConfig.java:82` | Añadir la ruta a las públicas por GET |
| `backend/src/main/resources/db/migration/V0017__retiro_politica_publica.sql` | `DROP POLICY parametros_financiamiento_lectura_publica` |
| `frontend-web/src/services/parametrosFinanciamiento.ts` | Eliminar el bloque PostgREST (líneas 25-60); queda solo la ruta del backend |
| `frontend-web/src/vite-env.d.ts` | Quitar las declaraciones `VITE_SUPABASE_*` |
| `frontend-web/.env.example` | **Sin cambios:** solo declara `VITE_API_URL`; las `VITE_SUPABASE_*` nunca se plantillaron |
| `frontend-web/src/version.ts`, `frontend-web/src/components/SimuladorCuota.tsx` | Actualizar comentarios que citan Supabase |
| `frontend-web/vercel.json` | `img-src` **se conserva** (las fotos siguen en Supabase Storage); `connect-src` ya es correcto |

**Riesgo del cambio: bajo en el backend, medio en el frontend.**

- El riesgo real es de **despliegue desordenado**: si V0017 llega antes de que el frontend nuevo esté publicado, cualquier build viejo que aún tenga las `VITE_SUPABASE_*` incrustadas deja de leer parámetros. Ver la regla de §7.
- La caché de Vercel puede servir el bundle viejo un rato. Con la CSP bloqueando esa ruta de todos modos, el impacto práctico es menor, pero el orden se respeta igual.
- Si la tabla no tiene ninguna fila activa, el endpoint debe responder **error explícito**, no una fila vacía: el frontend no puede inventar valores.

**Cómo se prueba**

1. Prueba de integración del endpoint: con fila activa devuelve los seis campos; con varias filas activas devuelve la de `vigente_desde` más reciente; sin filas activas responde error, no `200` con nulos.
2. Prueba de que la ruta es pública: `GET` sin sesión responde `200`.
3. Prueba de la política: tras V0017, un rol sin `BYPASSRLS` no lee `parametros_financiamiento`.
4. Prueba del frontend (`node --test`): `obtenerParametrosFinanciamiento` con `VITE_API_URL` definida llama al backend; ante error deja `parametros` en `null` y puebla `error`, sin valores de respaldo.
5. Verificación manual: cambiar un parámetro en base de datos y comprobar que la vitrina lo refleja **sin redesplegar**.

---

### 6.3 Ingreso: IP confiable, límite por identificador y estado en PostgreSQL (Punto 3)

**Qué cambia**

1. **IP resuelta con proxies de confianza configurables por entorno.** Se sustituye `forward-headers-strategy: framework` —que toma el **primer** elemento de `X-Forwarded-For`, el que el cliente controla— por la estrategia `native` de Tomcat con `internal-proxies` configurable. Tomcat recorre la cabecera **de derecha a izquierda** descartando proxies conocidos, que es la semántica correcta cuando el balanceador **añade** en vez de reemplazar. Es exactamente el comportamiento de un ALB de AWS.
2. **Límite por identificador además de por IP, con retardo progresivo que no retiene hilos (D-40).**
3. **Estado en PostgreSQL.** `LoginRateLimiter` deja el `ConcurrentHashMap` (`LoginRateLimiter.java:25`) y pasa a una tabla `intento_ingreso` creada en **V0016**, con purga de filas fuera de ventana.
4. **Fallo cerrado si la IP es nula.** Hoy `check()` retorna sin hacer nada cuando la IP es `null` (`LoginRateLimiter.java:35-37`). Pasa a rechazar la petición.

**D-40 — Retardo progresivo sin retener hilos (aprobado)**

El servidor **nunca duerme esperando**. Por cada identificador se guarda el **momento del siguiente intento admitido**:

- Tras cada fallo consecutivo, ese momento se corre **0 s, 1 s, 2 s, 4 s, 8 s**, con **tope de 8 s**. Un ingreso correcto reinicia el contador.
- Toda petición que llegue **antes** de ese momento se responde **de inmediato con `429`** y la cabecera **`Retry-After`** en segundos. No se ocupa un hilo, no se encola, no se espera.
- **El conteo aplica al identificador enviado, exista o no la cuenta.** Un usuario inexistente se cuenta igual que uno real.

Esto último no es un detalle de implementación, es una propiedad de seguridad: si el comportamiento difiriera entre cuenta existente e inexistente, el propio limitador se convertiría en un oráculo de enumeración de usuarios. Contar siempre lo impide.

El bloqueo duro por cuenta ya existente (`UserRepository.java:82-85`, `usuario.intentos_fallidos` / `bloqueado_hasta`, atómico, 5 intentos / 15 min) **se conserva sin cambios**. El retardo progresivo actúa antes y es mucho más corto: frena la automatización sin castigar al usuario que se equivocó dos veces.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `backend/src/main/resources/application.yml:20` | `forward-headers-strategy` y `server.tomcat.remoteip.internal-proxies` por variable |
| `backend/src/main/java/com/wamma/platform/web/RequestInfo.java:18` | Sin cambio funcional; `getRemoteAddr()` sigue siendo correcto con la estrategia nueva |
| `backend/src/main/java/com/wamma/platform/auth/LoginRateLimiter.java` | Reescritura: estado en base, fallo cerrado, `429` inmediato con `Retry-After` |
| `backend/src/main/java/com/wamma/platform/config/SecurityProperties.java` | Curva del retardo y tope |
| `backend/src/main/java/com/wamma/platform/web/` (manejador de errores) | Emitir `Retry-After` en el `429` |
| `backend/src/main/resources/db/migration/V0016__permisos_wamma_app.sql` | Tabla `intento_ingreso` (identificador, tipo, fallos consecutivos, próximo intento admitido), índice y `GRANT` a `wamma_app` incluido `DELETE` para purgar: **no es tabla append-only** |
| `render.yaml` | `WAMMA_PROXIES_CONFIABLES` |

**Riesgo del cambio: alto. Es el punto que puede dejar a todo el personal fuera del sistema.**

- Si el rango de proxies de confianza se configura mal, **todas** las peticiones parecerán venir de la misma IP —la del proxy— y el límite por IP bloqueará el ingreso de todo el backoffice en minutos. Debe validarse contra la IP real que Render presenta, observándola primero en la bitácora.
- El fallo cerrado ante IP nula es correcto, pero hay que confirmar que **ninguna** ruta de ingreso corre fuera de un hilo de petición: `RequestContextHolder` devolvería `null` y el ingreso quedaría roto. `AuthService.java:90` corre en hilo de controlador; hay que verificar que no existan otras.
- Llevar el estado a la base añade una consulta por intento. A la escala del MVP es irrelevante; la tabla necesita purga o crecerá sin control.
- **Riesgo residual que el diseño acepta:** contar por identificador enviado permite que un tercero que conozca un nombre de usuario le imponga hasta 8 s de espera. Es el precio de no filtrar qué cuentas existen. Con tope de 8 s y sin bloqueo de cuenta asociado, la molestia es acotada y muy preferible a la enumeración.
- `intento_ingreso` guarda identificadores de ingreso, que son dato personal indirecto: aplica el período de conservación del Principio I. La purga no es solo higiene de tamaño.

> **El riesgo de agotamiento de hilos que señalaba la Rev. 1 desaparece con D-40.** Era el argumento para poner tope a la curva; con respuesta inmediata, el tope se mantiene por proporcionalidad con el usuario, no por capacidad del servidor.

**Cómo se prueba**

1. Prueba unitaria de resolución de IP: petición con `X-Forwarded-For: 1.2.3.4, 10.0.0.7` desde un proxy de confianza → la aplicación ve `1.2.3.4`. La misma cabecera desde un origen **no** confiable → se ignora.
2. **Prueba de regresión de la falsificación:** `X-Forwarded-For: 9.9.9.9` enviada por el cliente no debe poder evadir el límite. Esta prueba falla con el código actual; es la que demuestra que el defecto quedó cerrado.
3. Prueba de la curva: tras 1, 2, 3 y 4 fallos consecutivos, el `Retry-After` vale 1, 2, 4 y 8; al quinto sigue siendo 8. Un ingreso correcto lo devuelve a 0.
4. **Prueba de que no se retienen hilos:** la petición rechazada responde en tiempo comparable a una aceptada. Un `429` que tarde lo que dice `Retry-After` delata que alguien puso un `sleep`.
5. **Prueba anti-enumeración:** la secuencia de códigos, cabeceras y tiempos es indistinguible entre un identificador existente y uno inexistente.
6. Prueba de fallo cerrado: sin IP resoluble, el ingreso se rechaza.
7. Prueba de persistencia: el límite **sobrevive al reinicio** del proceso. Es lo que hoy no ocurre.
8. Prueba de purga: las filas fuera de ventana se eliminan y la tabla no crece indefinidamente.

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

> Conviene aprovechar para comprobar si las `WAMMA_S3_*` están hoy cargadas en Render. Si no lo están, el almacén S3 lanza al arrancar (`S3PhotoStorage.java:42`) y el servicio no está funcionando; si lo están, solo faltaba declararlas en el blueprint.

**Cómo se prueba**

1. Prueba de integración: perfil `supabase` con el conjunto incompleto → el arranque falla y el mensaje **nombra todas** las que faltan, no solo la primera.
2. Prueba de que ninguna variable del perfil `supabase` conserva un valor por defecto que apunte a `localhost`.
3. Revisión cruzada, automatizable: cada `${VAR}` del perfil `supabase` en `application.yml` está declarada en `render.yaml`. Es la comprobación que habría evitado este hallazgo.
4. Verificación manual tras desplegar: una foto de la vitrina carga desde el dominio de almacenamiento, no desde `localhost`.

---

### 6.5 `evidencia_url` y `archivo_url` pasan a clave de objeto (Punto 5)

**Qué cambia**

En **V0018**, siguiendo el precedente de `V0014:93` (`RENAME COLUMN url TO clave`):

- `inspeccion_punto.evidencia_url` → `evidencia_clave` (`V0003:83`)
- `solicitud_recaudo.archivo_url` → `archivo_clave` (`V0006:42`)

La URL se arma en tiempo de lectura con la configuración vigente, como ya hace `InventoryViews.java:98`. Cambiar de proveedor deja de exigir reescribir filas.

**Condición de aprobación (el PO verifica en Supabase)**

- **Si ninguna de las dos columnas tiene valores:** V0018 es el renombrado a secas y queda aprobada tal cual.
- **Si tienen valores:** se añade en la misma V0018 una **migración de datos** que extraiga la clave de la URL, recortando el prefijo público, y solo después renombra.

Para que esa condición no dependa de recordarla, **V0018 lleva una guarda**: si encuentra filas con valor no nulo y el paso de transformación no está presente, **aborta con un error explícito** en vez de renombrar. Así la migración no puede dejar en silencio URLs completas en una columna que el código leerá como clave.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `backend/src/main/resources/db/migration/V0018__clave_de_objeto.sql` | Guarda, transformación condicional y los dos `RENAME COLUMN` |
| `frontend-web/src/components/Imperfecciones.tsx:293`, `frontend-web/src/mocks/imperfecciones.ts:8` | Solo comentarios que citan el nombre viejo |

**Riesgo del cambio: bajo.**

Ambos módulos (004 y solicitud de crédito) están **sin implementar**: no hay una sola referencia a estas columnas en `backend/src/main/java`. Renombrar no rompe código. La guarda cubre el único escenario que sí haría daño.

Nota para cuando se implemente el módulo de recaudos: van en contenedor **privado** (D-09), así que `archivo_clave` **no** debe resolverse con `publicUrl()`, sino con URL firmada. Fuera del alcance de este spec, anotado para que no se herede el patrón de las fotos públicas.

**Cómo se prueba**

1. `LocalDevServer` aplica V0001–V0018 sobre base vacía sin error.
2. Prueba de esquema: tras V0018, las columnas nuevas existen y las viejas no.
3. Prueba de la guarda: con una fila de valor no nulo y sin transformación, V0018 falla en vez de renombrar.
4. La suite completa sigue en verde: ninguna consulta nombra las columnas viejas.

---

### 6.6 Convención: toda tabla nueva nace con `GRANT` y RLS (D-42)

**Qué cambia**

Se adopta como regla del proyecto: **toda migración que cree una tabla incluye, en la misma migración, su `GRANT` a `wamma_app` y su `ENABLE ROW LEVEL SECURITY`.** Nada de confiar en `ALTER DEFAULT PRIVILEGES` ni en el disparador `ensure_rls` de Supabase, que no existe fuera de Supabase (`V0009:38-40`).

Y se respalda con **una prueba que falla si alguna tabla del esquema queda sin ambos**.

**Estado actual: media convención ya existe.** `backend/tools/db/pruebas-esquema.sql` tiene la prueba universal de RLS (*"RLS activo en todas las tablas del esquema"*), que el CI corre en el job `Migraciones`. Lo que **no** existe es la contraparte de `GRANT`: hoy se comprueba tabla por tabla (`interaccion`, `persona`, `oportunidad`, `persona_telefono`), así que una tabla nueva sin permisos pasa desapercibida. Es exactamente el agujero que obliga a V0016 a re-otorgar.

**Archivos afectados**

| Archivo | Cambio |
|---|---|
| `backend/tools/db/pruebas-esquema.sql` | Prueba universal nueva: ninguna tabla del esquema sin `SELECT`/`INSERT` para `wamma_app`, salvo `flyway_schema_history` |
| `AGENTS.md` y `CLAUDE.md` | La convención, para que la sigan los agentes |
| `specs/000-overview/database-schema-design.md` | Registrar la regla donde vive el criterio de esquema |

**Riesgo del cambio: muy bajo.** Es una prueba y una regla escrita. El único efecto posible es que la prueba nueva **descubra tablas ya existentes sin permisos** — que es precisamente para lo que sirve. Si aparecen, se corrigen en V0016.

**Cómo se prueba**

1. La prueba universal de `GRANT` pasa tras V0016 sobre base reconstruida desde cero. El job `Migraciones` del CI ya ejecuta ese archivo, así que la cobertura es automática.
2. Prueba de la prueba: crear en una transacción revertida una tabla sin `GRANT` y comprobar que la comprobación **falla**. Una prueba universal que no se sabe fallar no protege nada.

---

## 7. Orden de ejecución

**Regla que manda sobre todo lo demás (D-41):** Flyway corre **al arrancar el backend**, así que **incluir una migración en un despliegue equivale a aplicarla**. No existe el paso «desplegar ahora, migrar después». Una migración se mezcla en `main` cuando su despliegue puede aplicarla sin romper nada.

De ahí sale este orden:

| # | Paso | Por qué aquí |
|---|---|---|
| 1 | 6.4 — declarar variables en `render.yaml` y cargarlas en el Dashboard | Sin esto, cualquier despliegue posterior falla al arrancar |
| 2 | 6.1 — perfiles, Flyway y comprobación de versión de esquema | Protege producción antes de tocar nada más |
| 3 | 6.6 — convención y prueba universal de `GRANT` | Debe existir antes que V0016, para que V0016 se valide con ella |
| 4 | 6.2 (backend) + **V0016** (permisos y `intento_ingreso`) | V0016 puede viajar con el despliegue del endpoint: solo añade permisos y una tabla, no quita nada a nadie |
| 5 | 6.3 — ingreso: IP, límite por identificador y estado en base | Necesita la tabla que trajo V0016 |
| 6 | 6.2 (frontend) — quitar PostgREST y `VITE_SUPABASE_*`, y **publicar** | El bundle nuevo debe estar en producción antes del paso 7 |
| 7 | **V0017** — retiro de la política pública | **Solo después** de que el frontend nuevo esté publicado y sirviéndose. Antes, retiraría el acceso de un bundle que todavía lo usa |
| 8 | **V0018** — renombrado de columnas (con su guarda) | Independiente; va al final por ser el de menor urgencia |
| 9 | Activar `wamma_app` en producción (paso manual, fuera del repositorio) | Lo último: es lo que menos se puede revertir en caliente |

**Reversión:** los pasos de código se revierten con un despliegue anterior. Las migraciones **no se revierten editando su archivo**: haría falta una migración compensatoria posterior. El paso 9 se revierte devolviendo `SUPABASE_DB_USER` al dueño del esquema.

## 8. Criterios de aceptación

- **CA-011.1** — Dado un entorno de desarrollo con las variables de producción cargadas, cuando se arranca el backend, entonces Flyway **no** migra, porque `FLYWAY_ENABLED` es `false` salvo que el entorno lo active.
- **CA-011.2** — Dado el backend en producción, cuando se conecta a la base, entonces lo hace con `wamma_app`, que no puede ejecutar DDL ni `UPDATE`/`DELETE` sobre las tablas *append-only*.
- **CA-011.3** — Dado el frontend desplegado, cuando carga los parámetros de financiamiento, entonces la única petición sale al backend de WAMMA; no hay tráfico a `supabase.co` salvo imágenes.
- **CA-011.4** — Dado un parámetro cambiado en base de datos, cuando se recarga la vitrina, entonces muestra el valor nuevo **sin redespliegue**; y si la carga falla, no muestra cuota alguna.
- **CA-011.5** — Dado un cliente que envía `X-Forwarded-For` falsificada, cuando intenta ingresar repetidamente, entonces el límite lo detiene igual, y la bitácora registra su IP real.
- **CA-011.6** — Dados cuatro fallos seguidos, cuando llega el quinto intento antes de tiempo, entonces la respuesta es `429` **inmediata** con `Retry-After: 8`, sin que el servidor haya esperado.
- **CA-011.7** — Dado un identificador inexistente, cuando se somete a la misma secuencia que uno existente, entonces las respuestas son indistinguibles en código, cabeceras y tiempo.
- **CA-011.8** — Dado un reinicio del proceso, cuando se reanudan los intentos, entonces el límite conserva la cuenta previa.
- **CA-011.9** — Dado el perfil `supabase` con una variable faltante, cuando arranca el servidor, entonces falla y nombra **todas** las faltantes; ninguna cae a un valor por defecto que apunte a `localhost`.
- **CA-011.10** — Dada la base tras V0018, cuando se inspecciona el esquema, entonces `evidencia_clave` y `archivo_clave` existen, `parametros_financiamiento` no tiene políticas, e `intento_ingreso` sí.
- **CA-011.11** — Dada cualquier tabla del esquema salvo `flyway_schema_history`, cuando corre la prueba de esquema, entonces esa tabla tiene RLS activo **y** `GRANT` para `wamma_app`.

## 9. Decisiones y preguntas abiertas

**Decisiones tomadas el 19/09/2026** (a registrar en `specs/000-overview/decisiones-po.md`):

| # | Decisión | Afecta a |
|---|---|---|
| **D-40** | Retardo progresivo 0/1/2/4/8 s con tope de 8 s, **sin retener hilos**: se guarda por identificador el momento del siguiente intento admitido y se responde `429` inmediato con `Retry-After`. El conteo aplica al identificador enviado, exista o no la cuenta | 6.3 |
| **D-41** | Flyway corre al arrancar: incluir una migración en un despliegue equivale a aplicarla. V0016 con el backend del endpoint, V0017 solo tras publicar el frontend, `wamma_app` de último | 7 |
| **D-42** | Toda migración que cree una tabla incluye su `GRANT` a `wamma_app` y su `ENABLE ROW LEVEL SECURITY`, con prueba universal que falle si alguna queda sin ambos | 6.6 |
| **D-43** | V0018 queda aprobada si `evidencia_url` y `archivo_url` no tienen valores; si los tienen, se añade migración de datos que extraiga la clave de la URL | 6.5 |

**Preguntas abiertas que no bloquean:**

| # | Pregunta | Afecta a |
|---|---|---|
| P-2 | ¿`inspeccion_punto` y `solicitud_recaudo` tienen valores? **Lo verifica el PO en Supabase.** La guarda de V0018 protege mientras tanto | 6.5 |
| P-3 | ¿`PARAMETROS_APROBADOS` sobrevive como modo maqueta sin servidor, o se elimina? Hoy convive con "sin valores de respaldo" porque solo actúa sin ninguna variable configurada | 6.2 |
| P-4 | ¿Las `WAMMA_S3_*` están hoy cargadas en el Dashboard de Render? Decide si 6.4 repara o solo formaliza | 6.4 |
| P-5 | Rango real de proxies de Render para `WAMMA_PROXIES_CONFIABLES`. Se obtiene observando la bitácora antes de activar el cambio | 6.3 |

## 10. Trazabilidad

| Origen | Destino |
|---|---|
| Constitución, Principio I (mínimo privilegio, conservación del dato) | 6.1, 6.3 |
| Constitución, Principio II (portabilidad) | 6.2, 6.5, 6.6 |
| Constitución, Principio V (ledger sagrado) | 6.1 (`REVOKE` append-only ya no reversible por la aplicación) |
| Constitución, Principio VI (secretos, mínimo privilegio) | 6.1, 6.3, 6.4 |
| D-05 (secretos en variables de Render) | 6.4 |
| D-09 (almacén compatible con S3; recaudos privados) | 6.5 |
| D-26 (parámetros financieros) | 6.2 |
| D-40 a D-43 (aprobación de este spec) | 6.3, 6.5, 6.6, 7 |
| Auditoría de solo lectura del 19/09/2026 | Los cinco puntos |

---
*WAMMA · Confidencial · Rev. 2 · Aprobado · No constituye asesoría legal ni financiera.*
