# WAMMA Platform — Arquitectura, Estructura del Proyecto y Lógica de Programación

**Clasificación:** Confidencial · **Versión:** 2.0 · **Fecha:** Septiembre 2026  
**Empresa:** WAMMA by Token Pago POS  

---

## 1. Visión General del Proyecto

**WAMMA** es una plataforma venezolana orientada a la certificación, venta y financiamiento de vehículos usados. Toma como referencia operativa el modelo de **Kavak**, adaptándolo a la realidad cambiaria y logística de Venezuela.

### Principios Fundacionales No Negociables
1. **Protección del dato personal y trazabilidad:** El sistema protege datos sensibles de terceros (cédulas, ingresos, cuentas bancarias) por ingeniería, con bitácora inmutable y control de accesos desde el primer módulo.
2. **Desarrollo Guiado por Especificaciones (SDD):** Ningún componente de software se codifica sin una especificación técnica aprobada previamente.
3. **Integridad Financiera (Ledger Sagrado):** Contabilidad de partida doble inmutable, registro multi-moneda (USD con contrapartida en VES a tasa oficial BCV) y prohibición absoluta de números de coma flotante (`float`/`double`) para cálculos monetarios.

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
├── backend/             # Monolito modular Spring Boot (Java 21) + Supabase + Flyway
├── frontend-web/        # Aplicación Web React 19 + TypeScript (maqueta visual y flujos)
├── AGENTS.md            # Reglas transversales compartidas por asistentes IA
├── CLAUDE.md            # Guía rápida para Claude Code
├── ARRANQUE.md          # Procedimiento para inicializar la maqueta localmente
└── README.md            # Descripción del repositorio y contexto global
```

---

### 📂 `.specify/` — El Marco Constitucional
Alberga las directrices de mayor jerarquía del proyecto.
* **`memory/constitution.md`**: Define la "Constitución" del sistema. Es vinculante y tiene precedencia sobre cualquier solicitud o decisión de diseño. Establece la protección del dato personal, el ledger inmutable y la portabilidad de infraestructura.

---

### 📂 `specs/` — Especificaciones por Módulo (SDD)
Cada carpeta contiene los requerimientos, diagramas, casos de uso y contratos de datos antes de pasar a código:
* **`000-overview/`**:
  * `architecture-plan.md`: Arquitectura técnica transversal (monolito modular en Spring Boot/Java 21, Supabase PostgreSQL, Redis, React/Flutter).
  * `data-model.md`: Modelo de datos relacional detallado y entidades de negocio.
  * `tasks-build-order.md`: Matriz de dependencias y orden de construcción secuencial (MVP).
* **Módulos funcionales:**
  * **`001-nucleo-cumplimiento-seguridad/`**: Trazabilidad, bitácora inmutable de auditoría y control de accesos.
  * **`004-inspeccion-240-puntos/`**: Peritaje técnico (mecánica, estética, legalidad de seriales y papeles INTT).
  * **`005-catalogo-venta/`**: Marketplace, filtros avanzados, separación y reserva de vehículos.
  * **`006-motor-riesgo-scoring-aml/`**: Motor de scoring crediticio y prevención de legitimación de capitales.
  * **`007-fintech-pagos-ledger/`**: Libro mayor contable en partida doble, pasarelas de pago y planes de financiamiento.
  * **`009-tablero-tesoreria/`**: Monitoreo de liquidez, conciliación de cuentas y posición cambiaria.
  * **`010-crm-comercial/`**: Seguimiento comercial de prospectos, embudo e interacciones.
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

### 📂 `backend/` — Monolito Modular en Spring Boot (Java 21)
Diseñado bajo principios de **Clean Architecture** (Arquitectura Limpia). Usa **Maven** como sistema de build y **Flyway** para migraciones de esquema.

```
backend/
├── pom.xml
├── src/main/java/com/wamma/
│   ├── WammaApplication.java     # Entry point
│   ├── platform/                  # Auth, RBAC, auditoría, cifrado (módulo 001)
│   ├── creditapp/                 # Solicitud de crédito WMA-F-FIN-001
│   ├── inspection/                # Inspección 240 puntos (módulo 004)
│   ├── catalog/                   # Catálogo y reservas (módulo 005)
│   ├── risk/                      # Scoring, AML (módulo 006)
│   ├── ledger/                    # Partida doble inmutable (módulo 007)
│   ├── payments/                  # C2P, deuda, amortización (módulo 007)
│   ├── treasury/                  # Inventario, conciliación (módulo 009)
│   └── crm/                       # Seguimiento comercial (módulo 010)
├── src/main/resources/
│   ├── application.yml
│   └── db/migration/              # Migraciones Flyway (ledger: append-only)
├── src/test/java/com/wamma/
└── _legacy-go/                    # Código Go archivado (referencia para reescritura)
```

#### Principios del Backend:
1. **`BigDecimal` para aritmética financiera:**
   * El dinero se opera con `BigDecimal` con escala fija (2 decimales para montos, 8+ para tasas intermedias). Alternativamente, `long` en céntimos para operaciones que no requieren decimales.
   * La cuota por sistema francés usa `BigDecimal` con `MathContext.DECIMAL128` para precisión arbitraria en potencias `(1 + i)^n`.
   * La última cuota de la tabla de amortización absorbe el residuo de redondeo para que el saldo final sea exactamente cero.
2. **Tipo monetario multi-moneda:**
   * Bloquea sumas directas entre USD y VES a menos que se aplique la tasa oficial BCV correspondiente.
3. **Supabase como PostgreSQL administrado:**
   * No se usan Auth, Storage ni RLS nativos de Supabase. Toda lógica la maneja Spring Boot.
   * Portable a Supabase self-hosted o cualquier PostgreSQL estándar.
4. **Migraciones Flyway:**
   * Versionadas e idempotentes. Cambios al esquema del ledger son append-only (nunca ALTER/DROP).

---

### 📂 `frontend-web/` — Interfaz Web (React 19 + TypeScript + Vite)
Estructura desacoplada y orientada a componentes que permite simular la experiencia completa de usuario previa a la integración definitiva con APIs:

```
frontend-web/src/
├── tokens/        # Variables CSS de diseño (colores, espaciados, bordes, tipografía)
├── components/    # Componentes atómicos reusables (Botones, Modales, Tarjetas)
├── screens/       # Pantallas que cubren los flujos de cliente y admin
├── mocks/         # Datos simulados con estructura idéntica a las entidades reales
├── state/         # Contextos React para estado ligero (favoritos, simuladores)
├── types/         # Definiciones TypeScript de entidades y contratos
└── validacion/    # Validaciones en el cliente homologadas con el backend
```

#### Pantallas Implementadas (`screens/`):
* **`C0_Home.tsx`**: Página de inicio, propuesta de valor, acceso a catálogo.
* **`C1_Catalogo.tsx`**: Inventario de vehículos con filtros por marca, precio, kilometraje y transmisión.
* **`C2_FichaVehiculo.tsx`**: Ficha técnica, galería fotográfica y reporte de certificación de 240 puntos.
* **`C7_Favoritos.tsx`**: Listado de vehículos guardados.
* **`C9_SolicitudCredito.tsx`**: Formulario integral paso a paso de solicitud de crédito.
* **`C10_Financiamiento.tsx`**: Simulador de cuotas y opciones de financiamiento.

---

## 3. Principios de Buenas Prácticas Aplicados

| Dimensión | Enfoque de WAMMA | Beneficio Clave |
| :--- | :--- | :--- |
| **Arquitectura de Software** | Monolito Modular con paquetes por dominio en Spring Boot (Java 21) | Evita la complejidad prematura de microservicios manteniendo límites de dominio limpios y módulos desacoplados. |
| **Ingeniería Financiera** | `BigDecimal` con escala fija y `long` en céntimos | Elimina descuadres contables y errores de acumulación de centavos propios del `float`/`double`. |
| **Gobernanza del Código** | Spec-Driven Development (SDD) | Todo cambio de código tiene origen en un spec documentado y acordado con negocio. |
| **Design System Centralizado** | Tokens de diseño CSS (`src/tokens/`) | Mantiene coherencia visual estricta con el manual de marca y facilita mantenimiento o temas futuros. |
| **Seguridad** | Principio de Menor Privilegio, Cifrado en Reposo/Tránsito y Ledger Inmutable | Protección del dato personal y trazabilidad completa de operaciones financieras. |

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
