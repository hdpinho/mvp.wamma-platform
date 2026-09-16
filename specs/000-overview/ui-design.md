# 000 · Spec de UI y tokens de marca — Maqueta de alta fidelidad

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Fecha:** Junio 2026
**Aplica a:** maqueta visual reusable en **React** (Ruta B). Los agentes (Antigravity/Claude Code) generan las pantallas a partir de este documento + los `spec.md` de cada módulo.
**Estado:** Draft para `/clarify`

> Este documento define **cómo se ve** WAMMA, no cómo funciona. La lógica de negocio vive en los specs de módulo y se conecta después. Marca y datos maestros: `Base_Conocimiento_Wamma.md`. Principios: `../../.specify/memory/constitution.md`.

## 1. Propósito y alcance

Construir una **maqueta navegable de alta fidelidad** en React, con **datos simulados** y **sin lógica de negocio**, que el usuario final pueda ver y tocar. La maqueta es **reusable**: sus componentes y pantallas se vuelven el esqueleto del frontend real cuando se conecte la lógica módulo por módulo.

**Incluye:** tokens de marca, biblioteca de componentes base, inventario de pantallas, flujo de navegación, estados visuales (vacío/carga/error) y convenciones de datos simulados.
**No incluye (esta fase):** llamadas a API/backend, cálculos reales (amortización, scoring), integraciones reales (KYC, GPS, bancos). Todo eso se simula visualmente.

## 2. Principios de diseño

1. **Confianza y transparencia** — es lo que diferencia a WAMMA de un clasificado. El sello "certificado · 240 puntos" y los precios claros son protagonistas.
2. **Mobile-first** — el cliente venezolano vive en el teléfono. Se diseña primero para móvil y se expande a escritorio.
3. **Marca consistente** — naranja `#D17438` y Montserrat en todas las pantallas (sección 4).
4. **Claridad sobre decoración** — superficies planas, sin gradientes ni sombras pesadas; jerarquía por tipografía y espacio.
5. **Multi-moneda siempre visible** — todo precio en USD con equivalencia en Bs. a tasa BCV (sección 6).

## 3. Tokens de diseño

> Fuente única: estos tokens viven en `frontend-web/src/tokens/` y **nada** se estiliza con valores sueltos fuera de ellos.

### 3.1 Color

**Marca (oficial — `docs/marca/WAMMA-manual-de-marca.pdf`, lámina "Código cromático"):**

| Token | Hex | Equivalencias del manual | Uso |
|---|---|---|---|
| `naranja-500` (principal) | `#D17438` | RGB 209/116/56 · CMYK 8/71/86/0 | Acciones primarias, acentos, sello de marca |
| `negro` (secundario) | `#000000` | RGB 0/0/0 · CMYK 84/83/7/80 | Texto fuerte, contraste |

> `[NEEDS CLARIFICATION: el manual documenta el naranja como #D17438, pero los archivos de logo entregados (docs/marca + frontend-web/public/marca/) tienen píxeles #EB7530, sin perfil ICC embebido. Son dos naranjas distintos. Confirmar cuál es el oficial: si es #EB7530, se actualiza este token y toda la rampa derivada.]`

**Escala de grises (oficial — lámina "Escala de grises"):** el logo admite tres niveles monocromo: negro `#000000`, gris medio `#8A8A8A` y gris claro. Uso: documentos, fax, impresión a una tinta.

**Rampa de naranja (propuesta para estados — ajustable):**
`naranja-50 #FBF1EA` · `100 #F4D9C5` · `200 #E9B187` · `500 #D17438` (base) · `600 #B45F28` (hover) · `700 #8F4A1D` (texto sobre claro).

**Neutros (propuesta):**
`blanco #FFFFFF` · `superficie #F7F6F4` · `borde-claro #ECEAE6` · `borde #D9D6D0` · `texto-mudo #9A958C` · `texto-secundario #4A4843` · `texto-primario #1A1A18`.

**Semánticos (funcionales, propuesta):**

| Estado | Texto | Fondo | Uso |
|---|---|---|---|
| Éxito / pagada | `#0F6E56` | `#E1F5EE` | Cuota pagada, GPS activo |
| Aviso / por vencer | `#BA7517` | `#FAEEDA` | Cuota próxima a vencer |
| Peligro / mora | `#C0392B` | `#FCEBEB` | Cuota en mora, errores |
| Info | `#185FA5` | `#E6F1FB` | Estados informativos |

> `[NEEDS CLARIFICATION: confirmar la rampa extendida y los colores semánticos. El manual de marca solo define #D17438, #000000 y la escala de grises; la rampa y los semánticos son una extensión funcional nuestra, no oficial.]`

### 3.2 Tipografía

- Familia: **Montserrat** (Google Fonts). Fallback: `system-ui, sans-serif`.
- Pesos **oficiales del manual**: solo **Regular 400** y **Bold 700**.
- `Medium 500` se usa hoy en la maqueta para énfasis de UI; **no** está respaldado por el manual. Tratarlo como extensión funcional o eliminarlo. `[NEEDS CLARIFICATION: ¿se admite Medium 500 para densidad de UI, o la interfaz se limita a Regular/Bold?]`
- Escala (móvil): `display 28/700` · `h1 22/700` · `h2 18/500` · `cuerpo 15/400` · `pequeño 13/400` · `micro 11/500`.
- Sentencia normal (no MAYÚSCULAS), salvo micro-etiquetas (`text-transform: uppercase` + tracking).

### 3.3 Espaciado, radios, elevación

- Escala de espaciado (px): `4 · 8 · 12 · 16 · 24 · 32 · 48`.
- Radios: `sm 6 · md 8 · lg 12 · pill 999`.
- Elevación: **plana**. Separación por borde `0.5–1px` color `borde-claro`; sombra solo funcional (focus ring).
- Breakpoints: `móvil <640 · tablet 640–1024 · escritorio >1024`.

## 4. Reglas de marca (estrictas)

- Logo: isotipo **"W" con flecha ascendente** + wordmark **"wamma"** + bajada "BY TOKEN PAGO POS".
- **Articulaciones válidas** (lámina "Articulaciones del logo"): **vertical** (isotipo sobre wordmark) y **horizontal** (isotipo a la izquierda del wordmark). El **isotipo solo** es válido como marca de aplicación reducida (favicon, avatar, tab bar).
- Versiones cromáticas válidas: naranja · negro · blanco · escala de grises.
- **Sobre fondo negro sólido: permitido** con el logo en **blanco**. El manual lo define expresamente en la lámina "Positivo / Negativo" y lo aplica en uniforme operativo y rotulación vehicular. *(Corrige la prohibición que figuraba en la Rev. 1 de este spec, anterior a la recepción del manual.)*
- **Área de respeto:** conservar el margen libre alrededor del logo según la lámina "Área de respeto". No colocar texto ni elementos dentro de ese margen.
- **Patrones de marca:** ondas orgánicas y arcos concéntricos en naranja sobre fondo gris claro. Uso decorativo en hero, estados vacíos y encabezados. Nunca detrás de texto de lectura.
- Botón primario: fondo `naranja-500`, texto blanco (válido por marca). Hover `naranja-600`.
- **Assets:** `frontend-web/public/marca/` — 12 PNG con transparencia (`wamma-{vertical|horizontal|isotipo}-{naranja|negro|blanco|gris}.png`).
- `[NEEDS CLARIFICATION: los assets recibidos son PNG rasterizados (1440px de ancho). Para UI y para impresión hace falta el vectorial (SVG/AI/EPS). Solicitar al equipo de diseño.]`

## 5. Biblioteca de componentes base

Cada componente se construye una vez en `frontend-web/src/components/` y se reutiliza. Estados visuales obligatorios: normal, hover, foco, deshabilitado y carga donde aplique.

| Componente | Notas |
|---|---|
| `Boton` | Variantes: primario (naranja), secundario (outline naranja), texto |
| `Campo` / `Selector` | Input, select; estados de validación (visual) |
| `TarjetaVehiculo` | Foto, etiqueta comercial, favorito, versión, precio USD + Bs ref y **cuota "desde $X/mes*"** |
| `SelloCertificado` | "Certificado · 240 puntos" (dato maestro: 240, no 250) |
| `ChipFiltro` | Filtro conmutable; activo en naranja, removible con equis |
| `Logo` | Logo oficial: articulación (horizontal/vertical/isotipo) y variante cromática |
| `FotoVehiculo` | Foto del vehículo con respaldo a silueta por carrocería si el archivo falta |
| `BotonFavorito` | Corazón para guardar (Fase 2, módulo 12) |
| `Imperfecciones` | Hallazgos cosméticos sobre diagrama, con toggle exterior/interior y galería |
| `DiagramaVehiculo` | Planta y perfil (exterior) o cabina (interior) en SVG 100×100, con marcadores numerados |
| `SimuladorCuota` | Inicial + plazo → cuota estimada; reusado en C0 y C2 |
| `NotaSimulada` | **Rótulo obligatorio** de todo dato no oficial (inline o bloque) |
| `Seccion` | Encabezado de sección con bajada y enlace "ver todo" |
| `PatronOndas` | Patrón decorativo de marca (lámina "Patrones") |
| `TarjetaMetrica` | Deuda total, próxima cuota (etiqueta + número grande) |
| `FilaAmortizacion` | Cuota, estado (pagada/pendiente/mora) con color semántico |
| `BarraNavegacion` | Top bar con wordmark; bottom-nav en móvil |
| `PasosKYC` | Stepper de verificación (registro → facial → OCR) |
| `SelloGPS` | "GPS activo · vehículo localizado" |
| `PrecioMoneda` | Patrón USD + Bs ref (sección 6) |
| `Estado` | Vacío, carga (skeleton) y error — visuales |

## 6. Patrón multi-moneda (recurrente)

Todo monto se muestra con el componente `PrecioMoneda`:
- **Primario:** USD (`$9,800`).
- **Secundario:** equivalencia en Bs. con nota "a tasa BCV del día".
En la maqueta la tasa es un valor **simulado** fijo; la conversión real llega con la lógica (Principio V de la Constitución).

## 7. Inventario de pantallas (Venta de Vehículos Publicados)

**Cliente:**

| # | Ruta | Pantalla | Módulo |
|---|---|---|---|
| C0 | `/` | Home: hero, vitrina destacados, 3 pilares, pasos, simulador | 005 |
| C1 | `/catalogo` | Catálogo / vitrina con filtros y ordenamiento | 005 |
| C2 | `/vehiculo/:id` | Ficha del vehículo + simulador de cuota + inspección 240 pts + imperfecciones | 005 · 004 |
| C7 | `/favoritos` | Guardados y alertas de precio | 005 |
| C9 | `/solicitud-credito` | Asistente de 8 pasos solicitud de crédito digital WMA-F-FIN-001 | solicitud-credito |

**Operación / interno (Roadmap):**

| # | Pantalla | Módulo |
|---|---|---|
| O1 | Ingreso con 2FA (`/admin/ingresar`), Usuarios (`/admin/usuarios`), Bitácora (`/admin/bitacora`) y Mi cuenta (`/admin/cuenta`) | 001 |
| O2 | App de inspección de 240 puntos (inspector) | 004 |
| O3 | Inventario (`/admin/inventario`) y ficha del vehículo con fotos, certificación e imperfecciones (`/admin/vehiculo/nuevo`, `/admin/vehiculo/editar/:codigo`) | 004 · 005 |
| O4 | Tasa BCV del euro (`/admin/tasa-bcv`): registro diario, corrección auditada e historial | 005 |
| O6 | Decisión de crédito / cumplimiento | 006 |
| — | Tableros de inventario por sede y de tesorería / conciliación (pendientes) | 009 |

## 8. Flujo de navegación (cliente)

```
                      ┌──► Catálogo (C1) ──► Ficha (C2) ──► Solicitud de Crédito (C9)
                      │         ▲                │
  Home (C0) ──────────┤         └─ Guardados (C7)◄┘
                      │
                      └──► Solicitud de Crédito directa (C9)
```
La maqueta enlaza pantallas con navegación real (router), conectando la ficha del auto seleccionado con el formulario oficial WMA-F-FIN-001.

**Filtros del catálogo (C1):** cuota mensual, precio máximo, marca, carrocería, transmisión, sede, año mínimo, kilometraje máximo y "solo certificados". **Ordenamiento:** relevancia, menor/mayor precio, menos kilómetros, más nuevos. Los filtros aplicados se muestran como `ChipFiltro` removibles.

## 9. Estados a maquetar (visual)

Para cada pantalla con datos: **vacío** (sin resultados), **carga** (skeleton), **error** (mensaje amable). Sin lógica: se alternan con un control de demostración o props.

## 10. Datos simulados (convenciones)

- Viven en `frontend-web/src/mocks/` como JSON/TS estáticos. **Cero** `fetch`/llamadas de red.
- `vehiculos.ts`: marca, modelo, **versión**, año, km, precioUSD, transmisión, combustible, **carrocería**, **puestos**, **tracción**, certificado, **suscripciónMensualUSD** (Fase 2), **etiqueta**, sede. El tipo vive en `src/types/vehiculo.ts`.
- `usuario.ts`, `credito.ts` (con `cuotas[]` y estados), `financiamiento.ts`.
- `financiamiento.ts` centraliza los parámetros de crédito y el cálculo de cuota (sistema francés) usados por C0, C1, C2 y C5. **Sus cifras (4% mensual / 48% anual / plazos 6–24 / inicial 30–60%) NO están confirmadas por WAMMA**: provienen de la generación inicial de la maqueta.
- **Video del hero (C0):** `public/video/portada-wamma.mp4` (640×360, 12,8 s, 2,0 MB, H.264+AAC).
  Va **autoalojado**, nunca embebido desde YouTube o Vimeo: un `<iframe>` de esos servicios envía datos
  de cada visitante a infraestructura extranjera y contradice el Principio II. En producción va al object
  storage nacional. Se reproduce `autoPlay muted loop playsInline` — silenciado es la única forma en que
  los navegadores permiten el arranque automático. **No se monta** si el visitante declaró
  `prefers-reduced-motion: reduce`; en ese caso queda la fotografía.
- **Imagen del hero (C0):** `public/hero/carro-playa.webp` (1920×800) y `carro-playa-movil.webp` (900×675).
  Ahora cumplen dos funciones: `poster` del video y **capa de respaldo** debajo, para que el hero se pinte
  de inmediato y no quede vacío si el video falla.
- **Velo de contraste del hero:** sobre video no se puede medir el fondo real, así que está calibrado
  contra el **peor caso absoluto**, un fotograma blanco puro. Con 0.72 de opacidad en el borde de la columna
  de texto (44% en escritorio), el texto blanco queda en **7.77:1** en escritorio y **7.45:1** en móvil —
  por encima del 4.5:1 de AA **sea cual sea el contenido del video**. A la derecha el velo baja a 0.18–0.34
  para no tapar el vehículo. Este método sustituye a la medición sobre píxeles que se usaba con la foto fija.
  `[NEEDS CLARIFICATION: el video está a 640×360 y se estira a ~1170px en escritorio, por lo que se ve
  suave. Solicitar el master en 1920×1080 para el hero.]`
  `[NEEDS CLARIFICATION: video e imagen del hero los aportó el Product Owner y muestran un vehículo de marca
  identificable. Confirmar derechos de uso antes de publicar.]`
- **Imperfecciones:** `mocks/imperfecciones.ts`, mapa `vehiculoId → Imperfeccion[]`. Se mantienen fuera de
  `VehiculoData` porque en el dominio son `inspeccion_punto`, no atributos del vehículo. Cada hallazgo lleva
  zona, tipo, severidad, ubicación y una posición `x`/`y` en porcentaje sobre el diagrama.
  **Declararlas es una decisión de producto, no cosmética:** es lo que hace verificable el sello de 240 puntos.
  Un vehículo sin hallazgos muestra "la inspección no registró hallazgos", que es distinto de "sin inspeccionar".
  `[NEEDS CLARIFICATION: ¿se publican también hallazgos mecánicos, o solo estéticos como hace Kavak?]`
  `[NEEDS CLARIFICATION: la evidencia fotográfica por hallazgo la produce la app de inspección (módulo 004),
  que aún no existe. En la maqueta el acercamiento se simula sobre la foto referencial del modelo.]`
- **Fotografía:** `public/vehiculos/{id}.webp`, recorte 4:3 a 1000×750. El componente `FotoVehiculo`
  cae a una silueta teñida por carrocería si el archivo falta o falla la carga. Los créditos viven en
  `mocks/creditosFotos.ts` y se muestran al pie de la foto en C2, como exigen las licencias CC BY-SA.
- **Todo monto o condición mostrada al usuario debe ir acompañada del componente `NotaSimulada`.** No se presentan cifras inventadas como si fueran datos de negocio.
- **Ubicación del inventario simulado:** para el demo, las 16 unidades están en la **Gran Caracas**
  (Las Mercedes, La Castellana, Los Ruices, La Trinidad y Guatire). Como la ciudad es la misma en todas,
  la tarjeta y los chips muestran la **zona**, no la ciudad. Al abrir sedes en el interior habrá que
  volver a mostrar ciudad + zona. Decisión del Product Owner, 2026-08-21.
- **No se maquetan bloques de confianza con cifras** (garantía, política de devolución, días de prueba, % de aprobación de crédito, testimonios, número de clientes) hasta que existan los datos oficiales — decisión del Product Owner, 2026-08-20.

## 11. Lineamientos técnicos para los agentes

- **Stack:** React (web) primero; Flutter (móvil) reusa los mismos tokens y patrones después.
- **Estructura reusable** (se vuelve el frontend real):
  ```
  frontend-web/src/
  ├── tokens/        # colores, tipografía, espaciado (fuente única)
  ├── components/    # biblioteca base
  ├── screens/       # pantallas por módulo (C1…O6)
  ├── mocks/         # datos simulados
  └── routes/        # navegación sin guards de negocio
  ```
- Componentes presentacionales y desacoplados de datos (reciben props), para enchufar datos reales luego sin reescribir la UI.
- Verificación en navegador (capacidad de Antigravity): navegar la maqueta y capturar pantallas para revisión.

## 12. Accesibilidad y responsive

- Contraste AA; foco visible; etiquetas en controles; texto ≥ 13px.
- Mobile-first; objetivos táctiles ≥ 44px; layout que escala a escritorio.

## 13. Guardrails (qué NO hacer en esta fase)

- **No** llamar a backend, API ni integraciones reales (KYC, GPS, bancos): todo simulado.
- **No** implementar cálculos de negocio reales (amortización, scoring, corte GPS): valores en mock.
- **No** deformar, recolorear ni recomponer el logo: usar los assets de `frontend-web/public/marca/` tal cual. Sobre fondo oscuro va la versión **blanca**, no una recoloreada.
- **No** invadir el área de respeto del logo.
- **No** estilizar con valores sueltos fuera de `tokens/`.
- Respetar la Constitución y este spec; ante duda, `[NEEDS CLARIFICATION]` y consultar.

## 14. Preguntas abiertas

- `[NEEDS CLARIFICATION: conflicto de naranja — manual dice #D17438, los PNG del logo tienen #EB7530]` **(prioritario: afecta todos los tokens)**
- `[NEEDS CLARIFICATION: confirmar rampa extendida y colores semánticos (el manual solo define #D17438, #000000 y grises)]`
- `[NEEDS CLARIFICATION: ¿se admite Montserrat Medium 500 en UI? El manual solo lista Bold y Regular]`
- `[NEEDS CLARIFICATION: falta el logo vectorial (SVG/AI/EPS); solo hay PNG rasterizado]`
- `[NEEDS CLARIFICATION: alcance de la primera maqueta — solo cliente o también interno]`
- `[NEEDS CLARIFICATION: formato de visualización de Bs. (separadores, decimales)]`
- `[NEEDS CLARIFICATION: condiciones comerciales de la garantía y la política de devolución (entidades `garantia`/`devolucion` del data-model, Fase 1). Sin ellas no se pueden maquetar los bloques de confianza que Kavak sí expone.]`
- `[NEEDS CLARIFICATION: parámetros reales de financiamiento — inicial mínima, plazos ofrecidos y tasa. Hoy la maqueta reusa 4% mensual / 48% anual / 6–24 meses sin confirmar.]`
- `[NEEDS CLARIFICATION: condiciones de la suscripción OCN (monto, plazo, opción de compra) — módulo 10, Fase 2.]`
- `[NEEDS CLARIFICATION: fotografía real de inventario.` **Bloqueante para producción.** La maqueta usa
  fotos de marcador de posición tomadas de Wikimedia Commons bajo licencia libre (ver
  `frontend-web/public/vehiculos/CREDITOS.md`). Corresponden al modelo pero **no son unidades reales**.
  Catorce de las dieciséis son **CC BY-SA**, que exige atribución y es *compartir igual*: la obra derivada
  hereda la licencia. Antes de producción deben sustituirse por fotografía propia de cada unidad.
  Falta definir proveedor, formato, proporción y número de tomas por vehículo.`]`

## 15. Trazabilidad

Constitución: Principios IV (MVP-first), V (multi-moneda), VI (seguridad visible). Overview: 9 módulos. Specs de módulo: 002–009.

**Marca:** `docs/marca/WAMMA-manual-de-marca.pdf` (Manual de Marca WAMMA by Token Pago Pos, 21 láminas) es la fuente normativa de identidad visual: logo, articulaciones, área de respeto, código cromático, tipografía, escala de grises y patrones. Assets en `frontend-web/public/marca/`. Ante conflicto con `Base_Conocimiento_Wamma.md`, escalar a decisión humana antes de implementar.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
