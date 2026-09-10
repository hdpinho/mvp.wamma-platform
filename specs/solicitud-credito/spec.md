# SC · Solicitud de crédito en autoservicio (digitalización del WMA-F-FIN-001)

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Agosto 2026**
**Pilar Kavak:** Financiamiento propio (Kavak Capital → Token Pago Capital)
**Depende de:** 001 (auditoría, roles, cifrado); 002 (KYC); 005 (catálogo, para el vehículo); 006 (recibe la solicitud)
**Estado:** Draft para validación del Product Owner — **no implementar**

> Spec del QUÉ y el POR QUÉ. El CÓMO va en `plan.md`. Principios en `../../.specify/memory/constitution.md`.
> Este documento **no resuelve** ninguna decisión de política comercial ni legal. Ver §13.

---

## 0. Advertencias previas a la aprobación

Cuatro puntos deben resolverse **antes** de pasar a `plan.md`. Los tres primeros son contradicciones entre el encargo y lo ya establecido en el repositorio; el cuarto es un insumo ausente.

### 0.1 Moneda: el encargo contradice la Constitución

El encargo indica que *"la unidad de cuenta del proyecto es EUR indexado a tasa oficial BCV"*. La Constitución, Principio V, establece: *"precios en **USD** con equivalencia a tasa BCV"*, y todo el repositorio —`data-model.md`, módulo 007, la maqueta— está construido sobre USD.

No resuelvo esta contradicción. La Constitución manda sobre todo (CLAUDE.md), así que **este spec queda redactado con la moneda como parámetro**, no con un valor fijo. Ver `[NEEDS CLARIFICATION: P12]`.

### 0.2 Puerta de KYC: ¿solicitud pública sin identidad verificada?

El encargo describe una pantalla **pública de autoservicio**, sin asistencia. El módulo 002 establece que *"el nivel [de KYC] determina qué acciones se habilitan"* y que financiar exige nivel **verificado**. La maqueta actual bloquea C5 para usuarios de nivel básico.

Hay tres lecturas posibles y cambian el diseño de raíz. Ver `[NEEDS CLARIFICATION: P13]`.

### 0.3 Relación con el módulo 006

El módulo 006 ya declara la entidad `solicitud_credito` y el **RF-006.1** (registro de solicitud). Este módulo produce esa misma entidad desde el canal público.

Mi lectura: **este módulo es la capa de captación del 006**, no un módulo paralelo, y por tanto no debe duplicar su entidad sino alimentarla. Confirmar antes de continuar. Ver `[NEEDS CLARIFICATION: P14]`.

### 0.4 El formato WMA-F-FIN-001 no está en el repositorio

Busqué el formato en papel y no existe en el árbol. El §10 del encargo exige que el PDF *"replique el contenido y la estructura de secciones"* del formato, y el criterio de aceptación §11.10 exige fidelidad.

**No puedo garantizar fidelidad contra un documento que no he visto.** Este spec se apoya en la descripción del encargo, que puede estar incompleta. Se requiere el archivo original. Ver `[NEEDS CLARIFICATION: D12]`.

### 0.5 Nomenclatura de la carpeta

El repositorio numera los módulos (`001-` … `009-`). El encargo pide `specs/solicitud-credito/`. Uso la ruta indicada, pero si se adopta la numeración este documento pasaría a `specs/010-solicitud-credito/` y los identificadores `RF-SC.x` / `CA-SC.x` se renumerarían a `RF-010.x` / `CA-010.x`.

---

## 1. Objetivo

Permitir que un cliente complete **desde su teléfono y sin asistencia** la solicitud de financiamiento que hoy se llena a mano en el formato **WMA-F-FIN-001**, y que esa solicitud llegue al analista como un expediente digital completo, auditable y con evidencia probatoria de aceptación.

## 2. Por qué importa

El formato en papel es el cuello de botella entre el interés del cliente y el ingreso de WAMMA: obliga a presencia física, se llena con letra ilegible, se pierde, y no deja rastro de qué aceptó exactamente el solicitante ni cuándo.

Digitalizarlo ataca tres frentes a la vez:

- **Comercial.** El cliente llega desde WhatsApp y decide en caliente. Cada visita presencial exigida es una venta que se enfría.
- **Regulatorio.** Como sujeto obligado no bancario (UNIF/ONCDOFT/LOCDOFT, supervisión consolidada de Sudeban vía Token Pago POS), WAMMA debe poder demostrar qué declaró el cliente, con qué texto y en qué momento. Una firma en papel escaneada no lo prueba mejor que un hash con OTP verificado; lo prueba peor.
- **Operativo.** Los recaudos llegan digitalizados y clasificados desde el origen, en vez de reconstruirse a mano.

## 3. Alcance

### Incluye (esta entrega)

- Pantalla pública `/solicitud-credito`, asistente de **8 pasos**, mobile-first.
- Persistencia de borrador en servidor y reanudación por enlace + verificación.
- Carga de recaudos por el solicitante, con antivirus y compresión en cliente.
- Declaraciones legales versionadas, declaración PEP y consentimiento de datos.
- Cierre con **OTP** y registro de evidencia de aceptación.
- Página de confirmación y página pública de consulta de estado.
- API, modelo de datos, validaciones venezolanas y bitácora de auditoría.
- Generación del **PDF de la solicitud**, fiel al WMA-F-FIN-001.

### No incluye (explícitamente fuera)

- **Panel del analista** (revisión, aprobación, checklist de recaudos). Módulo aparte; el modelo de datos y los estados quedan preparados para él.
- **Integración con Access Datametrics.** Solo se define la interfaz `ScoringProvider` con una implementación `NoopScoringProvider`.
- **Motor de decisión crediticia.** Esta pantalla no aprueba ni rechaza.
- **Firma electrónica con PSC** acreditado ante SUSCERTE. Solo se define `FirmaElectronicaProvider` con `OtpEvidenceProvider`.
- Contrato, tabla de amortización definitiva y desembolso (módulo 007).

## 4. Correcciones obligatorias frente al formato en papel

El papel no se traslada literalmente. Estas nueve correcciones son **vinculantes**:

| # | En el papel | En la pantalla | Motivo |
|---|---|---|---|
| 1 | Huella dactilar (pulgar derecho) | **Eliminada.** Sustituida por OTP verificado + evidencia técnica | No existe equivalente web |
| 2 | Checklist SI/NO "uso exclusivo Wamma" | **Se invierte.** El solicitante carga; la validación es del analista y vive en el backoffice. Aquí solo "recibido / pendiente" | Separación de funciones |
| 3 | "Firma del Solicitante" + "Firma y Sello del Analista" | El bloque del analista **no aparece** en la vista pública. La firma se sustituye por aceptación explícita + OTP + evidencia | §8 |
| 4 | "Monto Solicitado ($ / Bs)" | Monto + **moneda + tasa BCV + fecha de la tasa** | Principio V |
| 5 | "TOTAL INGRESOS" / "TOTAL EGRESOS" como campos a llenar | **Calculados**, solo lectura, en vivo | Evita inconsistencia |
| 6 | Destino: Usado / Nuevo / Leasing | **Solo "Vehículo Usado"** | WAMMA no comercializa nuevos ni leasing en esta fase; dejar las opciones abiertas introduce riesgo de sustancia sobre forma |
| 7 | "RIF Personal" capturado aparte | **Autoderivado** de la cédula (módulo 11), con corrección manual | Reduce error de transcripción |
| 8 | Sin declaración PEP ni consentimiento de datos | **Se agregan**, ambos obligatorios | AML/CFT y protección de datos |
| 9 | Sin vínculo con vehículo ni lead | Se agregan `vehiculo_id`, `lead_id`, `kyc_id` | Trazabilidad comercial |

## 5. Actores y roles

| Actor | Rol en este módulo |
|---|---|
| **Solicitante** | Completa el asistente. Único actor con acceso a la pantalla pública |
| **Analista de crédito** | *Fuera de alcance.* Consume el expediente desde el backoffice futuro |
| **Oficial de Cumplimiento (AML)** | *Fuera de alcance.* Recibe las marcas PEP para debida diligencia ampliada |
| **Sistema** | Calcula totales, deriva RIF, versiona declaraciones, emite OTP, sella evidencia, audita |

## 6. Historias de usuario

- Como **solicitante que llega desde WhatsApp**, quiero completar la solicitud desde mi teléfono sin ir a una sede, para no perder el interés en el camino.
- Como **solicitante que desconfía**, quiero saber **por qué** me piden cada dato, para completar el formulario sin abandonarlo.
- Como **solicitante con conexión intermitente**, quiero que mis datos no se pierdan si se me cae el 4G o cierro el navegador, para retomar donde iba.
- Como **solicitante sin todos los papeles a la mano**, quiero enviar mi solicitud y completar los recaudos después, para no quedar bloqueado.
- Como **Oficial de Cumplimiento**, quiero que toda solicitud PEP quede marcada automáticamente, para aplicar debida diligencia ampliada.
- Como **WAMMA ante el regulador**, quiero poder demostrar el texto exacto que aceptó cada cliente y cuándo, para sostener la validez del expediente.

## 7. Requisitos funcionales (RF)

### 7.1 Asistente — estructura

- **RF-SC.1** Asistente de **8 pasos** con barra de progreso persistente, un grupo lógico de campos por pantalla en móvil, y navegación hacia atrás **sin pérdida de datos**.
- **RF-SC.2** **Autoguardado** al salir de cada paso, con reintento ante fallo de red y aviso visible de "sin conexión — tus datos están guardados".
- **RF-SC.3** Cada paso muestra una línea breve que explica **por qué** se solicitan esos datos.

### 7.2 Paso 0 — Vehículo y condiciones

- **RF-SC.4** Si la URL trae `?vehiculo=<id>`, se muestra la tarjeta del vehículo (foto, marca, modelo, año, precio) **en modo lectura**. Si no, selector del catálogo o la opción **"aún no he elegido vehículo"**.
- **RF-SC.5** Captura de monto solicitado (+ moneda), inicial aportado, **plazo** (6/12/18/24/36 meses) y **frecuencia de pago** (semanal/quincenal/mensual).
- **RF-SC.6** **Simulador de cuota en vivo**. La tasa **no se codifica en duro**: se lee de la tabla de parámetros financieros.
- **RF-SC.7** El simulador muestra siempre: *"Cifra referencial. La cuota definitiva depende de la evaluación crediticia y se confirma en el contrato."*

### 7.3 Paso 1 — Identificación

- **RF-SC.8** Campos: primer apellido\*, segundo apellido, primer nombre\*, segundo nombre, tipo y número de documento (V/E/Pasaporte)\*, RIF personal (autoderivado, editable), nacionalidad, estado civil, fecha de nacimiento\*, lugar de nacimiento\*, nivel académico, cargas familiares (entero ≥ 0), condición de vivienda\*.
- **RF-SC.9** El **RIF se autoderiva** de la cédula (V + número + dígito verificador módulo 11) y permite corrección manual.

### 7.4 Paso 2 — Ubicación y contacto

- **RF-SC.10** Campos: dirección de habitación\*, punto de referencia, ciudad/municipio\*, estado\*, código postal, teléfono habitación, teléfono celular\*, correo electrónico\*.
- **RF-SC.11** Estado y municipio son **listas dependientes**, nunca texto libre.

### 7.5 Paso 3 — Información laboral

- **RF-SC.12** Campos: situación laboral\*, empresa o negocio\*, RIF de la empresa, cargo\*, antigüedad en años\* y meses\*, dirección de la empresa\*, teléfono de oficina, nombre del jefe directo.
- **RF-SC.13** **Comportamiento condicional:**
  - *Independiente / Firma Personal:* se oculta "jefe directo"; "empresa o negocio" se re-etiqueta como "nombre de la firma personal o actividad".
  - *Jubilado / Pensionado:* se ocultan cargo, jefe directo y dirección de empresa; "antigüedad" pasa a "años de pensión".

### 7.6 Paso 4 — Balance financiero mensual

- **RF-SC.14** Ingresos: sueldo/ingreso mensual\*, otros ingresos comprobables, concepto de otros ingresos (**obligatorio si el monto > 0**).
- **RF-SC.15** Egresos: alquiler/hipoteca, alimentación y servicios\*, pagos de deudas y créditos.
- **RF-SC.16** **Calculados y de solo lectura**, actualizados en vivo: total ingresos, total egresos, capacidad de pago.
- **RF-SC.17** Si la capacidad de pago resulta **menor que la cuota simulada**, se muestra una advertencia **informativa** y se permite continuar. *La pantalla pública nunca rechaza: esa decisión es del analista.*

### 7.7 Paso 5 — Referencias y datos bancarios

- **RF-SC.18** Tres referencias tipadas —personal 1, personal 2, familiar— cada una con nombre\*, parentesco\* y teléfono\*.
- **RF-SC.19** Datos bancarios: institución\*, tipo de cuenta (Corriente/Ahorros)\*, número de cuenta de **20 dígitos**\*.
- **RF-SC.20** Los tres teléfonos de referencia deben ser **distintos entre sí y distintos del celular del solicitante**.

### 7.8 Paso 6 — Recaudos

- **RF-SC.21** Carga de los **seis recaudos** del formato original: (1) cédula o pasaporte vigente, (2) RIF actualizado con domicilio actual, (3) constancia de trabajo original o certificación de ingresos firmada por contador, (4) estado de cuenta bancario de los últimos **seis meses**, (5) recibo de servicio público a nombre del solicitante o contrato de arrendamiento, (6) dos referencias personales con copia de C.I. y teléfono.
- **RF-SC.22** Formatos aceptados: **PDF, JPG, PNG**. Compresión de imágenes **en el cliente** antes de subir. Vista previa. **Múltiples archivos por recaudo**.
- **RF-SC.23** Se permite **enviar con recaudos faltantes**: el expediente entra en `recaudos_incompletos` y se genera un enlace para completarlos después.

### 7.9 Paso 7 — Declaraciones y cierre

- **RF-SC.24** Se reproducen **textualmente** las cuatro declaraciones del formato, cada una con casilla independiente y obligatoria: *Veracidad de la Información*, *Autorización de Consulta a Centrales de Riesgo*, *Origen de Fondos* y *Compromiso de Pago*. El texto íntegro vigente vive en el anexo de textos legales versionados.
- **RF-SC.25** **Declaración PEP:** si el solicitante es o ha sido PEP en los últimos cinco años, o tiene vínculo familiar o de asociación cercana con una PEP, se habilitan campos de cargo, institución y período, y **el expediente se marca para debida diligencia ampliada**.
- **RF-SC.26** **Consentimiento de tratamiento de datos personales**, obligatorio, con enlace a la política de privacidad.
- **RF-SC.27** **Cierre con OTP** de 6 dígitos al celular declarado, canal WhatsApp con respaldo SMS. Vigencia **5 minutos**, máximo **3 intentos**, máximo **3 reenvíos por hora**.
- **RF-SC.28** La solicitud **solo se envía con OTP verificado**.

### 7.10 Confirmación y consulta

- **RF-SC.29** Número de solicitud con formato **`WMA-SC-AAAA-NNNNNN`**.
- **RF-SC.30** Descarga del **PDF** de la solicitud, enlace de consulta de estado y botón para continuar en WhatsApp.
- **RF-SC.31** Página pública de **consulta de estado** por número de solicitud + verificación.

### 7.11 Reanudación

- **RF-SC.32** Reanudación del borrador mediante **enlace con token de un solo uso + verificación por OTP**.

## 8. Reglas de negocio

### 8.1 Máquina de estados

```
borrador → enviada → recaudos_incompletos → en_analisis → { aprobada | rechazada }
borrador → desistida
enviada  → desistida
borrador → vencida        (inactividad, umbral parametrizable)
```

Desde la pantalla pública **solo** son alcanzables `borrador → enviada`, `→ desistida` y `→ vencida`. Las demás transiciones se declaran y se prueban, pero las ejecuta el backoffice futuro. Toda transición no declarada se rechaza.

### 8.2 Cálculo financiero

```
total_ingresos      = sueldo_mensual + otros_ingresos
total_egresos       = alquiler_hipoteca + alimentacion_servicios + pagos_deudas
capacidad_pago      = total_ingresos − total_egresos
ratio_cuota_ingreso = cuota_estimada / total_ingresos
```

- `ratio_cuota_ingreso` **se calcula y se almacena, pero no se muestra al solicitante**: es insumo del analista.
- Tampoco se muestra `capacidad_pago` como señal de aprobación, ni ninguna otra pista de probabilidad de decisión.
- Todo cálculo monetario usa **aritmética decimal exacta**. Prohibido el punto flotante binario (Constitución, Principio V).
- Todo importe se persiste como **`{ monto, moneda, tasa_bcv, fecha_tasa }`**.

### 8.3 Validaciones venezolanas

| Dato | Regla |
|---|---|
| **Cédula** | Prefijo `V` o `E` + 6 a 9 dígitos, sin puntos |
| **RIF** | `[VEJPG]-<8 dígitos>-<dígito verificador>` con verificación **módulo 11**. Se implementa el algoritmo, no solo la expresión regular |
| **Cuenta bancaria** | Exactamente 20 dígitos; los 4 primeros deben corresponder a un banco de la lista; se valida el dígito verificador |
| **Móvil** | `+58` + `4` + operadora (12, 14, 16, 24, 26) + 7 dígitos |
| **Fijo** | `+58` + `2` + código de área + 7 dígitos |
| **Fecha de nacimiento** | Mayor de edad. La **edad máxima al vencimiento** es parámetro configurable, sin valor por defecto |
| **Correo** | Formato + verificación de dominio con registro **MX** |
| **Montos** | Decimales positivos, dos decimales, **moneda obligatoria** |

**Toda validación se ejecuta en cliente y en servidor.** La de cliente es exclusivamente de experiencia de usuario; **la de servidor es la autoritativa**.

### 8.4 Parámetros — nada codificado en duro

Tasa de interés, plazos, montos mínimo y máximo, porcentaje mínimo de inicial, ratio máximo cuota/ingreso, edad máxima al vencimiento, vencimiento de borrador y plazo de retención documental viven en **tabla de parámetros**, no en el código. Ninguno tiene valor por defecto en esta entrega.

## 9. Requisitos no funcionales y cumplimiento

### 9.1 Seguridad y datos

- **Cifrado en reposo a nivel de campo** para cédula, pasaporte, RIF, número de cuenta bancaria y archivos de recaudos.
- **Prohibido registrar PII en logs.** Enmascarado obligatorio en toda traza, error o telemetría.
- **Bitácora de auditoría inmutable** (solo `INSERT`) de creación, modificación, envío y descarga. Sin `UPDATE` ni `DELETE` (Constitución, Principio V, por analogía con el ledger).
- **Evidencia de aceptación:** hash **SHA-256** del payload completo al momento del envío, IP, user-agent, timestamp del **servidor** y referencia de la verificación OTP. Es la sustituta probatoria de la firma manuscrita mientras no exista PSC acreditado.
- **Antivirus** sobre cada archivo antes de persistirlo. Se rechazan ejecutables y archivos con doble extensión.
- **Límite de tasa** por IP y por número de documento sobre creación de solicitudes y envío de OTP. Protección anti-bot en el envío final.
- **Nunca `localStorage` ni `sessionStorage` para PII.** El borrador vive en el servidor; el cliente solo conserva un **token opaco** de sesión.
- **Almacenamiento de archivos en infraestructura nacional.** Prohibidos los hiperescaladores extranjeros para datos de clientes (Constitución, Principio II).

### 9.2 Extensibilidad regulatoria

- `FirmaElectronicaProvider` con implementación `OtpEvidenceProvider`. Al contratar el PSC debe bastar con **añadir una implementación**, sin tocar el flujo.
- `ScoringProvider` con implementación `NoopScoringProvider`.

### 9.3 Rendimiento y red

- Funcionamiento aceptable en **3G**. Presupuesto de JavaScript inicial **< 200 KB comprimido**.
- Compresión de imágenes en el cliente antes de la carga.

### 9.4 Marca e interfaz

- Naranja WAMMA **`#D17438`** como color primario de acción; carbón **`#2B2B2B`** para texto; oscuro **`#18072B`** para fondos profundos; blanco para superficies.
- Tipografía **Montserrat** exclusivamente.
- **Prohibido el logo sobre fondo negro sólido.** Usar versión sobre transparente, o blanca sobre naranja.
- Mobile-first, base **360 px**. Áreas táctiles mínimas **44 px**.
- **WCAG 2.1 nivel AA**: contraste, foco visible, etiquetas asociadas, errores anunciados a lectores de pantalla.
- **Español de Venezuela** en toda la interfaz. Ningún texto en inglés visible al usuario.

> ⚠️ Tres valores de marca de este encargo **no coinciden** con `../000-overview/ui-design.md`, que hoy fija texto en `#1A1A18` y no contempla `#18072B`. Además, el manual de marca **sí permite** el logo sobre negro sólido en versión blanca (lámina "Positivo / Negativo"), lo que contradice la prohibición del encargo. Ver `[NEEDS CLARIFICATION: P15]`.

### 9.5 PDF

El PDF debe replicar contenido y estructura de secciones del **WMA-F-FIN-001**, incluir el encabezado (Dirección de Finanzas, clasificación Confidencial, código, revisión) y el pie: *"Corporación Token Pago POS, C.A. — RIF: J-40242154-0 — Ecosistema Digital Wamma"*.

## 10. Entidades de datos

| Entidad | Contenido | Notas |
|---|---|---|
| `solicitudes_credito` | Número, estado, `vehiculo_id`, `lead_id`, `kyc_id`, fechas, canal de origen, snapshot de tasa BCV | Cabecera. Alimenta `solicitud_credito` del módulo 006 |
| `solicitantes` | Datos personales, ubicación, laborales | **Campos sensibles cifrados a nivel de campo** |
| `balances_financieros` | Ingresos, egresos, totales calculados, moneda y tasa | |
| `referencias` | Filas tipadas: `personal_1`, `personal_2`, `familiar` | |
| `datos_bancarios` | Banco, tipo de cuenta, número **cifrado** | |
| `recaudos` | Un registro **por archivo**: tipo, ruta, hash SHA-256, tamaño, MIME, estado de validación, observación del analista | |
| `declaraciones` | Una fila por declaración aceptada, con el **texto vigente versionado**, timestamp e IP | **Nunca un booleano suelto:** hay que poder demostrar qué texto exacto aceptó el cliente |
| `evidencias_aceptacion` | Hash del payload completo, IP, user-agent, timestamp del servidor, identificador de la verificación OTP | |
| `auditoria` | Append-only: actor, acción, entidad, valor anterior y nuevo, timestamp, IP | Sin `UPDATE` ni `DELETE` |

## 11. Integraciones

| Integración | Estado | Nota |
|---|---|---|
| **Catálogo (módulo 005)** | Interna | Lectura del vehículo por `vehiculo_id` |
| **KYC (módulo 002)** | Interna | Vínculo `kyc_id` si existe expediente previo. Ver §0.2 |
| **Motor de riesgo (módulo 006)** | Interna | Recibe el expediente. Sin decisión en esta entrega |
| **OTP WhatsApp + respaldo SMS** | **Sin proveedor definido** | `[NEEDS CLARIFICATION: D10]` |
| **Antivirus de archivos** | **Sin motor definido** | `[NEEDS CLARIFICATION: D11]` |
| **Object storage nacional** | Pendiente | Reusa `D8` de `research-dependencies.md` |
| **Access Datametrics** | **Fuera de alcance** | Solo `NoopScoringProvider` |
| **PSC / SUSCERTE** | **Fuera de alcance** | Solo `OtpEvidenceProvider`. `[NEEDS CLARIFICATION: D9]` |

## 12. Criterios de aceptación (Given/When/Then)

- **CA-SC.1** Dado un usuario en móvil, cuando completa los 8 pasos, entonces recibe un número de solicitud `WMA-SC-AAAA-NNNNNN`.
- **CA-SC.2** Dado un usuario que abandona en el paso 4 y cierra el navegador, cuando vuelve por el enlace de reanudación y verifica, entonces encuentra sus datos intactos.
- **CA-SC.3** Dada una cédula cuyo RIF derivado tiene dígito verificador inválido, cuando se envía **con el cliente manipulado**, entonces el servidor la rechaza.
- **CA-SC.4** Dados los campos financieros, cuando el usuario los edita, entonces los totales se recalculan en vivo y **no son editables**.
- **CA-SC.5** Dada una solicitud sin las seis declaraciones aceptadas, sin el consentimiento de datos, o sin OTP verificado, cuando se intenta enviar, entonces el envío se rechaza.
- **CA-SC.6** Dada una solicitud enviada con recaudos faltantes, cuando se procesa, entonces queda en `recaudos_incompletos` con enlace activo para completarlos.
- **CA-SC.7** Dada una solicitud de una PEP, cuando se envía, entonces el expediente queda **marcado para debida diligencia ampliada**.
- **CA-SC.8** Dado un envío, cuando se completa, entonces la bitácora registra IP, user-agent, timestamp del servidor y hash del payload.
- **CA-SC.9** Dado cualquier log de la aplicación, cuando se inspecciona, entonces **no contiene** cédula, RIF, cuenta bancaria ni correo en claro.
- **CA-SC.10** Dado el PDF generado, cuando se compara con el WMA-F-FIN-001, entonces es fiel en contenido y estructura de secciones. *(Bloqueado por §0.4.)*
- **CA-SC.11** Dados los 8 pasos, cuando se auditan, entonces contraste y navegación por teclado cumplen **WCAG 2.1 AA**.
- **CA-SC.12** Dados los validadores venezolanos y el motor de cálculo financiero, cuando se ejecutan las pruebas, entonces la cobertura de ramas es del **100 %**.
- **CA-SC.13** Dada una transición de estado no declarada en §8.1, cuando se intenta, entonces se rechaza y se audita el intento.

## 13. Preguntas abiertas — **no resolver, preguntar**

> Ninguna de estas debe ser inventada por un agente (Constitución, Principio VII). Todas se tratan como **parámetros configurables sin valor por defecto**.

### 13.1 Contradicciones a resolver antes de `plan.md`

| # | Tema | Detalle |
|---|---|---|
| **P12** | **Moneda** | El encargo dice EUR; la Constitución y todo el repositorio dicen USD. ¿Cuál rige? Si es EUR, hay que enmendar la Constitución primero |
| **P13** | **Puerta de KYC** | ¿Puede una persona **no verificada** enviar una solicitud? Opciones: (a) público total, KYC después; (b) datos públicos pero envío exige KYC verificado; (c) público con KYC ligero en el paso 7 |
| **P14** | **Relación con 006** | ¿Este módulo es la capa de captación del 006 (mi lectura) o un módulo independiente que duplica `solicitud_credito`? |
| **P15** | **Tokens de marca** | `#2B2B2B` y `#18072B` no están en `ui-design.md`, que fija texto en `#1A1A18`. Y el manual **sí permite** logo blanco sobre negro sólido, contra lo que dice el encargo |
| **D12** | **Formato WMA-F-FIN-001** | No está en el repositorio. Sin él no puede garantizarse la fidelidad del PDF |

### 13.2 Política comercial — Nelson Rojas (Finanzas) / Astrid Castellano (Riesgo)

| # | Decisión | Nota |
|---|---|---|
| **P7** | Tasa de interés efectiva y su forma de cálculo | ⚠️ `data-model.md` ya trae **4% mensual / 48% anual** en la entidad `credito`, y `research-dependencies.md` lo repite en P6. ¿Es dato maestro vigente o marcador de posición? |
| **P8** | Ratio máximo cuota/ingreso admisible | Se calcula y almacena; el umbral es del analista |
| **P9** | Monto mínimo y máximo financiable, y porcentaje mínimo de inicial | |
| **P10** | Edad máxima del solicitante al vencimiento del crédito | Condiciona la validación de fecha de nacimiento |
| **P11** | Plazo de vencimiento de un borrador por inactividad | Condiciona la transición `borrador → vencida` |

### 13.3 Legal y regulatorio

| # | Tema | Nota |
|---|---|---|
| **L5** | Plazo de conservación documental como sujeto obligado | Parametrizar. Se relaciona con `L3` existente |
| **L6** | Texto definitivo de la política de privacidad y del aviso de tratamiento de datos | Bloquea **RF-SC.26** |
| **L7** | Textos legales versionados | ¿Quién aprueba y versiona los textos de `declaraciones`? Sin dueño no hay trazabilidad probatoria |

### 13.4 Proveedores e insumos técnicos

| # | Dependencia | Nota |
|---|---|---|
| **D9** | PSC acreditado ante SUSCERTE | Fuera de alcance, pero condiciona `FirmaElectronicaProvider` |
| **D10** | Proveedor de OTP por WhatsApp con respaldo SMS | **Bloquea RF-SC.27 y RF-SC.28**, que son el cierre del flujo |
| **D11** | Motor antivirus para archivos cargados | Bloquea RF-SC.22 |
| **D13** | **Lista oficial de bancos venezolanos** con sus 4 dígitos iniciales y el algoritmo de dígito verificador de cuenta | Bloquea la validación de cuenta bancaria. **No la voy a inventar** |
| **D14** | **Fuente de estados y municipios** de Venezuela | Bloquea RF-SC.11 (listas dependientes). Los 23 estados + Distrito Capital son públicos; el listado de municipios necesita fuente autoritativa |
| **D15** | Formato y campos del `lead_id` que llega desde WhatsApp | Bloquea la trazabilidad del canal de origen. **Ya tiene dueño:** el módulo **010** (`../010-crm-comercial/`) define el `lead_id` como `oportunidad.id`. Se cierra al completar su tarea **V3**; hasta entonces sigue siendo insumo ausente |

## 14. Métricas de éxito

- **Tasa de finalización** del asistente (enviadas / iniciadas).
- **Tasa de abandono por paso**, para detectar dónde se cae el embudo.
- Porcentaje de solicitudes que llegan con **recaudos completos** al primer envío.
- Porcentaje de reanudaciones exitosas sobre borradores abandonados.
- **100 %** de solicitudes enviadas con evidencia de aceptación registrada.
- **Cero** incidencias de PII en logs.

## 15. Trazabilidad

**Constitución:** Principio I (cumplimiento desde el día uno), II (soberanía de datos), V (multi-moneda, precisión decimal, auditoría inmutable), VI (seguridad transversal), VII (SDD: nada se implementa con `[NEEDS CLARIFICATION]` abiertos).

**Overview:** alimenta el módulo **006**; consume **005** (vehículo) y **002** (KYC); se apoya en **001** (auditoría, roles, cifrado).

**Dependencias de research:** D8 (object storage nacional), L3 (retención y residencia de datos), P6 (plazos de financiamiento) — más las nuevas D9–D15, P7–P15 y L5–L7 declaradas en §13, que deben incorporarse a `../000-overview/research-dependencies.md` al aprobarse este spec.

---

*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
