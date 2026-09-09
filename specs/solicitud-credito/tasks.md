# SC · Desglose de tareas — Solicitud de crédito en autoservicio

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Agosto 2026**
**Referencias:** `./spec.md` (QUÉ) · `./plan.md` (CÓMO)
**Estado:** Draft para validación del Product Owner

> Tareas ejecutables, ordenadas por dependencia. Cada una declara qué la desbloquea y cómo se verifica.
> **Nada de esto se implementa** mientras `spec.md` §13 tenga bloqueantes abiertos (Constitución, Principio VII).

---

## 0. Puerta de entrada

Antes de abrir la primera tarea deben cerrarse estos puntos. No son deuda técnica: son condiciones de arranque.

| Bloqueante | Bloquea | Estado |
|---|---|---|
| **S1–S7** de `plan.md` §1 confirmados por el Product Owner | Todo | Pendiente de validación |
| **D13** lista de bancos | O4, F4 | Ausente |
| **D14** estados y municipios | O4, F3 | Ausente |
| **D10** proveedor OTP | B7, F8 | Ausente — mitigado con `LogOTP` |
| **D11** motor antivirus | B6 | Ausente — mitigado con rechazo por defecto |
| **D12** formato WMA-F-FIN-001 | B9 | Ausente — impide verificar `CA-SC.10` |
| **L6** política de privacidad | B8, F8 | Ausente |
| **L7** dueño de textos legales versionados | B8 | Ausente |

**Se puede avanzar sin ellos** en las olas 1 y 2: el plan los aísla tras adaptadores y catálogos vacíos. Lo que **no** se puede es dar el módulo por terminado.

---

> **Avance al 2026-08-25:** completadas O1, N1 y N3, ambas con 100 % de cobertura de ramas.
> El resto de la Ola 3 en adelante requiere `internal/platform` (cifrado, auditoría), que es el
> **módulo 001** y aún no existe. Ver `backend/README.md`.

## Ola 1 · Cimientos (sin dependencias externas)

### O1 — Estructura del paquete ✅ HECHO
Crear `backend/internal/creditapp/` con la organización de `plan.md` §2.2. Definir interfaces vacías de `domain/`.
**Verifica:** compila; `risk` no importa `creditapp` (prueba de arquitectura con `go list`).

### O2 — Migraciones base
Nueve tablas de `spec.md` §10 + `textos_legales`, `parametros_financieros`, `catalogo_bancos`, `catalogo_ubicaciones`. UUID v7, `NUMERIC(18,2)` para dinero, columnas `BYTEA` + `_bidx` para campos sensibles.
**Depende de:** O1.
**Verifica:** migración sube y baja limpia; ningún campo monetario es `float`.

### O3 — Inmutabilidad a nivel de motor
`REVOKE UPDATE, DELETE` + trigger `abortar_mutacion()` sobre `auditoria`, `textos_legales` y `evidencias_aceptacion`.
**Depende de:** O2.
**Verifica:** `UPDATE` y `DELETE` sobre las tres tablas fallan desde el usuario de aplicación. **Prueba de integración obligatoria.**

### O4 — Catálogos y parámetros
Estructura de `catalogo_bancos`, `catalogo_ubicaciones` y `parametros_financieros`, con *seeds* **vacíos**. Endpoint `GET /v1/.../catalogos/{tipo}` con caché Redis.
**Depende de:** O2. **Bloqueada para datos por:** D13, D14.
**Verifica:** con tabla vacía, el endpoint devuelve lista vacía y el paso correspondiente no permite avanzar. **No se siembra ningún dato inventado.**

---

## Ola 2 · Núcleo puro (máxima cobertura, cero I/O)

### N1 — Validadores venezolanos ✅ HECHO · 100 % de cobertura
Módulo `validation/` independiente: cédula, RIF (**módulo 11 completo**), derivación cédula→RIF, cuenta bancaria, móvil, fijo, correo (formato + MX), fecha de nacimiento, monto.
**Depende de:** O1.
**Verifica:** **100 % de cobertura de ramas** (`CA-SC.12`). Casos de dígito verificador inválido para las cinco letras de RIF.

### N2 — Reglas sintácticas compartidas
JSON de reglas consumido por Go y por el frontend, para que cliente y servidor no diverjan (`plan.md` §6).
**Depende de:** N1.
**Verifica:** prueba que compara el resultado de ambos motores sobre el mismo corpus de casos.

### N3 — Motor de cálculo financiero ✅ HECHO · 100 % de cobertura
`calc/` con **`math/big` (sin dependencias externas)**: totales, capacidad de pago, ratio cuota/ingreso, cuota por sistema francés y tabla de amortización. Portado desde `mocks/financiamiento.ts` como fuente única.
**Depende de:** O1.
**Verifica:** **100 % de ramas**. Casos límite: ingresos cero, capacidad negativa, plazo mínimo, redondeo de última cuota. *Lint* que rechaza `float` en el paquete.

### N4 — Máquina de estados
Tabla de transiciones de `plan.md` §5, con validación de origen **y** de actor.
**Depende de:** O1.
**Verifica:** toda transición válida e inválida cubierta; transición no declarada se rechaza **y se audita** (`CA-SC.13`).

### N5 — Tipo `Sensible[T]`
Envoltorio cuyo `String()` y `MarshalJSON()` devuelven `***`.
**Depende de:** O1.
**Verifica:** imposible serializar el valor real; prueba que lo intenta y falla.

---

## Ola 3 · Persistencia y API

### B1 — Repositorios
`store/` sobre PostgreSQL. Cifrado de campo vía `platform/crypto` con envelope encryption; `_bidx` con HMAC determinista.
**Depende de:** O2, O3, N5.
**Verifica:** los campos sensibles quedan ilegibles en la BD; la búsqueda por `_bidx` funciona sin descifrar.

### B2 — Borrador y autoguardado
`POST /` (crea + token de sesión), `GET /{id}`, `PATCH /{id}/paso/{n}` idempotente por `(solicitud, paso, versión)`.
**Depende de:** B1, N1, N4.
**Verifica:** `PATCH` repetido no duplica; validación de servidor rechaza payload manipulado (`CA-SC.3`).

### B3 — Numeración de solicitud
Secuencia anual, formato `WMA-SC-AAAA-NNNNNN`, con `UNIQUE`.
**Depende de:** B1.
**Verifica:** sin colisiones bajo concurrencia (prueba con escrituras paralelas).

### B4 — Bitácora de auditoría
Registro append-only de creación, modificación, envío y descarga, con actor, IP, valores anterior y nuevo.
**Depende de:** O3, B1.
**Verifica:** cada operación deja traza; ninguna traza contiene PII en claro.

### B5 — Límite de tasa y anti-bot
Redis, por IP **y** por documento (`_bidx`), sobre creación, OTP y envío. Desafío anti-bot en el envío.
**Depende de:** B1.
**Verifica:** se corta al superar el umbral. **El proveedor anti-bot no puede recibir PII** (Principio II).

### B6 — Recaudos
Orden estricto de `plan.md` §9: MIME real por *magic bytes* → rechazo de doble extensión → antivirus → SHA-256 → cifrado → storage nacional → fila → auditoría. Interfaz `EscanerArchivos` y `AlmacenArchivos`.
**Depende de:** B1, B4. **Bloqueada por:** D11, D8.
**Verifica:** ejecutable renombrado a `.pdf` se rechaza; con antivirus caído la carga **se rechaza**, no se difiere.

### B7 — OTP
Emisión y verificación: 6 dígitos, 5 min, 3 intentos, 3 reenvíos/hora. Se guarda **hash**, nunca el código. Interfaz `CanalOTP` con `WhatsAppOTP`, `SmsOTP` y `LogOTP`.
**Depende de:** B1, B5. **Bloqueada por:** D10.
**Verifica:** códigos caducan; se agotan intentos; el código nunca aparece en logs.

### B8 — Textos legales y declaraciones
`textos_legales` versionada + `declaraciones` con FK a la versión aceptada. Las seis casillas obligatorias.
**Depende de:** O3, B1. **Bloqueada por:** L6, L7.
**Verifica:** cambiar un texto crea versión nueva; las aceptaciones previas siguen apuntando a la que el cliente leyó.

### B9 — Envío y evidencia
`POST /{id}/enviar`: exige OTP verificado + 6 declaraciones; serializa canónicamente → SHA-256; sella IP, user-agent, timestamp **de servidor** y referencia OTP; transiciona estado; audita. Interfaz `FirmaElectronicaProvider` con `OtpEvidenceProvider`.
**Depende de:** B2, B4, B7, B8, N4.
**Verifica:** `CA-SC.5`, `CA-SC.7` (marca PEP), `CA-SC.8`. Sin OTP o sin declaraciones, rechaza. Recaudos faltantes → `recaudos_incompletos` (`CA-SC.6`).

### B10 — Reanudación
`POST /reanudar`: token de un solo uso + OTP.
**Depende de:** B2, B7.
**Verifica:** el token solo no abre el expediente; se invalida tras el primer uso.

### B11 — Consulta pública de estado
`GET /estado/{numero}` con verificación. Devuelve **solo** el estado.
**Depende de:** B3.
**Verifica:** no filtra PII ni señales de decisión.

### B12 — DTO de salida blindado
Serialización explícita en todas las respuestas; nunca la entidad de dominio.
**Depende de:** B2.
**Verifica:** prueba que **falla** si `ratio_cuota_ingreso` o `capacidad_pago` aparecen en cualquier respuesta.

### B13 — Generación de PDF
Plantilla declarativa con secciones del formato, encabezado y pie. Sin bloque de analista ni huella. `GET /{id}/pdf` auditado.
**Depende de:** B9. **Bloqueada para verificación por:** D12.
**Verifica:** el PDF se genera y descarga. **`CA-SC.10` queda pendiente** hasta contrastar con el original.

### B14 — Vencimiento de borradores
Trabajo periódico `borrador → vencida` con umbral de `parametros_financieros`.
**Depende de:** N4, O4. **Bloqueada por:** P11.
**Verifica:** **sin el parámetro cargado el trabajo no corre**; no asume valor.

### B15 — Interfaces diferidas
`ScoringProvider` con `NoopScoringProvider`; entrega del expediente a `risk`.
**Depende de:** B9.
**Verifica:** `creditapp` no invoca decisión de crédito; el límite se comprueba en la prueba de arquitectura de O1.

---

## Ola 4 · Frontend

### F1 — Ruta y esqueleto
`/solicitud-credito` fuera del layout autenticado. `React.lazy`, un *chunk* por paso. Estado con `useReducer`. **Cero PII en almacenamiento del navegador**.
**Depende de:** B2.
**Verifica:** no hay escrituras en `localStorage`/`sessionStorage`; presupuesto de JS medido en CI.

### F2 — Paso 0 · Vehículo y condiciones
Tarjeta del vehículo con `?vehiculo=<id>` en modo lectura, o selector, o "aún no he elegido vehículo". Monto, inicial, plazo, frecuencia. Simulador en vivo + aviso de cifra referencial.
**Depende de:** F1, O4, N3.
**Verifica:** sin parámetros cargados el simulador **se deshabilita con mensaje**.

### F3 — Pasos 1 y 2 · Identificación, ubicación y contacto
Campos de `spec.md` §7.3–7.4. RIF autoderivado editable. Estado y municipio como **listas dependientes**.
**Depende de:** F1, N1, N2, O4. **Bloqueada por:** D14.

### F4 — Pasos 3 y 5 · Laboral, referencias y banco
Comportamiento condicional por situación laboral (`RF-SC.13`). Tres referencias con teléfonos **distintos entre sí y del celular**. Banco, tipo y cuenta de 20 dígitos.
**Depende de:** F1, N1, O4. **Bloqueada por:** D13.

### F5 — Paso 4 · Balance financiero
Totales calculados, **de solo lectura**, en vivo. Concepto obligatorio si otros ingresos > 0. Advertencia informativa si la capacidad es menor que la cuota — **sin bloquear** (`RF-SC.17`).
**Depende de:** F1, N3.
**Verifica:** `CA-SC.4`. Los totales no son editables ni por manipulación del DOM.

### F6 — Paso 6 · Recaudos
Seis recaudos, múltiples archivos, vista previa, **compresión en cliente**, estado recibido/pendiente.
**Depende de:** F1, B6.

### F7 — Autoguardado y modo sin conexión
Cola de reintento y bandera visible "sin conexión — tus datos están guardados".
**Depende de:** F1, B2.
**Verifica:** con la red cortada, los datos se recuperan al volver.

### F8 — Paso 7 · Declaraciones y OTP
Seis casillas independientes con el texto vigente. Campos PEP condicionales. Enlace a política de privacidad. OTP de 6 dígitos con reenvío y contador.
**Depende de:** F1, B7, B8. **Bloqueada por:** L6, D10.

### F9 — Confirmación y consulta de estado
Número de solicitud, descarga de PDF, enlace de consulta, botón de WhatsApp. Página pública de estado.
**Depende de:** F1, B11, B13.

### F10 — Accesibilidad y marca
WCAG 2.1 AA en los 8 pasos: etiquetas, foco visible, `aria-live` para errores, áreas ≥ 44 px, contraste **medido**. Tokens vigentes, Montserrat, español de Venezuela. Línea de "por qué pedimos esto" en cada paso.
**Depende de:** F2–F9.
**Verifica:** `CA-SC.11`. `axe` sin violaciones AA; recorrido completo por teclado.

---

## Ola 5 · Verificación transversal

### V1 — Barrido de PII en logs
Prueba que recorre los logs de toda la suite buscando patrones de cédula, RIF, cuenta y correo.
**Depende de:** todas. **Verifica:** `CA-SC.9`. Cero coincidencias.

### V2 — E2E del recorrido completo
Los 8 pasos en viewport móvil hasta obtener número de solicitud.
**Depende de:** F9. **Verifica:** `CA-SC.1`.

### V3 — E2E de abandono y reanudación
Abandono en paso 4, cierre de navegador, retorno por enlace, datos intactos.
**Depende de:** B10, F7. **Verifica:** `CA-SC.2`.

### V4 — Pruebas de seguridad de servidor
Cliente manipulado contra cada endpoint; RIF con dígito inválido; transición de estado no permitida.
**Depende de:** B2, N4. **Verifica:** `CA-SC.3`, `CA-SC.13`.

### V5 — README del módulo
Configuración, variables de entorno, cómo sembrar catálogos y parámetros, cómo sustituir cada adaptador.
**Depende de:** todas.

---

## Resumen de dependencias externas

| Insumo | Tareas que bloquea | Efecto si no llega |
|---|---|---|
| D10 OTP | B7, F8 | El flujo no se puede cerrar en producción |
| D11 Antivirus | B6 | No se aceptan cargas |
| D12 Formato | B13 | `CA-SC.10` no verificable |
| D13 Bancos | O4, F4 | El paso 5 no avanza |
| D14 Ubicaciones | O4, F3 | El paso 2 no avanza |
| L6 Privacidad | B8, F8 | El paso 7 no se puede completar |
| L7 Dueño de textos | B8 | Sin trazabilidad probatoria |
| P11 Vencimiento | B14 | El trabajo periódico no corre |
| P7–P10 | F2 | El simulador queda deshabilitado |
| D8 Storage nacional | B6 | Sin destino conforme para archivos |

**Criterio uniforme:** ante insumo ausente el sistema **falla de forma visible**. Ninguna tarea adopta un valor plausible para desbloquearse.

---

## Trazabilidad

Cada tarea se ancla a un `RF-SC.x` de `spec.md` §7 y a una decisión de `plan.md`. Los criterios `CA-SC.1` … `CA-SC.13` quedan cubiertos por: V2 (1), V3 (2), V4 (3, 13), F5 (4), B9 (5, 6, 7, 8), V1 (9), B13 (10 — pendiente D12), F10 (11), N1 y N3 (12).

---

*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
