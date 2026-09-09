# WAMMA Platform — Arquitectura, Estructura del Proyecto y Lógica de Programación

**Clasificación:** Confidencial · **Versión:** 1.0 · **Fecha:** Septiembre 2026  
**Empresa:** WAMMA by Token Pago POS  
**Referencia:** Sudeban · Fintech Automotriz Venezolana  

---

## 1. Visión General del Proyecto

**WAMMA** es una plataforma fintech venezolana orientada a la compra, certificación, venta, financiamiento y suscripción (Opción a Compra - OCN) de vehículos usados. Toma como referencia operativa el modelo de **Kavak**, adaptándolo estrictamente a la realidad jurídica, cambiaria y regulatoria de Venezuela bajo la supervisión de la **Sudeban**.

### Principios Fundacionales No Negociables
1. **Cumplimiento y Soberanía:** El sistema cumple con normativas Sudeban y prevención AML desde el primer día. Los datos y el core operativo residen en infraestructura nacional venezolana.
2. **Desarrollo Guiado por Especificaciones (SDD):** Ningún componente de software se codifica sin una especificación técnica aprobada previamente.
3. **Integridad Financiera (Ledger Sagrado):** Contabilidad de partida doble inmutable, registro multi-moneda (USD con contrapartida en VES a tasa oficial BCV) y prohibición absoluta de números de coma flotante (`float32`/`float64`) para cálculos monetarios.

---

## 2. Mapa y Desglose de Carpetas

A continuación se detalla la función y el contenido de cada directorio de la solución:

```
wamma-platform/
├── .specify/            # Núcleo constitucional y reglas supremas del sistema
├── specs/               # Especificaciones funcionales y técnicas por módulo (SDD)
├── .agents/             # Reglas, directivas y workflows para agentes IA (Antigravity)
├── .claude/             # Configuración de comandos y entorno para Claude Code
├── docs/                # Documentación corporativa, manual de marca y guías
├── backend/             # Monolito modular en Go (núcleo financiero y validaciones)
├── frontend-web/        # Aplicación Web React 19 + TypeScript (maqueta visual y flujos)
├── AGENTS.md            # Reglas transversales compartidas por asistentes IA
├── CLAUDE.md            # Guía rápida para Claude Code
├── ARRANQUE.md          # Procedimiento para inicializar la maqueta localmente
└── README.md            # Descripción del repositorio y contexto global
```

---

### 📂 `.specify/` — El Marco Constitucional
Alberga las directrices de mayor jerarquía del proyecto.
* **`memory/constitution.md`**: Define la "Constitución" del sistema. Es vinculante y tiene precedencia sobre cualquier solicitud o decisión de diseño. Establece la soberanía de los datos, el ledger inmutable, los estándares bancarios y la prohibición de asumir requisitos no especificados.

---

### 📂 `specs/` — Especificaciones por Módulo (SDD)
Cada carpeta contiene los requerimientos, diagramas, casos de uso y contratos de datos antes de pasar a código:
* **`000-overview/`**:
  * `architecture-plan.md`: Arquitectura técnica transversal (monolito modular en Go, base de datos PostgreSQL, colas Redis, React/Flutter).
  * `data-model.md`: Modelo de datos relacional detallado y entidades de negocio.
  * `tasks-build-order.md`: Matriz de dependencias y orden de construcción secuencial (MVP).
* **Módulos funcionales:**
  * **`001-nucleo-cumplimiento-seguridad/`**: Trazabilidad, bitácora inmutable de auditoría y cumplimiento Sudeban.
  * **`002-onboarding-kyc/`**: Verificación de identidad venezolana (Cédula, RIF, biometría, listas PEP).
  * **`003-captacion-kprice/`**: Algoritmo de tasación y ofertas automáticas de compra de vehículos usados.
  * **`004-inspeccion-240-puntos/`**: Peritaje técnico (mecánica, estética, legalidad de seriales y papeles INTT).
  * **`005-catalogo-venta/`**: Marketplace, filtros avanzados, separación y reserva de vehículos.
  * **`006-motor-riesgo-scoring-aml/`**: Motor de scoring crediticio y prevención de legitimación de capitales.
  * **`007-fintech-pagos-ledger/`**: Libro mayor contable en partida doble, pasarelas de pago y planes de financiamiento.
  * **`008-gps-corte-ignicion/`**: Integración con telemetría telemática e inmovilización remota del activo financiado.
  * **`009-tablero-tesoreria/`**: Monitoreo de liquidez, conciliación de cuentas y posición cambiaria.
  * **`solicitud-credito/`**: Especificación integral del flujo de solicitud de crédito digital de cara al cliente.

---

### 📂 `.agents/` y `.claude/` — Gobierno y Automatización de IA
Aseguran que las herramientas de asistencia sigan los estándares del proyecto:
* **`.agents/rules/`**: Directivas como `wamma-core.md`, que restringen a los modelos de lenguaje (ej. obligar a usar tipos de precisión fija para montos, respetar la legislación venezolana y evitar cambios destructivos).
* **`.agents/workflows/`**: Procesos de desarrollo guiados (ej. `sdd-pipeline.md`, `maqueta-cliente.md`).
* **`.claude/`**: Comandos y ajustes locales para Claude Code.
* **`AGENTS.md` / `CLAUDE.md`**: Puntos de entrada leídos por los asistentes al arrancar cada sesión.

---

### 📂 `docs/` — Documentación y Activos de Marca
* **`marca/`**: Manual de identidad visual de WAMMA, especificación de color (#D17438, escala de grises oscuros y fondos claros), logotipo en versiones para fondos oscuros/claros y tipografía corporativa Montserrat.

---

### 📂 `backend/` — Monolito Modular en Go
Diseñado bajo principios de **Clean Architecture** (Arquitectura Limpia). Destaca por **no tener dependencias de librerías externas** (`go.mod` estándar), garantizando portabilidad, velocidad y mínima superficie de ataque.

```
backend/
├── go.mod
├── README.md
└── internal/
    ├── platform/
    │   └── sensible/      # Limpieza explícita en memoria de secretos y datos sensibles
    └── creditapp/
        ├── domain/        # Modelos del dominio y tipo monetario seguro
        ├── validation/    # Validaciones con algoritmos venezolanos oficiales
        └── calc/          # Motor financiero exacto (sin punto flotante)
```

#### Componentes del Backend:
1. **`internal/creditapp/calc`**:
   * **Enteros en Céntimos:** El dinero se almacena y opera como enteros (ej. $10.00 se representa como `1000`). Sumas y restas son 100% exactas.
   * **`math/big.Rat`:** Las operaciones de amortización bajo el sistema francés usan números racionales de precisión arbitraria. No hay degradación por redondeo en potencias `(1 + i)^n`.
   * **Absorción del Residuo en la Última Cuota:** Cualquier remanente fraccionario se absorbe en la cuota final para que el saldo resultante sea exactamente cero.
2. **`internal/creditapp/domain`**:
   * Tipo `Dinero` multi-moneda que bloquea sumas directas entre USD y VES a menos que se aplique la tasa oficial BCV correspondiente.
3. **`internal/creditapp/validation`**:
   * Validación formal de Cédula (V/E), RIF con verificación de Módulo 11 (J, G, V, E), teléfonos nacionales venezolanos (0412, 0414, 0424, 0416, 0426) y cuentas bancarias de 20 dígitos validadas mediante checksum oficial.
4. **`internal/platform/sensible`**:
   * Rutinas seguras para sobrescribir con ceros (`zeroing`) claves y credenciales en memoria para mitigar volcados o fugas de RAM.

---

### 📂 `frontend-web/` — Interfaz Web (React 19 + TypeScript + Vite)
Estructura desacoplada y orientada a componentes que permite simular la experiencia completa de usuario previa a la integración definitiva con APIs:

```
frontend-web/src/
├── tokens/        # Variables CSS de diseño (colores, espaciados, bordes, tipografía)
├── components/    # Componentes atómicos reusables (Botones, Modales, Tarjetas)
├── screens/       # Pantallas que cubren los flujos de cliente (C0 a C9)
├── mocks/         # Datos simulados con estructura idéntica a las entidades reales
├── state/         # Contextos React para estado ligero (favoritos, simuladores)
├── types/         # Definiciones TypeScript de entidades y contratos
└── validacion/    # Validaciones en el cliente homologadas con el backend
```

#### Pantallas Implementadas (`screens/`):
* **`C0_Home.tsx`**: Página de inicio, propuesta de valor, acceso a catálogo y tasación.
* **`C1_Catalogo.tsx`**: Inventario de vehículos con filtros por marca, precio, kilometraje y transmisión.
* **`C2_FichaVehiculo.tsx`**: Ficha técnica, galería fotográfica y reporte de certificación de 240 puntos.
* **`C3_VendeTuAuto.tsx`**: Flujo de cotización y captación de vehículos con motor K-Price.
* **`C4_OnboardingKYC.tsx`**: Carga de documentos de identidad, selfie y datos personales.
* **`C5_SolicitudFinanciamiento.tsx`**: Calculadora y simulador de cuotas de crédito automotriz.
* **`C6_MiPanel.tsx`**: Panel privado del cliente con estatus de trámites y pagos.
* **`C7_Favoritos.tsx`**: Listado de vehículos guardados y alertas de variación de precio.
* **`C8_Suscripcion.tsx`**: Esquema de suscripción y opción a compra de vehículos (OCN).
* **`C9_SolicitudCredito.tsx`**: Formulario integral paso a paso de solicitud de crédito para evaluación de riesgo.

---

## 3. Principios de Buenas Prácticas Aplicados

| Dimensión | Enfoque de WAMMA | Beneficio Clave |
| :--- | :--- | :--- |
| **Arquitectura de Software** | Monolito Modular con paquetes `internal/` en Go | Evita la complejidad prematura de microservicios manteniendo límites de dominio limpios y módulos desacoplados. |
| **Ingeniería Financiera** | Aritmética racional (`big.Rat`) y enteros en céntimos | Elimina descuadres contables y errores de acumulación de centavos propios del `float`. |
| **Gobernanza del Código** | Spec-Driven Development (SDD) | Todo cambio de código tiene origen en un spec documentado y acordado con negocio. |
| **Design System Centralizado** | Tokens de diseño CSS (`src/tokens/`) | Mantiene coherencia visual estricta con el manual de marca y facilita mantenimiento o temas futuros. |
| **Seguridad Bancaria** | Principio de Menor Privilegio, Sanitización de Memoria y Ledger Inmutable | Cumple con los requerimientos de auditoría de Sudeban y la legislación contra legitimación de capitales. |

---

## 4. Instrucciones para Abrir o Exportar a Google Docs

Si deseas visualizar o editar este documento en **Google Docs**:

### Opción A (Recomendada · Copiar con Formato Enriquecido):
1. Abre este archivo en tu navegador o previsualizador Markdown del IDE.
2. Selecciona todo el texto previsualizado (`Ctrl + A`) y cópialo (`Ctrl + C`).
3. Ve a [Google Docs](https://docs.new), crea un documento nuevo y pega el contenido (`Ctrl + V`). Los títulos, listas, tablas y negritas se mantendrán intactos.

### Opción B (Importación Directa en Google Drive):
1. Abre [Google Drive](https://drive.google.com).
2. Sube este archivo `docs/arquitectura-y-estructura-del-proyecto.md`.
3. Haz clic derecho sobre el archivo subido $\rightarrow$ **Abrir con** $\rightarrow$ **Documentos de Google**. Google Docs convertirá automáticamente la sintaxis Markdown en un documento nativo.
