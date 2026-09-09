# SC · Plan técnico — Solicitud de crédito en autoservicio

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Agosto 2026**
**Spec de referencia:** `./spec.md`
**Estado:** Draft para validación del Product Owner

> El QUÉ está en `spec.md`. Este documento concentra el **CÓMO**: arquitectura, contratos, modelo físico y decisiones técnicas. Se apoya en `../000-overview/architecture-plan.md`, que manda sobre las decisiones transversales.

---

## 1. Supuestos adoptados

Instrucción recibida: *"los insumos los vemos luego; deja los datos ya manejados"*. En consecuencia, este plan **adopta lo ya establecido en el repositorio** en lugar de los valores que lo contradecían. Cada supuesto es reversible y está aislado tras un parámetro o una interfaz, de modo que cambiarlo no obligue a reescribir el módulo.

| # | Punto | Decisión adoptada | Reversibilidad |
|---|---|---|---|
| S1 | **Moneda** | **USD** con equivalencia a tasa BCV (Constitución, Principio V). Se descarta EUR | Cambio en tabla de parámetros + migración de `moneda`. El tipo `Dinero` ya es multi-moneda |
| S2 | **Tasa de interés** | Se usa como **referencia** la ya manejada: 4 % mensual / 48 % anual (`data-model.md`, `research-dependencies.md` P6). **No se codifica**: vive en `parametros_financieros` | Cambiar una fila. Cero código |
| S3 | **Tokens de marca** | Los vigentes de `../000-overview/ui-design.md`: `#D17438`, texto `#1A1A18`, Montserrat. Se descartan `#2B2B2B` y `#18072B` | Cambio en `tokens/` |
| S4 | **Logo sobre negro** | **Permitido** en versión blanca, conforme al manual de marca (lámina "Positivo / Negativo") | — |
| S5 | **Puerta de KYC** | El asistente es **público** y se envía con **OTP verificado**. El **KYC verificado se exige para aprobar**, no para solicitar: la transición `en_analisis → aprobada` lo valida en el módulo 006 | Conserva la regla del módulo 002 sin bloquear la captación |
| S6 | **Relación con 006** | Este módulo es la **capa de captación** del 006. Produce el expediente; **no decide** | Interfaz explícita, sin duplicar la entidad |
| S7 | **Fidelidad del PDF** | Se implementa contra la estructura descrita en el encargo. **La verificación de fidelidad queda pendiente** de recibir el WMA-F-FIN-001 | Plantilla declarativa, no código |

> **S5 en detalle.** Es la conciliación entre el encargo (autoservicio público) y el módulo 002 (financiar exige nivel verificado): lo que exige KYC verificado es **otorgar el crédito**, no **pedirlo**. El asistente captura además cédula y RIF, que son la materia prima del propio expediente KYC. Con esto ninguna regla existente se rompe.

**Insumos aún ausentes** (D10 OTP, D11 antivirus, D13 bancos, D14 municipios, D15 `lead_id`, D12 formato): se implementan **detrás de adaptadores** con una implementación de desarrollo, para que la llegada del proveedor real no toque el dominio. Ver §12.

---

## 2. Encaje en la arquitectura

Stack heredado sin cambios de `architecture-plan.md`: **Go** (monolito modular), **PostgreSQL**, **Redis**, **React**, object storage nacional, API `/v1`.

### 2.1 Paquete propio, no dentro de `risk`

```
backend/internal/
├── platform/      # auth, RBAC, auditoría, cifrado (001)  ← dependencia transversal
├── identity/      # KYC (002)
├── catalog/       # vehículo (005)
├── creditapp/     # ◄ NUEVO — captación pública de solicitudes
└── risk/          # scoring, AML, decisión (006)          ← consume creditapp
```

**Por qué paquete separado y no `internal/risk/solicitud/`:** `creditapp` expone superficie **pública y no autenticada** a internet; `risk` contiene la lógica de decisión. Mantenerlos separados convierte esa frontera en un límite de compilación, no en una convención: `creditapp` no puede invocar decisión de crédito ni aunque alguien lo intente por descuido. Es defensa en profundidad al costo de un paquete.

La dependencia es unidireccional: `creditapp → risk` (entrega el expediente). Nunca al revés.

### 2.2 Organización interna

```
internal/creditapp/
├── domain/          # entidades, máquina de estados, invariantes — sin I/O
├── calc/            # motor financiero (decimal exacto)
├── validation/      # ◄ módulo independiente y reutilizable (§6)
├── draft/           # borrador, autoguardado, reanudación
├── otp/             # emisión y verificación (adaptador)
├── documents/       # recaudos: antivirus, hash, almacenamiento
├── legal/           # textos versionados, declaraciones, evidencia
├── pdf/             # generación del WMA-F-FIN-001
├── store/           # repositorios PostgreSQL
└── http/            # handlers /v1
```

`domain/` y `calc/` no importan nada de infraestructura: son puros y por tanto exhaustivamente testeables, que es donde el spec exige **100 % de cobertura de ramas**.

### 2.3 Frontend

Pantalla nueva en `frontend-web/`, reusando los tokens y componentes existentes (`Boton`, `Campo`, `NotaSimulada`, `FotoVehiculo`). Ruta pública `/solicitud-credito`, fuera del layout autenticado.

Presupuesto **< 200 KB JS comprimido**: la ruta se carga con `React.lazy`, cada paso es su propio *chunk*, y el generador de PDF **no viaja al cliente** (se genera en servidor).

---

## 3. Modelo físico

Migraciones versionadas en `backend/migrations/`, idempotentes. Nueve tablas conforme a `spec.md` §10.

### 3.1 Convenciones obligatorias

- **Identificadores:** UUID v7 (ordenable por tiempo, mejor localidad de índice que v4).
- **Dinero:** `NUMERIC(18,2)` + `moneda CHAR(3)` + `tasa_bcv NUMERIC(18,6)` + `fecha_tasa DATE`. **Prohibido `float`/`double`** (Principio V).
- **Auditoría de fila:** `creado_en`, `creado_por`, `actualizado_en`.
- **Cifrado de campo:** columnas `BYTEA` con sobre cifrado (envelope encryption) vía `platform/crypto`. Afecta a cédula, pasaporte, RIF, número de cuenta y rutas de recaudos.
- **Búsqueda sobre campo cifrado:** columna adicional `<campo>_bidx` con HMAC-SHA256 determinista y clave separada, para permitir el límite de tasa por documento sin descifrar ni exponer el valor.

### 3.2 Tablas

| Tabla | Notas de implementación |
|---|---|
| `solicitudes_credito` | `numero` con `UNIQUE`, formato `WMA-SC-AAAA-NNNNNN` generado por secuencia anual. `estado` como `ENUM`. FK opcionales a `vehiculo_id`, `lead_id`, `kyc_id`. Snapshot de tasa BCV |
| `solicitantes` | 1:1 con la solicitud. Campos sensibles cifrados + `_bidx` |
| `balances_financieros` | Ingresos y egresos. **Los totales se persisten calculados**, no editables por API |
| `referencias` | `tipo ENUM('personal_1','personal_2','familiar')`, `UNIQUE(solicitud_id, tipo)` |
| `datos_bancarios` | `numero_cuenta` cifrado + `_bidx`. `banco_codigo` con FK a catálogo de bancos |
| `recaudos` | **Un registro por archivo.** `hash_sha256` con `UNIQUE` parcial para deduplicar. `estado_validacion` reservado al backoffice |
| `declaraciones` | FK a `textos_legales(id, version)`. **Nunca un booleano suelto** |
| `textos_legales` | ◄ tabla añadida: `codigo`, `version`, `texto`, `vigente_desde`. Append-only |
| `evidencias_aceptacion` | `hash_payload`, `ip`, `user_agent`, `ts_servidor`, `otp_verificacion_id` |
| `auditoria` | Append-only. `REVOKE UPDATE, DELETE` + trigger que aborta ambas |
| `parametros_financieros` | ◄ tabla añadida: clave, valor, vigencia. Origen único de tasas, plazos y umbrales |
| `catalogo_bancos` | ◄ tabla añadida: código de 4 dígitos, nombre. Se siembra al recibir D13 |
| `catalogo_ubicaciones` | ◄ tabla añadida: estado, municipio. Se siembra al recibir D14 |

**Inmutabilidad real, no por convención.** `auditoria`, `textos_legales` y `evidencias_aceptacion` reciben:

```sql
REVOKE UPDATE, DELETE ON <tabla> FROM app_user;
CREATE TRIGGER <tabla>_inmutable BEFORE UPDATE OR DELETE ON <tabla>
  FOR EACH ROW EXECUTE FUNCTION abortar_mutacion();
```

El permiso lo impide y el trigger lo prueba. Con solo uno de los dos, un error de configuración basta para perder la garantía.

---

## 4. Contratos de API (`/v1`)

Todos bajo `/v1/solicitudes-credito`. Sesión pública mediante **token opaco** en cookie `HttpOnly` + `Secure` + `SameSite=Strict`. **Nunca PII en el cliente.**

| Método | Ruta | Propósito | Notas |
|---|---|---|---|
| `POST` | `/` | Crea el borrador y devuelve token de sesión | Límite de tasa por IP |
| `GET` | `/{id}` | Lee el borrador propio | Requiere token de sesión |
| `PATCH` | `/{id}/paso/{n}` | Autoguarda un paso | Validación de servidor por paso; idempotente |
| `POST` | `/{id}/recaudos` | Sube archivo | `multipart`. Antivirus **antes** de persistir |
| `DELETE` | `/{id}/recaudos/{rid}` | Elimina archivo | Solo en `borrador` |
| `POST` | `/{id}/otp` | Emite OTP | 3 reenvíos/hora, por IP y por documento |
| `POST` | `/{id}/otp/verificar` | Verifica OTP | 3 intentos, vigencia 5 min |
| `POST` | `/{id}/enviar` | **Envía** la solicitud | Exige OTP verificado + 6 declaraciones. Sella evidencia |
| `POST` | `/{id}/desistir` | Desiste | |
| `GET` | `/{id}/pdf` | Descarga el PDF | Auditado |
| `POST` | `/reanudar` | Solicita enlace de reanudación | Token de un solo uso + OTP |
| `GET` | `/estado/{numero}` | Consulta pública de estado | Requiere verificación; devuelve **solo** el estado |
| `GET` | `/parametros` | Parámetros del simulador | Tasa, plazos, frecuencias. Sin umbrales de decisión |
| `GET` | `/catalogos/{bancos\|ubicaciones}` | Listas | Cacheado en Redis |

**Regla de exposición.** Ninguna respuesta incluye `ratio_cuota_ingreso`, `capacidad_pago` ni señal alguna de probabilidad de aprobación (`spec.md` §8.2). Se garantiza con DTO de salida explícito —nunca serializando la entidad de dominio— y una prueba que falla si aparecen esos campos.

---

## 5. Máquina de estados

Implementada como tabla de transiciones permitidas, no como `if` dispersos:

```go
var transiciones = map[Estado][]Estado{
    Borrador:            {Enviada, Desistida, Vencida},
    Enviada:             {RecaudosIncompletos, EnAnalisis, Desistida},
    RecaudosIncompletos: {EnAnalisis, Desistida},
    EnAnalisis:          {Aprobada, Rechazada},
}
```

- Cada transición valida **origen permitido** + **actor autorizado**.
- La superficie pública solo puede ejecutar `→ Enviada`, `→ Desistida`, `→ Vencida`; se comprueba por capacidad del llamante, no por confianza.
- Toda transición —y **todo intento rechazado**— se audita.
- `→ Vencida` la ejecuta un trabajo periódico con el umbral de `parametros_financieros` (P11). Sin parámetro cargado, el trabajo **no corre**; no asume un valor.

---

## 6. Validadores venezolanos

Módulo **independiente del formulario**, en `internal/creditapp/validation/`, sin dependencias del dominio. Es entregable reutilizable por 002, 006 y 007.

| Validador | Implementación |
|---|---|
| `Cedula` | Prefijo `V`/`E` + 6–9 dígitos |
| `RIF` | **Algoritmo módulo 11 completo**, no expresión regular. Pesos por letra `V/E/J/P/G` |
| `DerivarRIF` | Cédula → RIF con dígito verificador calculado |
| `CuentaBancaria` | 20 dígitos + banco existente + dígito verificador |
| `TelefonoMovil` | `+58` + `4` + operadora (12/14/16/24/26) + 7 dígitos |
| `TelefonoFijo` | `+58` + `2` + área + 7 dígitos |
| `Email` | Formato + **resolución MX** con timeout y caché |
| `FechaNacimiento` | Mayor de edad; edad máxima al vencimiento **parametrizada** (P10) |
| `Monto` | Decimal positivo, 2 decimales, moneda obligatoria |

**Duplicación cliente/servidor.** El servidor es la autoridad; el cliente solo mejora la experiencia. Para no mantener dos algoritmos que diverjan, las reglas puramente sintácticas se declaran en un **JSON compartido** consumido por ambos; las que exigen estado (MX, banco existente, parámetros) son **solo de servidor**. Esto evita el fallo clásico de que la regla del cliente se relaje y nadie lo note.

---

## 7. Motor de cálculo financiero

En `internal/creditapp/calc/`, con **`math/big` de la biblioteca estándar**: enteros de unidad menor para los importes y `big.Rat` para el cálculo intermedio. **Prohibido `float64`** en toda ruta monetaria.

Se descartó `shopspring/decimal`: con racional exacto, `(1+i)^n` no arrastra truncamiento, mientras que en decimal cada potencia lo acumula a lo largo del plazo y descuadra la última cuota. Además evita atar el núcleo financiero a una dependencia de terceros.

```
total_ingresos      = sueldo + otros_ingresos
total_egresos       = alquiler + alimentacion_servicios + deudas
capacidad_pago      = total_ingresos − total_egresos
ratio_cuota_ingreso = cuota_estimada / total_ingresos     (interno)
```

La **cuota** reusa el sistema francés ya implementado en la maqueta (`mocks/financiamiento.ts`), portado a Go como fuente única. Tasa, plazos y frecuencias se leen de `parametros_financieros`; si falta el parámetro, el simulador **se deshabilita con un mensaje**, no adopta un valor por defecto.

Casos límite con prueba obligatoria: ingresos cero (división por cero en el ratio), capacidad negativa, plazo mínimo, redondeo de la última cuota.

---

## 8. Borrador, reanudación y OTP

- **Borrador en servidor.** El cliente solo guarda el token opaco de sesión. Nada de PII en `localStorage` ni `sessionStorage`.
- **Autoguardado** al salir de cada paso, con cola de reintento y bandera visible de "sin conexión — tus datos están guardados". El `PATCH` es idempotente por `(solicitud, paso, versión)`.
- **Reanudación:** enlace con token **de un solo uso**, vigencia corta, que además exige **OTP**. El token solo por sí mismo no abre el expediente.
- **OTP:** 6 dígitos, vigencia 5 min, 3 intentos, 3 reenvíos/hora. Se almacena **hash** del código, nunca el código. Contadores en Redis con TTL. Límite por IP **y** por documento (usando el `_bidx`).

Interfaz de proveedor, con WhatsApp primario y SMS de respaldo:

```go
type CanalOTP interface {
    Enviar(ctx context.Context, destino Telefono, codigo string) error
}
```

Implementaciones: `WhatsAppOTP`, `SmsOTP`, `LogOTP` (desarrollo, escribe el código **enmascarado** en log). El proveedor real llega con D10 sin tocar el flujo.

---

## 9. Recaudos

Orden de operaciones **no negociable**:

```
recibir → validar MIME real (magic bytes, no extensión) → rechazar doble extensión
        → antivirus → calcular SHA-256 → cifrar → persistir en storage nacional
        → registrar fila → auditar
```

El antivirus corre **antes** de persistir. Si el motor no está disponible, la carga **se rechaza**; no se acepta "persistir ahora y escanear luego".

- Formatos: PDF, JPG, PNG. Validación por *magic bytes*, no por nombre.
- **Compresión en el cliente** antes de subir (`canvas` + `toBlob`), con límite de lado mayor y calidad configurable.
- Múltiples archivos por recaudo; el estado del recaudo es "recibido" o "pendiente". **La validación SI/NO es del analista**, en el backoffice.
- Almacenamiento en **object storage nacional** (D8). Adaptador `AlmacenArchivos` con implementación local para desarrollo.

Envío con recaudos faltantes → estado `recaudos_incompletos` + enlace activo para completarlos.

---

## 10. Declaraciones, evidencia y PDF

### 10.1 Textos versionados

Cada declaración aceptada guarda **FK al texto exacto y su versión**, no un booleano. Al cambiar un texto se inserta una versión nueva; las aceptaciones previas siguen apuntando a la que el cliente realmente leyó. Sin esto no hay valor probatorio.

Las seis casillas obligatorias: las cuatro del formato + PEP + consentimiento de datos.

### 10.2 Evidencia de aceptación

Al pulsar enviar, en la misma transacción:

1. Se serializa el expediente completo de forma **canónica** (JSON con claves ordenadas) → `SHA-256`.
2. Se registran IP, user-agent y **timestamp del servidor** (nunca del cliente).
3. Se enlaza la verificación OTP.
4. Se sella todo en `evidencias_aceptacion` y se audita.

```go
type FirmaElectronicaProvider interface {
    Sellar(ctx context.Context, exp Expediente) (Evidencia, error)
    Verificar(ctx context.Context, ev Evidencia) (bool, error)
}
```

Implementación actual: `OtpEvidenceProvider`. Al contratar el PSC (D9) basta añadir `PscProvider`; el flujo no cambia.

### 10.3 PDF

Generación **en servidor** (no viaja al cliente). Plantilla **declarativa** que refleja las secciones del WMA-F-FIN-001, con encabezado (Dirección de Finanzas, Confidencial, código, revisión) y pie *"Corporación Token Pago POS, C.A. — RIF: J-40242154-0 — Ecosistema Digital Wamma"*.

No incluye bloque de firma del analista ni huella dactilar; en su lugar, referencia a la evidencia de aceptación.

> **Fidelidad pendiente.** Sin el formato original (D12) la plantilla se construye desde la descripción del encargo. `CA-SC.10` **no puede darse por cumplido** hasta contrastar con el documento real.

---

## 11. Seguridad y cumplimiento

| Control | Implementación |
|---|---|
| **PII fuera de logs** | Tipo `Sensible[T]` cuyo `String()`/`MarshalJSON()` devuelven `***`. Imposible registrarlo por accidente. Prueba que recorre los logs de la suite buscando patrones de cédula, RIF, cuenta y correo |
| **Cifrado de campo** | Envelope encryption vía `platform/crypto`; clave de datos por registro, clave maestra fuera de la BD |
| **Auditoría** | `INSERT` únicamente, con permiso revocado + trigger |
| **Límite de tasa** | Redis, por IP y por documento (`_bidx`), sobre creación, OTP y envío |
| **Anti-bot** | Desafío en el envío final. Proveedor a definir; **no puede ser un servicio extranjero que reciba PII** (Principio II) |
| **Transporte** | TLS obligatorio; `HSTS`; cookies `HttpOnly`/`Secure`/`SameSite=Strict` |
| **Cabeceras** | CSP estricta, `X-Content-Type-Options`, `Referrer-Policy: no-referrer` |
| **Soberanía** | Archivos y base en infraestructura nacional. Ningún hiperescalador extranjero |

---

## 12. Adaptadores para insumos ausentes

Cada insumo pendiente queda detrás de una interfaz con implementación de desarrollo, para no bloquear el avance ni improvisar el dato:

| Insumo | Interfaz | Implementación provisional |
|---|---|---|
| D10 OTP | `CanalOTP` | `LogOTP` (código enmascarado en log) |
| D11 Antivirus | `EscanerArchivos` | `EscanerRechazaTodo` en producción; permisivo solo en desarrollo local |
| D13 Bancos | `catalogo_bancos` | Tabla **vacía**; la validación de cuenta falla hasta sembrarla |
| D14 Ubicaciones | `catalogo_ubicaciones` | Tabla **vacía**; el paso 2 no permite avanzar hasta sembrarla |
| D15 `lead_id` | `FuenteLead` | Campo libre trazado, sin interpretación |
| D9 PSC | `FirmaElectronicaProvider` | `OtpEvidenceProvider` |
| — Scoring | `ScoringProvider` | `NoopScoringProvider` |

**Criterio deliberado:** ante insumo ausente, el sistema **falla de forma visible**, no adopta un valor plausible. Un catálogo de bancos inventado es peor que un formulario que no avanza, porque el error viaja silencioso hasta producción.

---

## 13. Frontend

- **Rendimiento:** ruta con `React.lazy`, un *chunk* por paso, imágenes comprimidas en cliente, sin librería de PDF en el navegador. Presupuesto verificado en CI: falla si supera 200 KB comprimido.
- **Accesibilidad WCAG 2.1 AA:** etiquetas asociadas, foco visible, errores anunciados con `aria-live`, áreas táctiles ≥ 44 px, contraste verificado por medición —el mismo método que se usó para el hero, no estimación visual.
- **Mobile-first** con base de 360 px.
- **Español de Venezuela** en toda la interfaz.
- Cada paso abre con una línea que explica **por qué** se piden esos datos.
- Estado del asistente con `useReducer` + máquina de pasos; **cero PII en almacenamiento del navegador**.

---

## 14. Plan de pruebas

| Nivel | Alcance | Meta |
|---|---|---|
| **Unitarias** | `validation/` y `calc/` | **100 % de ramas** (exigido por `CA-SC.12`) |
| **Unitarias** | Máquina de estados: toda transición válida e inválida | 100 % de transiciones |
| **Integración** | Cada endpoint, con validación de servidor **ante cliente manipulado** (`CA-SC.3`) | — |
| **Integración** | Inmutabilidad: `UPDATE`/`DELETE` sobre `auditoria` deben fallar | — |
| **Seguridad** | Barrido de logs buscando PII (`CA-SC.9`) | Cero coincidencias |
| **Seguridad** | DTO de salida no expone ratio ni capacidad de pago | — |
| **E2E** | Recorrido completo de los 8 pasos en viewport móvil | — |
| **E2E** | Abandono en paso 4 → reanudación → datos intactos (`CA-SC.2`) | — |
| **Accesibilidad** | `axe` en los 8 pasos + navegación por teclado | Cero violaciones AA |
| **Rendimiento** | Presupuesto de JS en CI | < 200 KB gz |

---

## 15. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **El formato original nunca llega** | `CA-SC.10` no verificable | Plantilla declarativa: adaptarla es cambiar datos, no código |
| **Divergencia de validación cliente/servidor** | Rechazos incoherentes | Reglas sintácticas en JSON compartido (§6) |
| **Anti-bot extranjero** | Violación del Principio II | Se exige proveedor que no reciba PII, o desafío propio |
| **`float` colándose en cálculo monetario** | Violación del Principio V | *Lint* que rechaza `float` en `calc/` |
| **Parámetros sin cargar en producción** | Simulador sin tasa | El simulador se deshabilita con mensaje explícito; nunca asume |
| **Talento Go escaso** | Retraso | Riesgo ya reconocido en `architecture-plan.md` §1 |

---

## 16. Trazabilidad

**Constitución:** I (cumplimiento), II (soberanía), III (PI de WAMMA), V (multi-moneda, decimal exacto, auditoría inmutable), VI (seguridad transversal), VII (SDD).

**Arquitectura:** respeta el stack y el monolito modular de `../000-overview/architecture-plan.md`; añade el paquete `creditapp` con la justificación de §2.1.

**Módulos:** alimenta **006**; consume **005** y **002**; se apoya en **001**.

**Pendientes que siguen abiertos:** los de `spec.md` §13. Este plan **no resuelve ninguno**: los aísla tras parámetros y adaptadores para que su llegada no obligue a reescribir.

---

*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
