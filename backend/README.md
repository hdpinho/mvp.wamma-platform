# Backend WAMMA

**Clasificación:** Confidencial · **Rev.:** 1 · **Agosto 2026**

Monolito modular en Go, conforme a `../specs/000-overview/architecture-plan.md`.

## Estado actual

Solo está construido el **núcleo puro** del módulo de solicitud de crédito
(`specs/solicitud-credito/`): las piezas sin I/O ni dependencias externas.

| Paquete | Contenido | Cobertura |
|---|---|---|
| `internal/creditapp/validation` | Validadores venezolanos: cédula, RIF, teléfonos, correo, fecha de nacimiento, cuenta bancaria | **100 %** |
| `internal/creditapp/calc` | Importes exactos, balance mensual, cuota por sistema francés y tabla de amortización | **100 %** |

**Todavía no existe** nada de persistencia, API, OTP, recaudos ni PDF. Ver
"Qué falta" más abajo.

## Requisitos

- Go 1.26 o superior.
- **Sin dependencias externas.** `go.mod` no declara ninguna y es deliberado
  (ver "Decisiones" ).

## Comandos

```sh
go test ./...                 # pruebas
go test ./... -cover          # pruebas con cobertura
go vet ./...                  # análisis estático
gofmt -l ./internal/          # formato: no debe listar nada
```

## Decisiones

### Aritmética exacta sin librerías de terceros

El Principio V de la Constitución prohíbe el punto flotante para dinero. En vez
de traer `shopspring/decimal`, el paquete `calc` usa:

- **Enteros de unidad menor** (céntimos) para los importes: sumar y restar es
  exacto por construcción.
- **`math/big.Rat`** para el cálculo intermedio de la cuota.

`big.Rat` es aritmética racional exacta, así que `(1+i)^n` se calcula sin
pérdida cuando la tasa es racional —que siempre lo es—. Con decimal, cada
potencia arrastra un truncamiento que se acumula a lo largo del plazo. Solo se
redondea al convertir el resultado final a importe.

La última cuota de la tabla de amortización **absorbe el residuo de redondeo**,
de modo que el saldo final sea exactamente cero. Sin ese ajuste el crédito
quedaría con céntimos vivos, que en un ledger de partida doble es un descuadre.

### El tipo `Dinero` impide mezclar divisas

`Sumar` y `Restar` fallan si las monedas difieren. En un sistema multi-moneda
como este, sumar USD con VES sin convertir es un error que no da síntomas hasta
que alguien cuadra las cuentas.

### Ante un insumo ausente, se falla de forma visible

La validación de cuenta bancaria devuelve `ErrInsumoNoDisponible` mientras no
haya catálogo de bancos ni algoritmo de dígito verificador cargados. **No se
inventa una lista de bancos**: un catálogo plausible pero falso produce errores
silenciosos que llegan a producción.

Lo mismo aplica a la edad máxima al vencimiento: es un puntero sin valor por
defecto. Mientras sea `nil`, la regla no se aplica y así queda declarado.

### Código muerto eliminado, no cubierto con pruebas

Al perseguir el 100 % de cobertura aparecieron varias ramas de error
inalcanzables, porque el llamador ya garantizaba la condición. Se eliminaron en
lugar de escribir pruebas para estados imposibles. Están señaladas con un
comentario donde el invariante lo justifica.

## Variables de entorno

Ninguna todavía: los paquetes construidos son puros. Se documentarán al añadir
persistencia y adaptadores.

## Qué falta

Por orden de `../specs/solicitud-credito/tasks.md`:

- **Ola 1** — migraciones, inmutabilidad a nivel de motor, catálogos.
- **Ola 3** — repositorios, API `/v1`, OTP, recaudos, evidencia, PDF.
- **Ola 4 y 5** — frontend y verificación transversal.

### Bloqueante de arquitectura

`creditapp` necesita `internal/platform` (cifrado de campo, auditoría, RBAC)
para todo lo que toque persistencia. Ese paquete es el **módulo 001**, que según
`../specs/000-overview/tasks-build-order.md` es la Ola 0 de todo el proyecto y
aún no se ha construido. Avanzar a la Ola 3 de este módulo implica empezar el
001 primero.

### Insumos externos pendientes

D10 (OTP), D11 (antivirus), D12 (formato WMA-F-FIN-001), D13 (bancos),
D14 (ubicaciones), L6 y L7 (textos legales), P7–P11 (parámetros financieros).
Detalle en `../specs/solicitud-credito/spec.md` §13.

---

*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
