# Backend WAMMA

**Clasificación:** Confidencial · **Rev.:** 2 · **Septiembre 2026**

Monolito modular en Spring Boot (Java 21), conforme a `../specs/000-overview/architecture-plan.md`.

## Estado actual

**Solo esqueleto.** El proyecto Spring Boot tiene la estructura base lista
(entry point, configuración, dependencias Maven, migración Flyway placeholder),
pero **no contiene código de negocio todavía**. El frontend sigue operando
con maquetas y datos simulados.

El código Go que existía previamente (`creditapp/calc`, `creditapp/validation`,
`platform/sensible`) está archivado en `_legacy-go/` como referencia para
la reescritura en Java cuando se implemente cada módulo.

## Stack

| Pieza | Tecnología |
|---|---|
| Framework | Spring Boot 3.3 |
| JDK | 21 (LTS) |
| Build | Maven |
| Base de datos | Supabase Cloud (PostgreSQL administrado) |
| Migraciones | Flyway |
| Caché/colas | Redis |
| Seguridad | Spring Security (se configura en módulo 001) |

## Requisitos

- **JDK 21** o superior.
- **Maven 3.9+** (o usar el wrapper `mvnw` cuando se agregue).
- PostgreSQL accesible (Supabase Cloud o local para desarrollo).
- Redis (opcional en esta etapa; requerido al implementar caché/colas).

## Comandos

```sh
mvn compile                    # compilar
mvn test                       # pruebas
mvn spring-boot:run            # arrancar localmente
mvn verify                     # compilar + pruebas + verificación
```

## Configuración

Variables de entorno para conexión a Supabase y Redis:

```sh
SUPABASE_DB_URL=jdbc:postgresql://<host>:<port>/<db>
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=<secreto>
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Nunca** colocar secretos en `application.yml` ni en el repositorio
(Constitución, Principio VI).

## Decisiones de arquitectura

### Supabase como PostgreSQL administrado

Se usa Supabase **exclusivamente** como base de datos PostgreSQL administrada.
No se emplean Auth, Storage ni Row Level Security nativos de Supabase.
Toda la lógica de autenticación, autorización y almacenamiento de archivos
la maneja Spring Boot. Esto garantiza portabilidad: migrar a self-hosted
o a cualquier PostgreSQL es solo cambiar la cadena de conexión.

### Aritmética financiera con BigDecimal

El Principio V de la Constitución prohíbe el punto flotante para dinero.
La estrategia en Java:

- **`BigDecimal` con escala fija** para montos (2 decimales) y tasas
  intermedias (escala mayor).
- **`MathContext.DECIMAL128`** para cálculos intermedios como `(1+i)^n`
  en la amortización por sistema francés.
- **`long` en céntimos** como alternativa para operaciones que no requieren
  decimales (comparaciones, sumas simples).
- La última cuota de la tabla de amortización **absorbe el residuo de
  redondeo** para que el saldo final sea exactamente cero.

### Migraciones Flyway append-only para el ledger

Las tablas del ledger (módulo 007) son **inmutables por diseño**. Las
migraciones de Flyway para estas tablas solo pueden ser `CREATE` o `ALTER
TABLE ... ADD COLUMN`. Prohibido `ALTER TABLE ... DROP`, `DELETE` o `UPDATE`
sobre asientos contables.

## Estructura de paquetes (planificada)

```
src/main/java/com/wamma/
├── WammaApplication.java
├── platform/        # módulo 001 — auth, RBAC, auditoría, cifrado
├── creditapp/       # solicitud de crédito WMA-F-FIN-001
├── inspection/      # módulo 004 — inspección 240 puntos
├── catalog/         # módulo 005 — catálogo y reservas
├── risk/            # módulo 006 — scoring, AML
├── ledger/          # módulo 007 — partida doble inmutable
├── payments/        # módulo 007 — C2P, deuda, amortización
├── treasury/        # módulo 009 — inventario, conciliación
└── crm/             # módulo 010 — seguimiento comercial
```

## Qué falta

Todo el código de negocio. El orden de implementación sigue
`../specs/000-overview/tasks-build-order.md`:

- **Ola 0** — módulo 001 (RBAC, auditoría, cifrado).
- **Ola 1** — módulo 004 (inspección 240 puntos).
- **Ola 2** — módulos 005, 010, solicitud de crédito.
- **Ola 3** — módulos 006, 007 (scoring, ledger, pagos).
- **Transversal** — módulo 009 (tablero y tesorería).

## Código Go archivado

El directorio `_legacy-go/` contiene el código Go original:

| Paquete | Contenido | Cobertura original |
|---|---|---|
| `internal/creditapp/validation` | Validadores venezolanos: cédula, RIF, teléfonos, correo, fecha de nacimiento, cuenta bancaria | 100 % |
| `internal/creditapp/calc` | Importes exactos, balance mensual, cuota por sistema francés y tabla de amortización | 100 % |
| `internal/platform/sensible` | Limpieza en memoria de secretos y datos sensibles | — |

Este código se usa como **referencia** al reescribir en Java. Se eliminará
del repositorio cuando la reescritura esté completa y verificada.

---

*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
