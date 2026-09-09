# Informe de QA y Seguridad — Plataforma WAMMA

**Clasificación:** Confidencial · **Rev.:** 1 · **Fecha:** 2026-09-03
**Alcance:** Revisión no destructiva (solo lectura del código fuente) del repositorio `wamma-platform`
**Autor QA:** Área de Calidad (revisión defensiva autorizada)
**Estado global de la entrega:** ⚠️ **Aprobado con observaciones** (proyecto en fase temprana: maqueta + núcleo puro)

> Este informe evalúa **lo que existe hoy**. El repositorio es mayoritariamente un artefacto de *Spec-Driven Development* (SDD): 9 especificaciones funcionales, una maqueta visual React sin backend, y un núcleo Go puro (cálculo y validación) con 100 % de cobertura. **No hay** API, base de datos, autenticación, ni servicios de red desplegados todavía. Por eso la mayoría de los hallazgos de seguridad son **preventivos** (para cuando se implemente el backend real), no vulnerabilidades explotables en runtime.

---

## 1. Resumen ejecutivo

WAMMA es la plataforma fintech de vehículos usados de **Corporación Token Pago POS**, modelo "Kavak de Venezuela" bajo regulación **Sudeban**. El repositorio sigue metodología SDD con una Constitución de ingeniería vinculante.

**Componentes con código real:**

| Componente | Tecnología | Madurez | Pruebas |
|---|---|---|---|
| `backend/` | Go 1.26 (monolito modular) | Núcleo puro: `calc` + `validation` | ✅ 100 % cobertura, `go vet` y `gofmt` limpios |
| `frontend-web/` | React 19 + Vite + TypeScript | Maqueta visual (10 pantallas, datos mock) | ❌ 0 pruebas automatizadas |

**Veredicto por área:**

- **Calidad de código Go: excelente.** Aritmética financiera exacta (`math/big`, enteros de céntimos), tipos que impiden mezclar divisas, cero dependencias externas, tests de propiedad (saldo final cero, capital reconstruye monto). Es código de referencia.
- **Calidad de código frontend: buena para una maqueta**, con deuda técnica localizada (2 `useEffect` con dependencias incompletas, cálculo con `float` — aceptable por ser maqueta y así documentado).
- **Seguridad hoy: sin vulnerabilidades explotables** (no hay superficie de red). **6 vulnerabilidades high** en dependencias npm (mayormente tooling de build), corregibles con `npm audit fix`.
- **Cumplimiento con la Constitución:** alto. El núcleo respeta los Principios V (integridad financiera) y VI (secretos fuera del repo). El `.gitignore` excluye correctamente `.env`, `*.pem`, `*.key`, `secrets/`.

**Hallazgos por severidad:**

| Severidad | QA (bugs/deuda) | Seguridad |
|---|---|---|
| Crítica | 0 | 0 |
| Alta | 0 | 1 (dependencias vulnerables) |
| Media | 2 | 2 |
| Baja | 3 | 3 |
| Informativa | — | 2 |

---

## 2. Arquitectura

### 2.1 Visión general

Plataforma con **soberanía de datos** (Principio II: prohibido alojar el *core* en hyperscalers extranjeros) y **cumplimiento Sudeban desde el día uno** (Principio I). El stack objetivo declarado:

- **Web/panel:** React · **Móvil:** Flutter · **Backend:** Go (monolito modular, paquetes por dominio)
- **BD:** PostgreSQL (ledger append-only, migraciones versionadas) · **Caché/colas:** Redis
- **API** versionada `/v1`, operaciones de dinero idempotentes y conciliables

### 2.2 Estado real construido

```
wamma-platform/
├── backend/                        # Go 1.26, sin dependencias externas
│   └── internal/creditapp/
│       ├── calc/                   # Dinero, Tasa, Cuota (francés), Amortización, Balance
│       │   ├── dinero.go           # Importes exactos en céntimos + math/big.Rat
│       │   ├── cuota.go            # Cuota sistema francés + tabla amortización
│       │   ├── balance.go          # Ingresos/egresos, capacidad de pago, ratios
│       │   └── calc_test.go        # ~30 casos, 100 % cobertura
│       └── validation/             # Validadores venezolanos (cédula, RIF, tel, correo, fecha, cuenta)
│           ├── documento.go        # RIF con dígito verificador módulo 11
│           ├── cuenta.go           # Cuenta 20 dígitos + interfaces CatalogoBancos/VerificadorCuenta
│           ├── telefono.go / correo.go / fecha.go / errores.go
│           └── *_test.go           # 100 % cobertura
├── frontend-web/                   # React 19 + Vite 8 + TS — MAQUETA VISUAL
│   └── src/
│       ├── screens/                # C0..C9: Home, Catálogo, Ficha, Vende, KYC, Financiamiento, Panel, etc.
│       ├── components/             # UI reutilizable (Boton, Campo, SimuladorCuota, ...)
│       ├── validacion/venezuela.ts # Espejo TS de los validadores Go
│       ├── mocks/                  # Datos simulados (vehículos, crédito, financiamiento)
│       └── state/favoritos.tsx     # Context API (único estado global no trivial)
├── specs/                          # 9 specs funcionales + 000-overview (arquitectura, data-model)
└── .specify/memory/constitution.md # Ley suprema del repositorio
```

### 2.3 Flujo de datos (maqueta actual)

Todo el estado vive **en memoria del navegador** y se pierde al recargar. No hay llamadas de red. El `App.tsx` mantiene estado de simulación global (tasa BCV, nivel KYC, crédito activo) y un "Panel de Simulación" flotante para demos. La solicitud de crédito (C9) implementa un asistente de 8 pasos con validación por paso, OTP simulado y confirmación con número aleatorio — **explícitamente etiquetado como maqueta sin servidor**.

### 2.4 Observaciones de arquitectura (positivas)

- **Separación por dominio limpia** en Go: `validation` no importa nada del resto (reutilizable desde módulos 002 KYC, 006 riesgo, 007 pagos).
- **Insumos ausentes declarados como interfaces** (`CatalogoBancos`, `VerificadorCuenta`) que *fallan de forma visible* (`ErrInsumoNoDisponible`) en vez de inventar datos. Excelente decisión de diseño defensivo.
- **Paridad Go ↔ TS verificada por test** (`TestCuota_ParidadConLaMaqueta`): detecta divergencias entre motor y maqueta.

---

## 3. Hallazgos de QA (bugs y deuda técnica)

### TD-01 · Frontend sin pruebas automatizadas
```
Categoría: pruebas | Severidad: Media | Prioridad: P2
Ubicación: frontend-web/ (todo el árbol src/)
Problema: 0 archivos de test. No hay Vitest/Jest/Testing Library configurado.
          La lógica de validación (venezuela.ts) y el cálculo de cuota
          (financiamiento.ts) no tienen red de seguridad automatizada.
Riesgo: Regresiones silenciosas en validación de cédula/RIF/teléfono y en el
        cálculo de cuota mostrado al usuario. La divergencia con el motor Go
        solo se detecta si alguien corre el test Go de paridad.
Recomendación: Añadir Vitest + @testing-library/react. Priorizar tests unitarios
        de src/validacion/venezuela.ts y src/mocks/financiamiento.ts espejando
        los casos del backend Go. Esfuerzo estimado: M.
```

### TD-02 · `useEffect` con dependencias incompletas en C6_MiPanel
```
Categoría: código | Severidad: Media | Prioridad: P2
Ubicación: frontend-web/src/screens/C6_MiPanel.tsx:103 y :126
Problema: eslint (react-hooks/exhaustive-deps) reporta 2 warnings: los efectos
          usan activeCredit y setActiveCredit pero no los declaran en el array
          de dependencias. El segundo efecto (:106-126) hace setActiveCredit a
          partir de activeCredit sin incluirlo en deps.
Riesgo: Stale closures y actualizaciones de estado basadas en un valor obsoleto
        de activeCredit; potencial comportamiento inconsistente al alternar mora
        desde el Panel de Simulación. En la maqueta el impacto es visual, pero
        el patrón es propenso a bucles de render si se copia al código real.
Evidencia: salida de `npx eslint .` → "2 problems (0 errors, 2 warnings)".
Recomendación: Consolidar la lógica de mora en un único efecto con deps
        completas, o derivar el estado con useMemo en lugar de sincronizarlo con
        efectos. Esfuerzo: S.
```

### TD-03 · Duplicación de la lógica de validación (Go + TypeScript)
```
Categoría: arquitectura | Severidad: Baja | Prioridad: P3
Ubicación: backend/internal/creditapp/validation/*.go  ↔  frontend-web/src/validacion/venezuela.ts
Problema: Los algoritmos (dígito verificador RIF módulo 11, operadoras móviles,
          reglas de cédula) están implementados dos veces. Ya está reconocido en
          el propio código y en el plan (§6): sustituir por un JSON de reglas
          compartido cuando exista el backend real.
Riesgo: Deriva entre cliente y servidor si una regla cambia en un solo lado
        (p. ej. una nueva operadora móvil).
Recomendación: Al construir el backend, exponer las reglas como artefacto
        compartido (JSON/generación de código) y eliminar la duplicación.
        Esfuerzo: M (diferido, ya planificado).
```

### TD-04 · Cálculo financiero en frontend usa `float`
```
Categoría: código | Severidad: Baja | Prioridad: P3
Ubicación: frontend-web/src/mocks/financiamiento.ts:40-81, App.tsx:23 (rateBCV)
Problema: calcularCuota/generarAmortizacion usan number (coma flotante), en
          contra del Principio V de la Constitución.
Estado: ACEPTABLE y documentado. El archivo declara que es maqueta visual sin
        lógica de negocio y que el backend Go usa precisión fija (confirmado).
Recomendación: No corregir en la maqueta. Garantizar que ninguna cifra de
        producción se calcule en el cliente; el frontend real debe consumir los
        importes ya calculados por el backend Go. Esfuerzo: N/A (barrera de
        arquitectura, no cambio de código).
```

### TD-05 · Parámetros financieros no confirmados en la maqueta
```
Categoría: config | Severidad: Baja | Prioridad: P3
Ubicación: frontend-web/src/mocks/financiamiento.ts:7-14 ([NEEDS CLARIFICATION])
Problema: Tasa 4 % mensual / 48 % anual, inicial 30 %, plazos — marcados como NO
          confirmados como condiciones reales de WAMMA.
Riesgo: Uso comercial con cifras no aprobadas. Ya bloqueado por marca SDD.
Recomendación: Validar contra módulo 006 (motor de riesgo) y 007 (pagos/ledger)
        antes de cualquier salida a producción. Esfuerzo: N/A (decisión de negocio).
```

---

## 4. Hallazgos de seguridad

### SEC-01 · Dependencias npm con vulnerabilidades conocidas (Alta)
```
ID: SEC-01 | Categoría OWASP: A06:2021 Componentes vulnerables y desactualizados
Severidad: Alta | Prioridad: P1
Ubicación: frontend-web/package-lock.json (transitivas)
Descripción: `npm audit` reporta 6 vulnerabilidades HIGH:
   - react-router / react-router-dom 7.12.0–7.18.1: CSRF bypass en modo RSC
     (GHSA-qwww-vcr4-c8h2). RUNTIME. La app es SPA cliente y no usa RSC, por lo
     que el vector no aplica hoy, pero la dependencia debe elevarse.
   - postcss <=8.5.22: path traversal / lectura de .map arbitrarios (build).
   - nanoid <=3.3.17: loop infinito con size negativo/cero (build/tooling).
   - browserslist <=4.28.6: crecimiento de memoria no acotado / OOM (build).
   - brace-expansion 3.0.0–5.0.8: DoS por expansión exponencial (build/tooling).
Impacto: Mayormente cadena de suministro de build (Disponibilidad del proceso de
         compilación). react-router es la única de superficie runtime.
Evidencia: salida de `npm audit` → "6 high severity vulnerabilities".
Remediación: Ejecutar `npm audit fix` (el equipo de desarrollo, NO QA). Verificar
         que no rompa la build (Vite 8 / TS 6). Incorporar `npm audit` al CI y
         bloquear PRs con vulnerabilidades High/Critical.
Referencias: GHSA-qwww-vcr4-c8h2, GHSA-r28c-9q8g-f849, GHSA-28wg-ghj8-5hjv.
```

### SEC-02 · OTP generado en el cliente con `Math.random` (Media — preventivo)
```
ID: SEC-02 | Categoría OWASP: A07:2021 Fallos de identificación y autenticación
Severidad: Media (en maqueta: Informativa) | Prioridad: P2 para el backend real
Ubicación: frontend-web/src/screens/C9_SolicitudCredito.tsx:505-523
Descripción: El "OTP" se genera con Math.floor(Math.random()*900000) en el
         navegador y se MUESTRA en pantalla para verificarlo localmente. No hay
         servidor, expiración, límite de intentos ni canal de envío real.
Impacto: En la maqueta, ninguno (está etiquetado y sin datos reales). Como
         patrón trasladado a producción sería crítico: OTP predecible, sin
         rate-limiting, verificable client-side.
Remediación (para el backend real): OTP generado en servidor con CSPRNG,
         expiración 5 min, máx. 3 intentos, envío por WhatsApp/SMS, verificación
         server-side, y sello de evidencia (hash + IP + timestamp del servidor).
         La propia NotaSimulada del código ya describe este comportamiento
         esperado — trazarlo como requisito verificable.
Referencias: CWE-330, CWE-307, OWASP ASVS V2.
```

### SEC-03 · Datos personales sensibles en formulario sin cifrado/persistencia segura definida (Media — preventivo)
```
ID: SEC-03 | Categoría OWASP: A02:2021 Fallos criptográficos / A04 Diseño inseguro
Severidad: Media (preventivo) | Prioridad: P1 al implementar módulo 001
Ubicación: frontend-web/src/screens/C9_SolicitudCredito.tsx (todo el modelo Datos)
Descripción: El formulario recolecta PII sensible y datos AML: cédula, RIF,
         fecha/lugar de nacimiento, dirección, teléfonos, datos bancarios (20
         dígitos), ingresos/egresos, referencias y declaración PEP. Hoy vive solo
         en memoria del navegador (correcto para maqueta).
Impacto: Cuando exista backend, esta superficie exige cifrado de campo en reposo,
         TLS en tránsito, RBAC con separación de funciones (Cumplimiento/Auditoría/
         Riesgo/SI), bitácora de auditoría inmutable y minimización en el cliente.
Remediación: El módulo 001 (Núcleo de Cumplimiento y Seguridad) es prerrequisito
         constitucional. El borrador debe vivir en servidor y el navegador
         conservar solo un token opaco (ya declarado como diseño objetivo en el
         propio código, líneas 46-49 y 1334-1339). QA validará esto en la entrega
         del módulo 001/002.
Referencias: Constitución Principios I y VI; LOPCYMAT/protección de datos VE;
         OWASP ASVS V6, V9.
```

### SEC-04 · RIF real de la empresa incrustado en código fuente (Baja)
```
ID: SEC-04 | Categoría OWASP: A01:2021 (exposición de dato de negocio)
Severidad: Baja | Prioridad: P3
Ubicación: frontend-web/src/validacion/venezuela.ts:49 (comentario)
Descripción: "Verificado contra el RIF de Corporación Token Pago POS, J-40242154-0."
         Un RIF es semi-público, pero incrustarlo como fixture de verificación en
         código versionado no es ideal.
Impacto: Bajo. Fuga de un identificador fiscal corporativo.
Remediación: Usar un RIF de ejemplo ficticio (o el conocido J-00000000-0) en
         comentarios y tests. Esfuerzo: S. (Cambio a proponer al equipo, no
         aplicado por QA.)
Referencias: CWE-540 (información sensible en código fuente).
```

### SEC-05 · Sin cabeceras de seguridad / CSP definidas (Baja — preventivo)
```
ID: SEC-05 | Categoría OWASP: A05:2021 Configuración de seguridad incorrecta
Severidad: Baja (preventivo) | Prioridad: P2 al desplegar
Ubicación: frontend-web/ (no hay configuración de servidor/headers)
Descripción: Al ser maqueta no hay servidor de despliegue. No existen aún CSP,
         HSTS, X-Content-Type-Options, X-Frame-Options ni política de CORS.
Impacto: N/A hoy; necesario antes del primer despliegue con backend.
Remediación: Definir CSP estricta, HSTS, y CORS restringido al dominio del panel
         en el reverse proxy nacional. QA lo verificará en el pipeline de deploy.
Referencias: OWASP Secure Headers Project.
```

### SEC-06 · Validación cliente correctamente marcada como no autoritativa (Informativa — positivo)
```
ID: SEC-06 | Severidad: Informativa
Ubicación: frontend-web/src/validacion/venezuela.ts:1-11
Observación POSITIVA: El archivo declara explícitamente que la validación de
         cliente es "solo de experiencia de usuario" y que la autoritativa es la
         del servidor. Es exactamente la postura correcta (A03 Injection / A04).
         Se documenta como buena práctica a mantener.
```

### SEC-07 · Gestión de secretos y soberanía (Informativa — positivo)
```
ID: SEC-07 | Severidad: Informativa
Observación POSITIVA:
   - .gitignore excluye .env, .env.*, *.pem, *.key, secrets/ (Constitución VI).
   - No se hallaron secretos, API keys, tokens ni credenciales embebidos en el
     código (las coincidencias del escaneo fueron la palabra "token" del nombre
     "Token Pago POS" y textos de specs, no secretos).
   - go.mod sin dependencias externas: superficie de cadena de suministro backend
     prácticamente nula.
```

---

## 5. Resultados de pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `go test ./... -cover` (backend) | ✅ **PASA** — `calc` 100.0 %, `validation` 100.0 % |
| `go vet ./...` | ✅ Limpio (sin advertencias) |
| `gofmt -l ./internal/` | ✅ Limpio (nada por formatear) |
| `npx tsc -b` (frontend) | ✅ Compila sin errores de tipos |
| `npx eslint .` (frontend) | ⚠️ 0 errores, **2 warnings** (react-hooks/exhaustive-deps en C6_MiPanel) |
| `npm audit` (frontend) | ❌ **6 vulnerabilidades High** (ver SEC-01) |
| Pruebas frontend | ❌ No existen (ver TD-01) |

La calidad de la suite Go es notable: usa **tests de propiedad** (barrido de montos/plazos verificando saldo final cero y reconstrucción del capital), tabla de casos de redondeo (incluye negativos y "justo la mitad"), y verificación de que el tipo `Dinero` impide mezclar divisas.

---

## 6. Casos de prueba propuestos

### 6.1 Frontend — Solicitud de crédito C9 (funcionales, para automatizar)

| ID | Escenario | Pasos | Resultado esperado |
|---|---|---|---|
| TC-C9-01 | Cédula inválida bloquea paso 1 | Ingresar V123 (5 dígitos) en paso Identificación → Continuar | Error "entre 6 y 9 dígitos"; no avanza |
| TC-C9-02 | RIF se deriva de la cédula | Ingresar V-12345678 | Campo RIF autocompletado con DV correcto (verificable con `digitoVerificadorRIF`) |
| TC-C9-03 | Teléfonos de referencias distintos | Repetir el mismo celular en 2 referencias | Error "teléfono repetido"; no avanza |
| TC-C9-04 | Referencia ≠ teléfono del solicitante | Usar el celular propio como referencia | Error "No puede ser tu propio teléfono" |
| TC-C9-05 | Inicial > precio | Inicial 20.000 sobre vehículo de 8.000 | Error "la inicial no puede superar el precio" |
| TC-C9-06 | Cuota supera capacidad (permitir continuar) | Egresos > ingresos con cuota alta | Aviso naranja pero **permite** avanzar (RF-SC.17) |
| TC-C9-07 | Municipio sin catálogo | Elegir estado sin municipios cargados | Bloquea con nota; no permite avanzar |
| TC-C9-08 | OTP incorrecto | Enviar OTP, ingresar código distinto | "El código no coincide" |
| TC-C9-09 | Menor de edad | Fecha de nacimiento < 18 años | "El solicitante debe ser mayor de edad" |
| TC-C9-10 | PEP exige cargo | Marcar PEP sin llenar cargo | Error "Indica el cargo o la vinculación" |
| TC-C9-11 | Estado vacío al recargar | Llenar datos y recargar página | Se pierden (maqueta) — validar que el real persista en servidor |
| TC-C9-12 | Correo con doble punto | `a..b@x.com` | "La parte local tiene puntos mal colocados" |

### 6.2 Frontend — Validadores (unitarios, espejo del backend)

- Cédula: prefijos V/E válidos, P rechazado por `validarCedula`, límites 6–9 dígitos, separadores.
- RIF: DV correcto/incorrecto para las 5 letras (V/E/J/P/G), caso DV=0 (resto 10 y 11).
- Móvil: operadoras válidas {12,14,16,24,26}, normalización +58 / 0 inicial, longitud.
- Fijo (opcional): vacío permitido, prefijo 2, longitud.
- Fecha: futuro rechazado, límite exacto de 18 años en cumpleaños (año bisiesto).
- Cuenta: exactamente 20 dígitos, extracción de código de banco.

### 6.3 Backend — Refuerzos sugeridos (además del 100 % actual)

- **Fuzzing** de `normalizarDocumento`, `normalizarTelefono` y `validarCorreo` para entradas Unicode/adversarias.
- **Prueba de paridad automatizada** Go↔TS en CI (ejecutar ambos sobre el mismo set de vectores) para blindar TD-03.
- Propiedad adicional en amortización: la suma de intereses + capital = suma de cuotas (conciliación).

### 6.4 Seguridad (para las próximas entregas con backend)

- Control de acceso: IDOR sobre número de solicitud (¿puede un usuario consultar la solicitud de otro?).
- OTP: rate-limiting, expiración, reintentos, no verificable en cliente (SEC-02).
- Inyección: parametrización de queries en repositorios PostgreSQL (cuando existan).
- Auditoría: verificar inmutabilidad append-only del ledger (Principio V) y bitácora por transacción (Principio VI).
- RBAC: separación de funciones Cumplimiento/Auditoría/Riesgo/SI (Principio I).

---

## 7. Recomendaciones priorizadas

| # | Acción | Responsable | Prioridad | Esfuerzo |
|---|---|---|---|---|
| 1 | `npm audit fix` y agregar `npm audit` (High/Critical) al CI (SEC-01) | Desarrollo | P1 | S |
| 2 | Introducir Vitest + Testing Library; portar casos de §6.2 (TD-01) | Desarrollo | P2 | M |
| 3 | Consolidar los `useEffect` de C6_MiPanel con deps completas (TD-02) | Desarrollo | P2 | S |
| 4 | Al arrancar módulo 001: cifrado de campo, RBAC, auditoría antes de persistir PII (SEC-03) | Arquitectura | P1 | L |
| 5 | Especificar OTP server-side seguro como requisito verificable (SEC-02) | Producto/Dev | P2 | M |
| 6 | Reemplazar el RIF real por uno ficticio en código/tests (SEC-04) | Desarrollo | P3 | S |
| 7 | Definir CSP/HSTS/CORS del panel antes del primer despliegue (SEC-05) | Infra | P2 | M |
| 8 | Automatizar paridad Go↔TS de reglas de validación (TD-03) | Desarrollo | P3 | M |
| 9 | Confirmar parámetros financieros contra módulos 006/007 (TD-05) | Negocio | P3 | — |

---

## 8. Estado acumulado

Primera revisión (línea base). No hay Sprints previos con los que comparar. Próximos hitos a auditar según `tasks-build-order.md`:

- **Ola 0 / Módulo 001** — Núcleo de Cumplimiento y Seguridad (RBAC, cifrado de campo, auditoría). **Prerrequisito constitucional**; es donde se materializará la mayoría de los controles de seguridad hoy preventivos (SEC-02, SEC-03).
- **Ola 3** — repositorios, API `/v1`, OTP, recaudos, PDF: primera superficie de red real; requerirá revisión AppSec completa (OWASP Top 10 sobre endpoints).

---

## 9. Notas de método y limitaciones

- Revisión **no destructiva**: no se modificó código fuente. Los cambios propuestos se describen para que los implemente el equipo de desarrollo.
- Pruebas ejecutadas: suite Go (con cobertura), `go vet`, `gofmt`, `tsc`, `eslint`, `npm audit`. No se ejecutaron pruebas dinámicas (DAST) porque no hay servicio desplegable.
- No se auditó `node_modules/` línea por línea; la evaluación de dependencias se basa en `npm audit`.
- Los hallazgos "preventivos" no son vulnerabilidades explotables hoy; se registran para trazabilidad hacia las entregas con backend.

---
*WAMMA · Confidencial · Informe de QA y Seguridad Rev. 1 · No constituye asesoría legal ni financiera.*
