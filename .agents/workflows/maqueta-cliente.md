# Workflow: /maqueta-cliente — Generar maqueta React de pantallas de cliente

**Descripción:** Genera una maqueta visual navegable en React de las 6 pantallas de cliente del MVP de WAMMA, con datos simulados y sin lógica de negocio, siguiendo los tokens de marca y la estructura reusable. Invocación: `/maqueta-cliente`.

> Sugerencia de modelo: planifica con un modelo de razonamiento profundo y cambia a uno rápido para implementar.

## Rol
Eres un ingeniero frontend senior experto en React y en SDD. Construyes una **maqueta visual**: pantallas con datos simulados, **sin** lógica de negocio ni backend.

## Antes de escribir código, lee y respeta
- `@.specify/memory/constitution.md` — ley suprema (precede a todo).
- `@specs/000-overview/ui-design.md` — tokens de marca, componentes, pantallas, guardrails.
- `@specs/000-overview/product-overview.md` — contexto del producto.
- Specs de las pantallas de cliente: `@specs/002-onboarding-kyc/spec.md`, `@specs/003-captacion-kprice/spec.md`, `@specs/005-catalogo-venta/spec.md`, `@specs/006-motor-riesgo-scoring-aml/spec.md`, `@specs/007-fintech-pagos-ledger/spec.md`.

## Tarea
Genera el proyecto `frontend-web/` en React siguiendo **exactamente** la estructura y los tokens de `ui-design.md`:

1. **`tokens/`** — colores (naranja `#D17438`, negro, neutros, semánticos), tipografía Montserrat, espaciado, radios. Fuente única; **nada** se estiliza con valores sueltos fuera de aquí.
2. **`components/`** — biblioteca base presentacional (reciben props): `Boton`, `Campo`, `TarjetaVehiculo`, `SelloCertificado` (240 puntos), `ChipFiltro`, `TarjetaMetrica`, `FilaAmortizacion`, `BarraNavegacion`, `PasosKYC`, `SelloGPS`, `PrecioMoneda` (USD + Bs ref a tasa BCV), `Estado` (vacío/carga/error).
3. **`mocks/`** — datos simulados estáticos: `vehiculos`, `usuario`, `credito` (con `cuotas[]` y estados), `cotizacion`. Valores realistas dentro de los rangos maestros (auto $6K–$12K, cuotas fijas, 48% anual), **rotulados como simulados**. Cero `fetch`/red.
4. **`screens/`** — las 6 pantallas de cliente: C1 Catálogo · C2 Ficha + simulador · C3 Vende tu auto + cotización · C4 Onboarding/KYC · C5 Solicitud de financiamiento + resultado · C6 Mi panel (deuda, amortización, pagar C2P/Pago Móvil).
5. **`routes/`** — navegación real entre pantallas **sin guards de negocio**; los saltos se simulan.

## Reglas
- Mobile-first y responsive a escritorio. Accesibilidad AA.
- Marca: naranja `#D17438`, Montserrat; wordmark "wamma" en texto como placeholder; **nunca** el logo sobre negro sólido.
- **Prohibido:** backend/API, integraciones reales (KYC, GPS, bancos) y cálculos de negocio reales — todo simulado y rotulado.
- Donde un spec tenga `[NEEDS CLARIFICATION]`, usa un placeholder visual; **no inventes reglas de negocio**.
- Componentes desacoplados de los datos para enchufar datos reales luego sin reescribir la UI.

## Procedimiento
1. **Planifica primero:** propón estructura y lista de tareas y **muéstramela antes de implementar a fondo**.
2. **Implementa en orden:** `tokens → components → mocks → screens → routes`.
3. **Verifica:** levanta la app, navégala en el navegador y captura pantallas de las 6 vistas para mi revisión.
4. **Resume la entrega:** qué se construyó, qué quedó como placeholder y qué decisiones requieren mi confirmación.

## Para incluir también pantallas internas
Agrega a la tarea las pantallas de Prioridad 2 de `ui-design.md` (O1 login 2FA, O2 inspección 240 puntos, O3 inventario, O4 tesorería, O5 cobranza GPS, O6 decisión de crédito) y sus specs (001, 004, 006, 008, 009).
