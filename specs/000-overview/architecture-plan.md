# 000 · Plan de arquitectura (el CÓMO) — MVP WAMMA

**Clasificación:** Confidencial · **Rev.:** 2 · **Septiembre 2026**

> El QUÉ y el POR QUÉ están en los `spec.md` de cada módulo. Este documento concentra el CÓMO técnico transversal a todo el MVP. Vinculado a `.specify/memory/constitution.md`.

## 1. Stack tecnológico (adoptado)

| Pieza | Tecnología | Rol |
|---|---|---|
| Web pública + panel interno | **React** (Vite + TypeScript) | Vitrina (catálogo) y centro de mando |
| App móvil | **Flutter** | iOS + Android desde una sola base |
| Backend / motor | **Spring Boot (Java 21)**, monolito modular | Cerebro: cotización, crédito, cuotas, cobranza |
| Base de datos | **Supabase Cloud** (PostgreSQL administrado) | Almacén central, incluido el ledger. Portable a self-hosted |
| Migraciones | **Flyway** | Esquema versionado; cambios de ledger append-only |
| Caché y colas | **Redis** | Consultas frecuentes y tareas asíncronas (notificaciones) |
| Archivos | **Object storage** | Fotos/videos de inspección y documentos |

**Sobre Supabase:** se usa exclusivamente como **PostgreSQL administrado**. No se emplean sus servicios de Auth, Storage ni la API de datos (PostgREST); la autenticación, la autorización y el almacenamiento de archivos los maneja Spring Boot. Row Level Security queda **activo y sin políticas** en todas las tablas solo como barrera de fondo: deniega a todo rol que no sea el dueño del esquema o el de la aplicación, y los roles públicos de Supabase no tienen privilegios (`database-schema-design.md` §1.5). Es PostgreSQL estándar declarado en las migraciones, así que la portabilidad se mantiene: si se migra a Supabase self-hosted o a cualquier PostgreSQL, el cambio sigue siendo solo la cadena de conexión.

**Sobre Java/Spring Boot:** ecosistema maduro, amplio talento disponible, excelente soporte para seguridad (Spring Security), persistencia (Spring Data JPA) y testing. Ideal para el dominio financiero del proyecto.

## 2. Monolito modular: organización por dominios

Un solo sistema bien ordenado en módulos, fácil de construir rápido y de partir en servicios más adelante. Paquetes por dominio, alineados a los módulos 001–010:

```
backend/
├── src/main/java/com/wamma/
│   ├── WammaApplication.java         # Entry point
│   ├── platform/        # auth, RBAC, auditoría, cifrado, config (módulo 001)
│   ├── creditapp/       # solicitud digital de crédito WMA-F-FIN-001
│   ├── inspection/      # inspección 240 puntos + certificación (módulo 004)
│   ├── catalog/         # catálogo de vehículos publicados y reservas (módulo 005)
│   ├── risk/            # scoring, AML, decisión de crédito (módulo 006)
│   ├── ledger/          # partida doble inmutable (módulo 007)
│   ├── payments/        # C2P / Pago Móvil, deuda, amortización (módulo 007)
│   ├── treasury/        # inventario, conciliación, reportería (módulo 009)
│   └── crm/             # seguimiento comercial de prospectos (módulo 010)
├── src/main/resources/
│   ├── application.yml
│   └── db/migration/    # migraciones Flyway (ledger: append-only)
├── src/test/java/com/wamma/
├── pom.xml
└── _legacy-go/          # código Go archivado para referencia (se elimina tras reescritura)
```

Reglas: los módulos se comunican por interfaces explícitas; `ledger` no expone operaciones de edición/borrado; `platform` (auditoría/seguridad) es dependencia transversal.

## 3. Las cinco capas

1. **Presentación** — React (web) + Flutter (móvil).
2. **Negocio** — reglas en Java/Spring Boot: validaciones venezolanas, crédito y cuotas fijas.
3. **Datos** — Supabase (PostgreSQL) + Redis + object storage.
4. **Integración** — puentes a bancos y buró de crédito (sección 5).
5. **Seguridad y cumplimiento** — cifrado, RBAC, auditoría; atraviesa todas.

## 4. Infraestructura y continuidad

Decisión (Constitución v2.0.0, Principio II): la elección de proveedor es **decisión de ingeniería y de negocio**. Se admiten proveedores extranjeros. Exigido: portabilidad, contenedores, infraestructura como código.

| Componente | Función |
|---|---|
| Supabase Cloud | PostgreSQL administrado, con portabilidad a self-hosted |
| Servidor de aplicación | Ejecuta Spring Boot; desplegable en contenedores |
| Redis | Caché y colas asíncronas |
| Object storage | Fotos/videos de inspección y documentos |
| Respaldo (backup) | Copias periódicas cifradas, con pruebas de restauración |
| Seguridad perimetral | Firewall + WAF |
| Pasarela de integración bancaria | Canal seguro/certificado para C2P y Pago Móvil |

**Portabilidad:** la arquitectura completa es portable a cualquier proveedor. Spring Boot se empaqueta en contenedores Docker; Supabase se puede auto-alojar; Redis es estándar. No hay dependencia dura de ningún proveedor cloud.

## 5. Contratos de integración (externos)

| Integración | Para qué | Estado / nota |
|---|---|---|
| **Access Datametrics (Credicard)** | Scoring crediticio (escala 100–800, 6 variables) | Evaluado VIABLE Y RECOMENDADO. Detalle de API a confirmar en `research-dependencies.md` |
| **Bancos C2P / Pago Móvil** | Cobro de cuotas | Sujeto a convenios bancarios `[NEEDS CLARIFICATION]` |
| **Listas OFAC / PEP** | AML/CFT | Fuente de listas a confirmar; control manual documentado como transitorio |
| **Bases de antecedentes vehiculares** | Validación legal del auto publicado | Fuente oficial a confirmar `[NEEDS CLARIFICATION]` |

Patrón: cada integración detrás de una interfaz propia (adaptador), para sustituir proveedor sin reescribir el dominio.

## 6. Reglas técnicas transversales (de la Constitución)

- **Multi-moneda:** montos en USD con equivalencia BCV; cada operación registra moneda **y** tasa aplicada. Nunca `float`/`double` para dinero: se usa `BigDecimal` con escala fija o `long` en céntimos.
- **Idempotencia** en toda operación de pago.
- **Auditoría** inmutable de transacciones financieras y cambios de estado de inventario.
- **Cifrado** en reposo y tránsito; **2FA** para roles administrativos.
- **API** `/v1` versionada; migraciones Flyway idempotentes; ledger append-only.

## 7. Plan de pruebas

- Pruebas unitarias obligatorias para: cálculo de cuotas/amortización, asientos de partida doble, decisiones de scoring/AML.
- Pruebas de integración para cada adaptador externo (con simuladores cuando el proveedor no esté disponible).
- Pruebas de restauración de respaldo (continuidad).

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
