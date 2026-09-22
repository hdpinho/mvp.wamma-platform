# 000 · Registro de decisiones del Product Owner

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Septiembre 2026**

> Cada decisión que cierra una pregunta abierta queda aquí con su fecha, para que specs, planes y el manual de usuario la citen en lugar de repetirla. Si una decisión cambia, se añade una fila nueva que la sustituye; las anteriores no se borran.

## 14 de septiembre de 2026 — Backend de la Fase 1

| # | Tema | Decisión | Afecta a |
|---|---|---|---|
| D-01 | Alcance | Backend para que la maqueta actual funcione al 100 %: 001, inventario y catálogo, CRM, simulador de financiamiento y solicitud de crédito como captación. Scoring (006) y pagos con ledger (007) quedan fuera hasta tener convenios con bancos, buró y listas | Todos |
| D-02 | Etapas | 0 base técnica · 1 módulo 001 · 2 inventario y catálogo · 3 CRM · 4 financiamiento · 5 cierre y despliegue. En cada etapa: spec, plan y tareas aprobados antes de programar | Plan |
| D-03 | Roles del backoffice | Administrador, asesor comercial, coordinador comercial, inventario, analista de crédito y auditor (solo lectura) | 001 |
| D-04 | 2FA | Códigos temporales (TOTP) con app autenticadora, sin proveedor ni costo | 001 |
| D-05 | Secretos | Variables de entorno de Render, incluidas las claves de cifrado. Un gestor dedicado, más adelante | 001 |
| D-06 | L1 — formatos de Sudeban | Cerrado como **no aplica**, por la enmienda v2.0.0 de la Constitución | 001, 009 |
| D-07 | Primer administrador | Usuario `hdpinho`. Sus datos de contacto se cargan por variables de entorno, no en el repositorio | 001 |
| D-08 | Clientes del sitio público | Sin cuenta en esta fase: solo inician sesión los usuarios del backoffice | 001, 005 |
| D-09 | Fotos y recaudos | Almacenamiento compatible con S3. Se empieza con Supabase Storage, usado a través de su API S3 para poder cambiar de proveedor por configuración. Los recaudos van en un contenedor privado | 004, 005, solicitud |
| D-10 | Inventario inicial | Arranca con los vehículos de demostración, ya en su almacenamiento definitivo, con 5 a 10 fotos por vehículo | 004, 005 |
| D-11 | Sedes | Una sola sede, en el Distrito Capital | 004, 010 |
| D-12 | Datos del vehículo | Placa y precio de adquisición, opcionales en esta fase | 004 |
| D-13 | Tasa BCV | Registro diario desde el backoffice, con fecha y fuente. Automatizarla, después | 009 |
| D-14 | Parámetros de financiamiento | Pantalla de parámetros en el backoffice: tasa mensual, plazos y montos mínimo y máximo. Ingeniería propone los valores iniciales y el PO los confirma | Financiamiento |
| D-15 | Moneda | Euro (EUR). **Alcance por confirmar** (ver pendientes) | Constitución, todos |
| D-16 | OTP de la solicitud | Sin OTP en esta fase: al formulario solo se llega con el enlace personal que emite el asesor | Solicitud |
| D-17 | Bandeja de crédito | Bandeja sencilla en el backoffice para el analista de crédito | Solicitud |
| D-18 | Aviso al buzón comercial | Se retira en esta fase: las capturas nuevas se ven en el backoffice. La confirmación al cliente sigue por `mailto:` | 010 |
| D-19 | Hosting | Plan gratuito de Render: el servidor se apaga tras 15 minutos sin tráfico y tarda cerca de un minuto en volver | Infraestructura |
| D-20 | Manual de usuario | Cada etapa deja en `docs/manual-usuario/` todo lo necesario para redactar el manual de los módulos que toca | Todas las etapas |

## 15 de septiembre de 2026 — Cierre de pendientes del día anterior

| # | Tema | Decisión | Sustituye | Afecta a |
|---|---|---|---|---|
| D-21 | Moneda | El **euro aplica a toda la plataforma**: precios del catálogo, cuotas, simulador, cotizador y solicitud de crédito, con equivalencia en bolívares a la tasa BCV del euro. Constitución enmendada a v3.0.0 (Principio V) | Precisa D-15 | Todos |
| D-22 | Fotos | Las toma un fotógrafo de WAMMA y son del vehículo real que se vende. WAMMA es titular de los derechos | Precisa D-10 | 004, 005 |
| D-23 | Sede | Una sola sede, denominada **Distrito Capital** | Precisa D-11 | 004, 010 |
| D-25 | Etapa 2: inventario, catálogo y tasa BCV | **Aprobados** el spec 005 Rev. 2, su plan y sus tareas, con las opciones recomendadas por ingeniería:<ul><li>Fotos de demostración: las 16 actuales, marcadas como referenciales y con su crédito. Se publican con una foto, por excepción, hasta tener las del fotógrafo (E9-A).</li><li>De 5 a 10 fotos para publicar (E10).</li><li>Se puede publicar sin certificar, con aviso y sin sello (E11).</li><li>Precios de demostración: las mismas cifras, en euros (E12).</li><li>VIN obligatorio (E4).</li><li>Servidor dormido: copia local del catálogo en el navegador; sin consulta periódica por ahora (E14).</li><li>Los archivos que otra sesión está pasando a euros se toman cuando esa sesión termine (E15).</li><li>Se trabaja en local: sin despliegue ni commit hasta nuevo aviso.</li></ul> | Cierra P-005.1 a P-005.4 | 004, 005, 009 |
| D-26 | Parámetros oficiales de financiamiento | **Aprobados los parámetros comerciales para el MVP:**<ul><li>Tasa: 4.0 % mensual fija (48 % anual).</li><li>Sistema: francés (cuotas fijas).</li><li>Plazo: fijo en 24 meses (sin selector de plazos en vitrina).</li><li>Opciones de inicial: 20 %, 30 %, 40 % (inicial mínima: 20 %).</li><li>Relación cuota/ingreso máxima: 30 % del ingreso mensual comprobable.</li><li>Multiplicadores sobre el ingreso mensual: $\times 5.72$ (con 20 % inicial), $\times 6.53$ (30 % inicial) y $\times 7.62$ (40 % inicial).</li><li>Motor de cálculo único en `financiamientoMotor.ts`.</li><li>Parámetros en tabla Supabase `parametros_financiamiento` (V0015) con RLS y salvaguarda ("cálculo no disponible" si falla la sincronización).</li><li>Calculadora de capacidad con navegación persistida a catálogo (`/catalogo?precioMax=...`) y estado sin resultados pedagógico con enlace a prospectos CRM (Módulo 010).</li></ul> | Cierra D-14 | 005, 010, Financiamiento |

## 17 de septiembre de 2026 — Ajustes comerciales de Vitrina, Catálogo y Financiamiento

| # | Tema | Decisión | Sustituye | Afecta a |
|---|---|---|---|---|
| D-27 | Presentación monetaria y precios en vitrina | **Precios de contado y bolívares eliminados de toda la vitrina pública**:<ul><li>Ningún vehículo expone precio total de contado en catálogo, tarjetas ni fichas públicas; todo se expresa exclusivamente mediante **Cuota mensual** (`Desde €... /mes*`).</li><li>Se eliminan todas las referencias y montos en bolívares (`Bs.`); toda la interfaz pública opera exclusivamente en euros (`EUR` / `€`).</li><li>Se elimina el ajuste dinámico manual de tasa euro de las vistas públicas.</li></ul> | Modifica D-21 | 005, Vitrina, TarjetaVehiculo, FichaVehiculo |
| D-28 | Filtros de la vitrina | **Filtros simplificados y orientados a capacidad de pago**:<ul><li>Filtro de marcas limitado estrictamente a 5 marcas autorizadas: **Ford, Chevrolet, Chery, Hyundai, Toyota**.</li><li>Eliminado el filtro de tipo de carrocería.</li><li>Eliminado el filtro de precio total definitivo (`precioMax`).</li><li>Eliminado el filtro numérico de kilometraje máximo (`kmMax`). El bloque se consolida en **Año** (`Año desde`).</li><li>Eliminada la casilla de selección *"Solo certificados 240 puntos"* (el 100 % del inventario visible pasa por inspección de 240 puntos).</li><li>Filtro por Rango de Ingresos mensual limpio, sin mostrar subtítulos internos de cuota máxima.</li></ul> | Precisa D-25 | 005, Catálogo |
| D-29 | Terminología comercial e inspección | **Eliminación del término "Certificado"**: Se sustituye por **"Inspección 240 puntos"** o **"Estándar WAMMA"** en toda la plataforma. Se retira la visualización de la sede física de las tarjetas y fichas del vehículo de cara al cliente. | Precisa D-23 | 004, 005, 010 |
| D-30 | Modalidad de compra en agendamiento de citas | **Eliminación de la opción de pago de contado**: Al agendar una cita para ver el vehículo en el sitio público, se retira la opción de pago de contado. Toda cita agendada se tipifica automáticamente bajo la modalidad **Financiamiento WAMMA**. | Modifica D-26 | 010, ModalAgendarCita |
| D-31 | Estructura de la página de financiamiento | **Simplificación y pedagogía crediticia**:<ul><li>Se retira el simulador por vehículo redundante y la caja de política comercial de la vista pública.</li><li>Proceso pedagógico en 3 pasos: 1. *Calcula tu capacidad*, 2. *Elige tu vehículo y agenda tu cita*, 3. *Completa tu solicitud*.</li><li>Se retira el bloque pedagógico de contactar asesor cuando no hay vehículos calificados.</li></ul> | Precisa D-26 | Financiamiento, CalculadoraCapacidad |
| D-32 | Estandarización visual del inventario | **Línea fotográfica uniforme**: Todas las fotos de vehículos en vitrina y ficha se estandarizan en formato de estudio con fondo de ciclorama neutro e iluminación uniforme a 3/4. | Precisa D-22 | 004, 005, Vitrina |
| D-33 | Portada simplificada y cierre en vehículos destacados | **Eliminación de secciones inferiores en Inicio**: Se eliminan de la portada (`C0_Home.tsx`) tanto el bloque de «Cómo funciona» como la sección de financiamiento/calculadora («Paga tu próximo vehículo a cuotas» y «Financiamiento bajo el mismo techo»). La página de Inicio cierra limpiamente con la sección **«Inspeccionados y listos para entrega»** (vehículos destacados con cuota mensual y botón a vitrina). Toda la pedagogía de financiamiento y cálculo de capacidad se concentra en la ruta `/financiamiento`. | Precisa D-27, D-31 | 005, Home, C0_Home |
| D-34 | Pie de página (Footer) institucional y de navegación | **Pie de página corporativo**: Se incorpora el componente global `PiePagina` (`App.tsx`) para todas las pantallas públicas. Presenta la marca WAMMA by Token Pago POS en contraste blanco sobre fondo oscuro, datos de atención (Sede Distrito Capital y horarios), 4 columnas de navegación estructurada (Comprar auto, Financiamiento, Estándar WAMMA, Atención al cliente) y barra inferior con copyright, enlaces legales y disclaimer de financiamiento. | Modelo Kavak | 005, Layout, PiePagina |
| D-35 | Portada minimalista directa a navegación y pie de página | **Eliminación de la vitrina de destacados en Inicio**: Se elimina de la portada (`C0_Home.tsx`) la sección «Inspeccionados y listos para entrega». La pantalla de Inicio queda estructurada de manera ágil y minimalista: Hero principal (búsqueda rápida y llamado a la acción), los 3 accesos directos («Explora la vitrina», «Inspección 240 puntos», «Financiamiento directo») y conexión inmediata con el pie de página corporativo (`PiePagina`). Toda la navegación y descubrimiento de inventario se concentra en la Vitrina (`/catalogo`). | Modifica D-33 | 005, Home, C0_Home |
| D-36 | Portada enfocada exclusivamente en Hero y Pie de Página | **Eliminación de tarjetas de acceso en Inicio**: Se eliminan de la portada (`C0_Home.tsx`) los 3 bloques de acceso («Explora la vitrina», «Inspección 240 puntos», «Financiamiento directo»). La pantalla de Inicio queda constituida exclusivamente por el Hero principal (video de portada, propuesta de valor y buscador rápido hacia catálogo) y el pie de página institucional `PiePagina`. Toda la navegación se canaliza a través de la barra superior y los enlaces del pie de página. | Modifica D-35 | 005, Home, C0_Home |
| D-37 | Video de portada extendido de ancho completo (Full-Width) estilo Kavak | **Video de portada expandido edge-to-edge**: Siguiendo el modelo visual de referencia de Kavak, el video de portada en Inicio (`C0_Home.tsx`) se extiende al 100 % del ancho de la ventana sin márgenes laterales ni bordes redondeados (`.main-content-home`). El diseño se centra con tipografía prominente, barra de búsqueda en formato píldora y botones directos de acción translúcidos con efecto de vidrio esmerilado («Comprar auto», «Financiamiento», «Inspección 240 pts»). | Modelo Kavak | 005, Layout, Home, C0_Home |
| D-38 | Video de demostración con vehículos de prueba en portada | **Producción de video dinámico de alta claridad con inventario de prueba**: Se genera un video HD 720p en bucle continuo (`portada-wamma.mp4`, 2.11 MB, H.264 FastStart) con tratamiento fotográfico de alta luminosidad (+22% brillo, +12% viveza de color, nitidez optimizada) que recorre los vehículos insignia (Toyota Corolla, Hyundai Tucson, Chevrolet Aveo, Chevrolet Silverado, Chery Arauca y Toyota Yaris). Se calibra el velo oscuro del CSS a un nivel sutil y translúcido (12% a 26% en el área visual clave) con sombras de texto reforzadas para máxima legibilidad. La versión anterior se preserva en carpeta temporal (`frontend-web/public/video/temporal/`). | Precisa D-37 | 004, 005, Portada, Multimedia |
| D-39 | Simplificación de píldoras de acción en portada Hero | **Eliminación de píldora «Inspección 240 pts» en Inicio**: En la sección Hero de la portada (`C0_Home.tsx`), se retira el botón de píldora «Inspección 240 pts», manteniendo exclusivamente las dos acciones clave principales: «Comprar auto» (redirección a `/catalogo`) y «Financiamiento» (redirección a `/financiamiento`). La garantía y detalles de la inspección de 240 puntos se consultan a través de los enlaces del pie de página y en las fichas individuales de cada vehículo. | Precisa D-37 | 005, Home, C0_Home |

> **D-40 a D-43** están reservadas: las registra el spec 011 (`specs/011-endurecimiento-entornos-y-acceso/spec.md`) del PR #1, que se mezcla al final del proyecto. Por eso la numeración de `main` sigue en D-44.

## 18 y 21 de septiembre de 2026 — Mejoras de vitrina, agendamiento y navegación

> Registradas el 21/09/2026, después de implementarse. Fuente: `docs/mejoras-18-septiembre.md` y los commits `a0e5a80` y `43b2b2b`. Lo que no cuadra con decisiones anteriores queda en *Pendientes derivados*.

| # | Tema | Decisión | Sustituye | Afecta a |
|---|---|---|---|---|
| D-44 | Etiquetas comerciales de la vitrina | Solo tres etiquetas sobre la foto del vehículo: **Recién ingresado**, **Reservado para cita** y **Súper oportunidad**. Las anteriores («Difícil de conseguir», «Listo para entrega») pasan a «Súper oportunidad» (V0016). La elige el rol Inventario en el formulario del vehículo; es opcional | Precisa D-25 (plan 005, tabla `publicacion`) | 004, 005, TarjetaVehiculo, FichaVehiculo |
| D-45 | Recaudos al agendar una cita | El modal de agendar cita informa, en dos pestañas, qué preparar: **Digital** (para cargar en la solicitud tras la visita) y **Físico** (para llevar el día de la cita). La confirmación repite la lista como recordatorio. Es informativo: no se cargan archivos en este paso | Precisa D-30 | 010, Solicitud, ModalAgendarCita |
| D-46 | Portada: hero y pilares | Los botones del hero pasan a **«Encuéntralo»** (→ `/catalogo`) y **«Fináncialo»** (→ `/financiamiento`), cuadrados con esquinas redondeadas y en naranja WAMMA. Nuevo subtítulo y nuevo texto del buscador. Al pie del hero, una franja con los **pilares WAMMA**: Inspección · Certificación · Financiamiento · Seguro · Acompañamiento | Modifica D-39 | 005, Home, C0_Home |
| D-47 | Navegación móvil y acceso a financiamiento | En pantallas de hasta 1024 px, barra superior fija con el **logo oficial** a la izquierda. El acceso a `/financiamiento` de la barra, en escritorio y en móvil, se rotula **«Wamma - Bank»** | Precisa D-34 | 005, Layout, BarraNavegacion |

## Pendientes derivados

| Tema | Pregunta | Bloquea |
|---|---|---|
| Sede (D-23) | Dirección de la sede, para la ficha del vehículo y la confirmación de citas | Nada crítico; etapa 2 |
| Bloqueo (D-26) | Redacción legal final y plazo de reserva temporal al agendar cita | Vitrina / CRM |
| Detalle legal (D-26) | Validación con asesoría legal del desglose de costo total e intereses | Vitrina / Backoffice |
| Recaudos (D-45) | La lista del modal de cita no coincide con la de la solicitud de crédito. Estados de cuenta: **3 a 6 meses** en la cita frente a **6 meses** en la solicitud. Referencias: **2 personales y 1 familiar** en la cita frente a **2 personales** en los recaudos de la solicitud, cuyo paso 6 pide 3. ¿Cuál es la lista oficial? | Solicitud (etapa 4), manual 03 y 04 |
| OTP en la visita (D-45) | Los recaudos físicos piden un celular con WhatsApp «para validar el código OTP» en la sede, pero D-16 dejó la fase sin OTP. ¿Se valida algo con código el día de la cita? | CRM (etapa 3) |
| Pilares (D-46) | «**Certificación**» choca con D-29, que retiró ese término. «**Seguro**»: la base de conocimiento no recoge ninguna oferta de seguro. ¿Se mantienen los dos pilares? | Portada |
| Denominación «Bank» (D-47) | WAMMA no es una entidad bancaria. Validar con asesoría legal el uso de «Wamma - Bank» como rótulo | Navegación |
| Etiqueta «Reservado para cita» (D-44) | Se pone a mano y puede contradecir la disponibilidad automática «Con cita» que mueve el CRM. ¿Debe derivarse de la disponibilidad? | 005, CRM (etapa 3) |
| Cotizador del asesor (D-26) | El cotizador del backoffice admite plazos de 6 a 36 meses, inicial de hasta 60 % y cualquier tasa. D-26 fija 24 meses, iniciales de 20/30/40 % y 4 % mensual. ¿Puede el asesor cotizar fuera de política? | Financiamiento (etapa 4) |
| Publicar sin inspección (E11 frente a D-28) | El servidor sigue publicando vehículos sin inspección (E11), pero el formulario dice que «todos los vehículos publicados deben superar la inspección». ¿Se exige ya la inspección para publicar? | 004, 005 |

---
*WAMMA · Confidencial · No constituye asesoría legal ni financiera.*
