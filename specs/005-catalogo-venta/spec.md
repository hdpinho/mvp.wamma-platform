# 005 · Catálogo y venta (web y móvil)

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 2 · **Septiembre 2026**
**Pilar Kavak:** Venta con garantía
**Depende de:** 001 (hecho: roles, bitácora y sesiones); 004 (en esta etapa, solo la certificación simplificada: §3)
**Estado:** **Aprobado** por el Product Owner el 15 de septiembre de 2026 (D-25). Plan en `./plan.md`, tareas en `./tasks.md`

> Spec del QUÉ y el POR QUÉ. CÓMO en `./plan.md` y `../000-overview/`. Principios en `../../.specify/memory/constitution.md`.
>
> **Rev. 2:** alinea el spec con la Constitución v3.0.0 (euro) y con las decisiones D-08 a D-13 y D-21 a D-23, y fija el alcance de la etapa 2: que la vitrina y el inventario de la maqueta funcionen con datos del servidor. Lo que la maqueta no muestra (compra, reserva con pago, garantía) sigue descrito, pero queda fuera de esta etapa.

## 1. Objetivo
La vitrina pública con los vehículos que WAMMA tiene a la venta, y el inventario del backoffice que la alimenta: datos del vehículo, fotos, imperfecciones, certificación, disponibilidad y precio en euros con su equivalencia en bolívares a la tasa BCV del euro.

## 2. Por qué importa
Es **donde el cliente compra**. Replica la experiencia de comprar un auto "como quien compra en línea", con certidumbre total. Que el inventario viva en el servidor es lo que hace que la vitrina que ve un cliente sea la misma que gestiona el personal: hoy cada navegador tiene su propia copia.

## 3. Alcance

**Incluye (etapa 2, lo que muestra la maqueta):**
- **Inventario en el backoffice:** alta y edición de vehículos, de 5 a 10 fotos por vehículo (D-10, D-22), imperfecciones marcadas sobre el diagrama, certificación, disponibilidad, y publicar o pausar.
- **Vitrina pública:** portada, catálogo con los filtros y el orden actuales, y ficha con galería, imperfecciones y sello de certificación. Los favoritos siguen guardándose en el navegador del visitante.
- **Tasa BCV del euro:** registro diario desde el backoffice, con fecha y fuente (D-13). La vitrina muestra la equivalencia en bolívares y la fecha de la tasa.
- **Precios en euros** (D-21).
- **Una sola sede:** Distrito Capital (D-23).

**No incluye en esta etapa:**

| Qué | Dónde queda |
|---|---|
| Checklist de 240 puntos, OCR y cruces de robo y deudas (módulo 004 completo) | Fase posterior: no está en la maqueta y tiene preguntas abiertas (catálogo de puntos, D6) |
| Simulador y cotizador con parámetros reales | Etapa 4 (D-14). Mientras tanto, siguen con los valores actuales |
| Captura pública de citas, y bloqueo del vehículo al agendar desde la vitrina | Etapa 3 (CRM). Mientras tanto, esa captura sigue en el navegador del visitante |
| Reserva con pago, flujo de compra, garantía y devoluciones (RF-005.5 y RF-005.6) | Fuera de la Fase 1 actual: dependen de 006 y 007 (D-01) |
| Alertas de precio y verificación del comprador | Fuera de alcance (D-08) |

## 4. Actores y roles

| Actor | Qué hace | Permiso (001, D-24) |
|---|---|---|
| Visitante | Recorre la vitrina, sin cuenta (D-08) | — |
| Rol Inventario | Da de alta, edita, sube fotos, certifica, publica y pausa | `inventario.gestionar` |
| Todo el personal del backoffice | Consulta el inventario completo | `inventario.ver` |
| Asesor y coordinador comercial | Cambian la disponibilidad desde el CRM, al agendar, liberar o vender | `crm.operar` |
| Administrador y analista de crédito | Registran la tasa BCV del día | `tasa_bcv.registrar` |
| Fotógrafo de WAMMA | Fotografía el vehículo real (D-22). Las fotos las sube el rol Inventario | — |

## 5. Historias de usuario
- Como **visitante**, quiero filtrar los vehículos y ver su ficha con fotos, imperfecciones y precio en euros y en bolívares, para decidir con confianza.
- Como **personal de inventario**, quiero dar de alta un vehículo con sus fotos e imperfecciones y publicarlo, para que aparezca en la vitrina.
- Como **asesor**, quiero que el vehículo quede "con cita" o "vendido" cuando lo registro en el CRM, para que la vitrina no ofrezca un auto comprometido.
- Como **analista de crédito**, quiero registrar la tasa BCV del euro del día, para que las equivalencias en bolívares sean las oficiales.

## 6. Requisitos funcionales
- **RF-005.1** Catálogo con los filtros de la maqueta (marca, carrocería, precio, cuota, transmisión, año, kilometraje y certificación) y su orden (relevancia, precio, kilometraje y año). Solo muestra vehículos publicados y no vendidos.
- **RF-005.2** Publicar exige precio, datos completos y el mínimo de fotos (P-005.2). Un vehículo sin certificar se publica según P-005.3.
- **RF-005.3** Ficha con galería de fotos, imperfecciones sobre el diagrama, sello de certificación si corresponde, y precio en EUR con su equivalencia en bolívares a la tasa BCV del euro vigente y la fecha de esa tasa.
- **RF-005.4** Simulador de cuotas: sin cambios en esta etapa (etapa 4).
- **RF-005.5** Flujo de compra: fuera de esta etapa (§3).
- **RF-005.6** Garantía y devoluciones: fuera de esta etapa (§3).
- **RF-005.7** Alta y edición de vehículos. Placa y precio de adquisición son opcionales (D-12). Cada vehículo tiene un **código de inventario** único y estable, que es el que aparece en la dirección de su ficha.
- **RF-005.8** Fotos: de 5 a 10 por vehículo; subir, ordenar, elegir la principal y quitar. Se aceptan JPEG, PNG y WebP, y se guardan **sin metadatos** (fecha, cámara, ubicación GPS).
- **RF-005.9** Disponibilidad: disponible, con cita o vendido. La cambian el rol Inventario y el CRM, y la vitrina la refleja.
- **RF-005.10** Tasa BCV del euro: una por día, con fecha y fuente, e historial. La vitrina usa la más reciente y muestra su fecha.
- **RF-005.11** Solo se puede eliminar un vehículo que nunca se publicó. Uno publicado se **pausa**: sale de la vitrina y conserva su historial.
- **RF-005.12** Toda alta, edición, foto, publicación, pausa, cambio de disponibilidad y registro de tasa queda en la bitácora (001).

## 7. Requisitos no funcionales y cumplimiento
- Montos en euros con precisión fija, sin coma flotante. La tasa, con 8 decimales (V0011). Cada precio publicado guarda la tasa y la fecha con que se fijó (Principio V).
- Las fotos se sirven desde almacenamiento compatible con S3 (D-09): Supabase Storage en producción. Cambiar de proveedor es configuración.
- La vitrina no expone datos internos: ni placa, ni precio de adquisición, ni quién cargó el vehículo.
- Plan gratuito de Render (D-19): la vitrina debe mostrar que está cargando, no una página vacía, mientras el servidor despierta.

## 8. Reglas de negocio
- El precio de venta se fija en **euros** (D-21). La equivalencia en bolívares se calcula con la tasa BCV del euro más reciente, se redondea a dos decimales y es informativa.
- **Con cita:** el vehículo sigue en la vitrina, marcado como tal. **Vendido:** sale de la vitrina (CA-010.5).
- Solo el rol Inventario publica, pausa y elimina.
- **Código de inventario:** los vehículos de demostración conservan `veh-001` a `veh-016`, para no romper enlaces ni los datos de CRM que ya existen en los navegadores; los nuevos reciben `WAM-` y un número correlativo.
- **Imperfección:** zona (exterior o interior), tipo, descripción, severidad (leve o moderada), ubicación y posición sobre el diagrama.
- **Certificación simplificada** (004 parcial): el rol Inventario declara el vehículo certificado. Queda en la bitácora con su autor y su fecha.

## 9. Entidades de datos
`vehiculo`, `sede`, `publicacion`, `publicacion_foto`, `inspeccion` e `inspeccion_punto` (certificación e imperfecciones) y `tasa_cambio_bcv`. Cambios de esquema en `plan.md` §3.

## 10. Integraciones
Almacenamiento compatible con S3 para las fotos (D-09). El simulador recibe sus parámetros en la etapa 4 (D-14).

## 11. Criterios de aceptación (Given/When/Then)
- **CA-005.1** *(depende de P-005.3)* Dado un vehículo sin certificar, cuando se publica, entonces la ficha lo dice claramente y no muestra el sello. Si el PO opta por exigir la certificación, el sistema impide publicarlo.
- **CA-005.2** Simulador: etapa 4.
- **CA-005.3** Verificación del comprador: fuera de esta etapa.
- **CA-005.4** Garantía al vender: fuera de esta etapa.
- **CA-005.5** Dado un vehículo con menos fotos que el mínimo, cuando se intenta publicar, entonces el sistema lo impide y dice cuántas faltan.
- **CA-005.6** Dado un vehículo en borrador, pausado o vendido, cuando un visitante pide su ficha, entonces el sistema responde que no existe, sin revelar que sí existe.
- **CA-005.7** Dada una tasa BCV registrada hoy, cuando un visitante abre una ficha, entonces ve el precio en euros y su equivalencia en bolívares con esa tasa y su fecha. Si hoy no hay tasa, se usa la última y se muestra su fecha.
- **CA-005.8** Dada una foto con ubicación GPS en sus metadatos, cuando se sube, entonces la foto guardada no la contiene.
- **CA-005.9** Dado un usuario sin `inventario.gestionar`, cuando intenta crear, editar, subir fotos o publicar, entonces el servidor responde 403 y lo registra en la bitácora.
- **CA-005.10** Dada una oportunidad que el CRM marca como vendida, cuando se confirma, entonces el vehículo deja de aparecer en la vitrina.
- **CA-005.11** Dado un vehículo publicado, cuando se intenta eliminar, entonces el sistema lo impide y ofrece pausarlo.
- **CA-005.12** Cada acción de RF-005.12 aparece en la bitácora con su autor y su fecha.

## 12. Métricas de éxito
Conversión visita → compra; uso del simulador; reclamos de garantía dentro de lo esperado.

## 13. Preguntas abiertas
- ~~**P-005.1 — Fotos de los vehículos de demostración.**~~ **Cerrada** (D-25): se cargan las 16 fotos actuales como referenciales, con su crédito, y los vehículos de demostración se publican con una foto, por excepción, hasta tener las del fotógrafo.
- ~~**P-005.2 — Mínimo de fotos para publicar.**~~ **Cerrada** (D-25): 5, con un máximo de 10.
- ~~**P-005.3 — Vehículo sin certificar.**~~ **Cerrada** (D-25): se publica con el aviso y sin sello mientras no exista el 004 completo. Así se lee CA-005.1.
- ~~**P-005.4 — Precios de demostración.**~~ **Cerrada** (D-25): las mismas cifras, en euros.
- **Dirección de la sede** (pendiente de D-23). Mientras no llegue, la ficha muestra solo "Distrito Capital".
- `[NEEDS CLARIFICATION: P4 — quién asume costos de traspaso (debe coincidir con el contrato)]` — fuera de esta etapa.
- `[NEEDS CLARIFICATION: condiciones exactas de garantía y ventana de devolución]` — fuera de esta etapa.

## 14. Trazabilidad
Constitución: Principios IV y V (v3.0.0). Decisiones: D-01, D-08 a D-13, D-19 y D-21 a D-23. Dependencias: 001 (hecho) y 004 (parcial). Alimenta a: 010 (disponibilidad del vehículo) y etapa 4 (simulador).

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
