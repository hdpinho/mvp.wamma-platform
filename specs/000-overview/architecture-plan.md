# 000 · Plan de arquitectura (el CÓMO) — MVP WAMMA

**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**

> El QUÉ y el POR QUÉ están en los `spec.md` de cada módulo. Este documento concentra el CÓMO técnico transversal a todo el MVP. Vinculado a `.specify/memory/constitution.md`.

## 1. Stack tecnológico (adoptado)

| Pieza | Tecnología | Rol |
|---|---|---|
| Web pública + panel interno | **React** | Vitrina (catálogo) y centro de mando |
| App móvil | **Flutter** | iOS + Android desde una sola base |
| Backend / motor | **Go (Golang)**, monolito modular | Cerebro: cotización, crédito, cuotas, cobranza |
| Base de datos | **PostgreSQL** | Almacén central, incluido el ledger |
| Caché y colas | **Redis** | Consultas frecuentes y tareas asíncronas (notificaciones) |
| Archivos | **Object storage nacional** | Fotos/videos de inspección y documentos OCR |

**Sobre Go:** mejor opción para el núcleo financiero por velocidad y estabilidad. Riesgo conocido: menos talento local. Mitigación: equipo senior reducido para el core crítico; agentes de IA (Antigravity/Claude Code) para trabajo rutinario; donde el rendimiento extremo no sea indispensable, se puede recurrir a tecnologías de talento abundante.

## 2. Monolito modular: organización por dominios

Un solo sistema bien ordenado en módulos, fácil de construir rápido y de partir en servicios más adelante. Paquetes por dominio, alineados a los módulos 001–009:

```
backend/
├── internal/
│   ├── platform/        # auth, RBAC, auditoría, cifrado, config (módulo 001)
│   ├── creditapp/       # solicitud digital de crédito WMA-F-FIN-001 (validación y cálculo)
│   ├── inspection/      # inspección 240 puntos + certificación (módulo 004)
│   ├── catalog/         # catálogo de vehículos publicados y reservas (módulo 005)
│   ├── risk/            # scoring, AML, decisión de crédito (módulo 006)
│   ├── ledger/          # partida doble inmutable (módulo 007)
│   ├── payments/        # C2P / Pago Móvil, deuda, amortización (módulo 007)
│   └── treasury/        # inventario, conciliación, reportería (módulo 009)
├── api/v1/              # contratos HTTP versionados
└── migrations/          # migraciones versionadas (ledger: append-only)
```

Reglas: los módulos se comunican por interfaces explícitas; `ledger` no expone operaciones de edición/borrado; `platform` (auditoría/seguridad) es dependencia transversal.

## 3. Las cinco capas

1. **Presentación** — React (web) + Flutter (móvil).
2. **Negocio** — reglas en Go: validaciones venezolanas, crédito y cuotas fijas.
3. **Datos** — PostgreSQL + Redis + object storage nacional.
4. **Integración** — puentes a bancos y buró de crédito (sección 5).
5. **Seguridad y cumplimiento** — cifrado, RBAC, auditoría, reportería Sudeban; atraviesa todas.

## 4. Infraestructura soberana + continuidad

Decisión (Constitución, Principio II): sede principal en **centro de datos nacional Tier III** o nube privada nacional. **Sin hyperscalers extranjeros para el core.**

| Componente | Función |
|---|---|
| Servidores de aplicación | Ejecutan el backend Go; en par (failover) |
| Servidores de base de datos | Principal + réplica espejo en vivo |
| Sitio de respaldo (DR) | Segundo centro de datos nacional; póliza de continuidad |
| Respaldo (backup) | Copias periódicas cifradas, con pruebas de restauración |
| Seguridad perimetral | Firewall + WAF |
| Pasarela de integración bancaria | Canal seguro/certificado para C2P y Pago Móvil |
| Conectividad redundante | Dos proveedores de internet simultáneos |

**Aporte sobre la propuesta original de Sentient:** se añade explícitamente el **sitio DR** y la **réplica de BD**. Un solo punto de falla puede detener todos los cobros: la redundancia es innegociable.

## 5. Contratos de integración (externos)

| Integración | Para qué | Estado / nota |
|---|---|---|
| **Access Datametrics (Credicard)** | Scoring crediticio (escala 100–800, 6 variables) | Evaluado VIABLE Y RECOMENDADO. Detalle de API a confirmar en `research-dependencies.md` |
| **Bancos C2P / Pago Móvil** | Cobro de cuotas | Sujeto a convenios bancarios `[NEEDS CLARIFICATION]` |
| **Listas OFAC / PEP** | AML/CFT | Fuente de listas a confirmar; control manual documentado como transitorio |
| **Bases de antecedentes vehiculares** | Validación legal del auto publicado | Fuente oficial a confirmar `[NEEDS CLARIFICATION]` |

Patrón: cada integración detrás de una interfaz propia (adaptador), para sustituir proveedor sin reescribir el dominio.

## 6. Reglas técnicas transversales (de la Constitución)

- **Multi-moneda:** montos en USD con equivalencia BCV; cada operación registra moneda **y** tasa aplicada. Nunca `float` para dinero (decimal de precisión fija o entero de menor unidad).
- **Idempotencia** en toda operación de pago.
- **Auditoría** inmutable de transacciones financieras y cambios de estado de inventario.
- **Cifrado** en reposo y tránsito; **2FA** para roles administrativos.
- **API** `/v1` versionada; migraciones idempotentes; ledger append-only.

## 7. Plan de pruebas

- Pruebas unitarias obligatorias para: cálculo de cuotas/amortización, asientos de partida doble, decisiones de scoring/AML.
- Pruebas de integración para cada adaptador externo (con simuladores cuando el proveedor no esté disponible).
- Pruebas de restauración de respaldo (continuidad).

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
