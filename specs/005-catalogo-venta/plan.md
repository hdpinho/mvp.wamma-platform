# 005 · Plan técnico — Etapa 2: inventario, catálogo y tasa BCV

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Septiembre 2026**
**Spec de referencia:** `./spec.md` (Rev. 2) y, en parte, `../004-inspeccion-240-puntos/spec.md`
**Estado:** **Aprobado** por el Product Owner el 15 de septiembre de 2026 (D-25), con la opción recomendada en cada punto de §1. En E14, sin la consulta periódica por ahora

> El QUÉ está en `spec.md`. Aquí va el CÓMO. `../000-overview/architecture-plan.md` manda sobre lo transversal, y el plan del 001 fija la seguridad, la bitácora y la persistencia con `JdbcClient`.

---

## 1. Decisiones y propuestas

| # | Punto | Propuesta | Estado |
|---|---|---|---|
| E1 | Moneda | Publicaciones en **EUR**: `publicacion.moneda` admite `EUR` y `VES`. La moneda de adquisición admite `EUR`, `USD` y `VES`, porque una compra puede pagarse en dólares y es un dato interno. Las restricciones `USD`/`VES` de los demás módulos se migran en sus etapas (deuda declarada en la Constitución v3.0.0) | Propuesta |
| E2 | Tasa BCV | Una fila por **fecha y moneda**. La vigente es la de fecha más reciente, hasta hoy en hora de Venezuela. Se puede registrar la de cualquier día hasta hoy; registrar de nuevo un día lo corrige, con el antes y el después en la bitácora. Los precios publicados conservan la tasa con que se fijaron. Sin ninguna tasa del euro, la vitrina muestra solo euros y dice "equivalencia no disponible" | Propuesta |
| E3 | Código de inventario | `vehiculo.codigo`, único y estable. Los de demostración conservan `veh-001` a `veh-016` y los nuevos reciben `WAM-00017` en adelante. Es lo que va en la dirección de la ficha y en el CRM; el UUID queda como identificador interno | Propuesta |
| E4 | Datos opcionales (D-12) | La placa y los cuatro campos de adquisición (precio, moneda, tasa y fecha) pasan a opcionales, con la regla "todos o ninguno". El **VIN sigue obligatorio**: identifica la unidad y lo exige la validación legal del 004. Es un cambio respecto de la maqueta, donde es opcional | **Propuesta: confirmar** |
| E5 | Disponibilidad | Se guarda en `vehiculo.estado`: disponible = `exhibicion`, con cita = `reservado`, vendido = `vendido`. Los demás estados (`inspeccion`, `reacondicionamiento`, `bloqueado_legal`) quedan para el 004 completo. Aparece en la vitrina si su publicación está en `publicado` y el vehículo no está vendido | Propuesta |
| E6 | Publicación | Cada vehículo nace con su publicación en **borrador**, que guarda el precio, la etiqueta comercial y las fotos. Al publicar se fija la tasa del día; si luego cambia el precio, se fija la tasa de ese momento | Propuesta |
| E7 | Certificación simplificada | Cada vehículo tiene una `inspeccion`, y sus imperfecciones son `inspeccion_punto` estéticos "no conforme", con código `IMP-nn`, zona, severidad y posición. Certificar pasa la inspección a `certificada`, con resultado `apto` o `con_observaciones`. `inspector_id` admite nulo solo en la carga inicial de demostración | Propuesta |
| E8 | Fotos | Puerto `AlmacenFotos` con dos adaptadores: **S3** (Supabase Storage en producción, D-09) y **disco local** (desarrollo y pruebas, servido por el backend). Cada foto se vuelve a codificar como JPEG, en dos tamaños: 1600 px y miniatura de 640 px. Así se eliminan los metadatos, baja el peso y se ve igual en todos los navegadores | Propuesta |
| E9 | Fotos de demostración (P-005.1) | **A (recomendada):** subir ya las 16 fotos actuales al almacenamiento definitivo, marcadas como "referencial" con su crédito, y que el rol Inventario agregue las del fotógrafo cuando existan. Mientras tanto, los vehículos de demostración se publican con una foto, por excepción. **B:** completar cinco por modelo con más fotos libres de Wikimedia Commons, con créditos; tampoco serían de la unidad real. **C:** no publicar los de demostración hasta tener las fotos del fotógrafo | **Pregunta al PO** |
| E10 | Mínimo de fotos (P-005.2) | 5 para publicar, 10 como máximo. Excepción: los de demostración, según E9 | **Pregunta al PO** |
| E11 | Sin certificar (P-005.3) | Se puede publicar con el aviso actual y sin sello, como la maqueta, mientras no exista el 004 completo | **Pregunta al PO** |
| E12 | Precios de demostración (P-005.4) | Se conservan las cifras, ahora en euros. Son datos simulados y así se marcan | **Pregunta al PO** |
| E13 | CRM, en el navegador hasta la etapa 3 | Con sesión, sus cambios de disponibilidad van al servidor (`crm.operar`). La cita que agenda un visitante desde la vitrina sigue en su navegador y **no bloquea** el vehículo en el servidor hasta la etapa 3 | Propuesta |
| E14 | Servidor dormido (D-19) | La vitrina muestra la última copia del catálogo guardada en el navegador mientras el servidor responde, con el aviso "actualizando". **Opcional:** mantenerlo despierto con una consulta cada 10 minutos desde GitHub Actions. Consume casi todas las horas gratuitas del mes de Render | **Pregunta al PO** (la opción) |
| E15 | Migración visual a EUR en curso en otra sesión | Otra sesión está cambiando a euros los textos de `TarjetaVehiculo`, `SimuladorCuota`, `ModalAgendarCita`, `C0`, `C1` y `C2`. Para no pisarnos, la etapa 2 toma esos archivos cuando esa sesión termine; lo de fondo (`precioUSD` → `precio` en EUR y la tasa real) es de esta etapa | **Pregunta al PO** |

---

## 2. Encaje en la arquitectura

```
backend/src/main/java/com/wamma/
├── platform/        # etapas 0 y 1: seguridad, bitácora, cifrado, errores
├── inventory/       # vehículo, publicación, imperfecciones, certificación y disponibilidad (004 parcial + 005)
│   └── photos/      # AlmacenFotos (S3 y disco local) y procesado de imágenes
├── catalog/         # vitrina pública, de solo lectura
└── exchangerate/    # tasa BCV (009 parcial)
```

- **Dependencias:** `inventory`, `catalog` y `exchangerate` usan `platform` (bitácora, usuario actual y errores); `catalog` lee de `inventory` y de `exchangerate`; `platform` no depende de ninguno.
- **Dinero:** un tipo `Money` (`BigDecimal` con escala 2 y moneda) y una conversión EUR → VES con redondeo `HALF_UP` a dos decimales. Nunca `double`.
- **Persistencia:** `JdbcClient`, como en el 001. Cada cambio se escribe en la bitácora dentro de la misma transacción.

---

## 3. Modelo físico — migración V0014

| Tabla | Cambio |
|---|---|
| `vehiculo` | + `codigo` (único, obligatorio) y la secuencia `vehiculo_codigo_seq`, que empieza en 17. `placa` admite nulo; su `UNIQUE` sigue y admite varios nulos. Los cuatro campos de adquisición admiten nulo, con un `CHECK` de "todos o ninguno", y su moneda admite `EUR`, `USD` o `VES`. + `CHECK` de carrocería con los seis tipos de la maqueta. + `es_demostracion` (booleano) |
| `publicacion` | `moneda` por omisión `EUR`, con `CHECK` (`EUR`, `VES`). `tasa_bcv` y `fecha_tasa` admiten nulo solo en borrador (`CHECK`). + `etiqueta` (Recién ingresado, Difícil de conseguir, Listo para entrega) |
| `publicacion_foto` | `url` pasa a `clave`, la clave del objeto: las URL se arman con la configuración y así cambiar de proveedor no toca la base. + `clave_miniatura`, `ancho`, `alto`, `subida_por`. + `credito_autor`, `credito_licencia` y `credito_origen`, solo para las fotos referenciales. A lo sumo una principal por publicación, con un índice único parcial |
| `inspeccion` | `inspector_id` admite nulo (solo carga inicial) |
| `inspeccion_punto` | `CHECK` de que la posición está entre 0 y 100 |
| `tasa_cambio_bcv` | + `moneda` (`EUR`, `USD`). La fila existente queda como `USD`. `tasa_usd_ves` pasa a `tasa_ves`, con `NUMERIC(18,8)` como el resto de las tasas (V0011). El `UNIQUE (fecha)` pasa a `UNIQUE (fecha, moneda)`. + `actualizado_en` y `actualizado_por`, para las correcciones |
| `sede` | `direccion` admite nulo, porque sigue pendiente (D-23). Se siembra la sede `DC`, **Distrito Capital** |

Como toda migración nueva (`database-schema-design.md` §5):
- No toca `flyway_schema_history`.
- Privilegios de `wamma_app` por omisión. Ninguna tabla es append-only.
- Pruebas nuevas en `pruebas-esquema.sql`.
- Se prueba desde cero en local y en la CI.
- El **ensayo contra Supabase** (`ensayo 14 -Dbloqueo`, en una transacción que se revierte) se hace antes del despliegue, con tu confirmación.

---

## 4. Flujos

### 4.1 Alta y publicación
```
POST /v1/inventario                      → vehículo + publicación en borrador + inspección
POST /v1/inventario/{codigo}/fotos       → una foto por petición (hasta 10)
PUT  /v1/inventario/{codigo}             → datos, precio, etiqueta, imperfecciones y certificación
POST /v1/inventario/{codigo}/publicacion → valida (fotos, precio, tasa del euro) y fija la tasa
```
- Si hay dos personas editando, `PUT` exige el `actualizadoEn` que se leyó. Si cambió entretanto, responde 409 ("Otra persona modificó este vehículo; recarga").
- **Publicar los listos:** una acción del inventario que publica en lote los borradores que cumplen las reglas. Sirve para el primer despliegue, en el que los de demostración nacen en borrador.

### 4.2 Disponibilidad
| De → a | Quién |
|---|---|
| disponible ↔ con cita | `crm.operar` o `inventario.gestionar` |
| cualquiera → vendido | `crm.operar` o `inventario.gestionar` |
| vendido → disponible (corrección) | Solo `inventario.gestionar`, con motivo |

### 4.3 Vitrina
- `GET /v1/catalogo` devuelve el resumen de cada vehículo en la vitrina, con su miniatura principal, y la tasa vigente. Se filtra y se ordena en el navegador, como hoy: con decenas de vehículos no hace falta paginar en el servidor.
- `GET /v1/catalogo/{codigo}` devuelve la ficha completa. Lo que no está en la vitrina responde 404.
- Las respuestas llevan `Cache-Control: public, max-age=60`.

### 4.4 Tasa BCV
`POST /v1/tasas-bcv {fecha, tasa, fuente}` registra o corrige la tasa. `GET /v1/tasa-bcv/vigente` es público.

---

## 5. Almacenamiento de fotos

| Pieza | Cómo |
|---|---|
| Puerto | `AlmacenFotos`: `guardar(clave, bytes, tipo)`, `borrar(clave)` y `urlPublica(clave)` |
| Producción | Adaptador S3 con AWS SDK for Java v2 (Apache 2.0), apuntado a Supabase Storage (`https://<ref>.storage.supabase.co/storage/v1/s3`). Contenedor **público** `vehiculos`: las fotos de la vitrina son públicas por naturaleza. Los recaudos, en la etapa 4, irán a otro contenedor privado (D-09) |
| Local y pruebas | Adaptador de disco en una carpeta configurable, servido por el backend en `/archivos/**`. Solo existe con ese adaptador |
| Claves | `vehiculos/{codigo}/{uuid}-1600.jpg` y `-640.jpg`. Una foto nueva lleva siempre una clave nueva, así que ninguna caché muestra una versión vieja |
| Procesado | ImageIO, más el lector de WebP de TwelveMonkeys (BSD). Se decodifica, se reduce al tamaño máximo y se codifica como JPEG con calidad 0,85. El tipo se valida por su firma de bytes, no por la extensión. Máximo 10 MB por archivo |
| Orden de escritura | Primero se sube al almacenamiento y luego se registra en la base. Si la base falla, se borra el objeto subido |
| Variables | `WAMMA_FOTOS_ALMACEN` (`s3` o `disco`), `WAMMA_S3_ENDPOINT`, `WAMMA_S3_REGION`, `WAMMA_S3_BUCKET`, `WAMMA_S3_ACCESS_KEY`, `WAMMA_S3_SECRET_KEY` y `WAMMA_FOTOS_URL_PUBLICA` |
| CSP | `img-src` añade `https://nwbnisehliwvuljpfutg.supabase.co` |

---

## 6. Contratos de API

| Método y ruta | Permiso | Notas |
|---|---|---|
| `GET /v1/catalogo` · `GET /v1/catalogo/{codigo}` | Público | Solo lo que está en la vitrina; sin datos internos |
| `GET /v1/tasa-bcv/vigente` | Público | Última tasa del euro y su fecha |
| `GET /v1/inventario` · `GET /v1/inventario/{codigo}` | `inventario.ver` | Todo el inventario, con placa, adquisición y estado de publicación |
| `POST /v1/inventario` · `PUT /v1/inventario/{codigo}` | `inventario.gestionar` | Alta y edición, con imperfecciones y certificación |
| `DELETE /v1/inventario/{codigo}` | `inventario.gestionar` | Solo si nunca se publicó; si no, 409 con la sugerencia de pausar |
| `POST /v1/inventario/{codigo}/fotos` · `DELETE …/fotos/{id}` · `PUT …/fotos/orden` | `inventario.gestionar` | Subir (multipart), quitar, ordenar y elegir la principal |
| `POST /v1/inventario/{codigo}/publicacion` · `DELETE …/publicacion` | `inventario.gestionar` | Publicar y pausar |
| `POST /v1/inventario/publicacion-en-lote` | `inventario.gestionar` | Publicar los listos |
| `PUT /v1/inventario/{codigo}/disponibilidad` | `inventario.gestionar` o `crm.operar` | Reglas de §4.2 |
| `GET /v1/tasas-bcv` · `POST /v1/tasas-bcv` | `tasa_bcv.registrar` | Historial, y registro o corrección |

Errores en el formato Problem Details de la etapa 0. Cada 403 queda en la bitácora (001).

**Eventos nuevos de la bitácora:**
- `vehiculo.creado`, `vehiculo.actualizado`, `vehiculo.eliminado`;
- `vehiculo.certificado`;
- `vehiculo.disponibilidad_cambiada`;
- `foto.agregada`, `foto.quitada`, `fotos.reordenadas`;
- `publicacion.publicada`, `publicacion.pausada`, `publicacion.precio_cambiado`;
- `tasa_bcv.registrada`, `tasa_bcv.corregida`.

---

## 7. Frontend

- **Clientes de la API:** `api/catalogo.ts`, `api/inventario.ts` y `api/tasaBcv.ts`.
- **Contexto del inventario:**
  - Con servidor, la vitrina se lee de `/v1/catalogo`; con sesión y `inventario.ver`, se carga además el inventario completo.
  - Sin servidor, sigue con los datos de maqueta, como hoy.
  - El tipo pasa de `precioUSD` a `precio` (EUR) y de `foto` a `fotos[]`. El `id` es el código de inventario.
  - Las operaciones pasan a ser asíncronas y devuelven errores que la pantalla muestra.
- **Inventario (O3):**
  - estado de publicación, con acciones **Publicar**, **Pausar** y **Publicar los listos**;
  - **Eliminar** solo en borrador;
  - el formulario gana un gestor de fotos (subir, ordenar y elegir la principal), la certificación, y la placa y la adquisición como campos opcionales.
- **Ficha (C2):** galería de fotos. El crédito aparece solo en las fotos referenciales.
- **Tasa BCV:** pantalla nueva `/admin/tasa-bcv` para `tasa_bcv.registrar`, con registro e historial, y su entrada en el menú.
- **Vitrina:**
  - con servidor, se oculta el simulador de tasa de la maqueta y se muestra "Tasa BCV del euro: X Bs. (fecha)";
  - se guarda una copia del catálogo en el navegador (E14);
  - se añade el origen de las fotos a la CSP.
- **CRM:** llama a `/disponibilidad` cuando hay sesión (E13).

---

## 8. Datos de demostración

`DemoInventorySeeder` (se activa con `WAMMA_DEMO_CARGAR_INVENTARIO=true`) actúa solo si el inventario está vacío:
- carga los 16 vehículos, sus 37 imperfecciones y sus fotos, según E9;
- los marca con `es_demostracion`, en borrador;
- deja en la bitácora que su origen es la "carga inicial".

Sus recursos (JSON y fotos) viven en `backend/src/main/resources/demo/`. Los datos de maqueta del frontend se quedan para el modo sin servidor.

---

## 9. Estrategia de pruebas

| Objeto | Nivel | Exigencia |
|---|---|---|
| Conversión EUR → VES, redondeo, reglas de publicación y de disponibilidad | Unitaria | Casos límite |
| Procesado de fotos | Unitaria | Un JPEG con GPS sale sin GPS (CA-005.8). Tamaños máximos. WebP y PNG se leen. Un archivo que no es imagen se rechaza |
| API de inventario, fotos, vitrina y tasa | Integración (PostgreSQL embebido y disco local) | CA-005.5 a CA-005.12: 403 auditado, 404 de lo que no está en la vitrina, 409 al eliminar un publicado y en la edición concurrente |
| Adaptador S3 | Integración manual, en el despliegue | Subir, leer la URL pública y borrar, contra Supabase |
| V0014 | `SchemaTestRunner` y CI | Desde cero; en Supabase, ensayo antes del despliegue |
| Recorrido en navegador | Playwright | Alta con fotos → publicar → aparece en la vitrina; la tasa cambia la equivalencia; un pausado desaparece; el CRM vende y el auto sale; sin errores de CSP |

---

## 10. Despliegue (acciones del PO, al final de la etapa)

1. **Supabase:** crear el contenedor público `vehiculos` y generar las claves S3 en el panel.
2. **Ensayo de V0014 contra Supabase**, en una transacción que se revierte, con tu confirmación.
3. **Render:** configurar las variables `WAMMA_FOTOS_*`, `WAMMA_S3_*` y `WAMMA_DEMO_CARGAR_INVENTARIO=true`.
4. **Push.** Después: registrar la tasa BCV del euro del día y usar **Publicar los listos**.

---

## 11. Riesgos y limitaciones

| Riesgo | Mitigación |
|---|---|
| Un visitante agenda desde la vitrina y el vehículo no queda bloqueado en el servidor | Limitación declarada hasta la etapa 3 (E13) |
| Primer visitante del día con el servidor dormido | Copia local del catálogo, más la opción de E14 |
| Fotos referenciales que no son del vehículo (si se elige E9-A) | Crédito visible y marca "foto referencial"; se sustituyen al subir las del fotógrafo |
| Cuotas del plan gratuito de Supabase Storage | Fotos de 1600 px en JPEG; revisar el consumo al cargar inventario real |
| El disco de Render se borra en cada despliegue | El adaptador de disco es solo para local y pruebas; en producción, siempre S3 |
| Objetos huérfanos si la base falla después de subir | Se borran al instante; una limpieza periódica queda para después |
| Choque con la migración visual a EUR de la otra sesión | E15 |

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
