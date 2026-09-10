# 000 · Modelo de datos — MVP WAMMA

**Clasificación:** Confidencial · **Rev.:** 3 · **Septiembre 2026**

> Modelo conceptual. Las decisiones de implementación (índices, tipos exactos) las toma el agente al planificar cada módulo, respetando las reglas de la Constitución (Principio V). Toda marca `[NEEDS CLARIFICATION]` debe resolverse antes de migrar.

## 1. Convenciones obligatorias

- **Montos:** nunca `float`. Usar decimal de precisión fija o entero de menor unidad. Toda fila monetaria guarda `monto`, `moneda` (`USD`/`VES`) y `tasa_bcv` aplicada + `fecha_tasa`.
- **Identificadores:** UUID.
- **Auditoría:** toda tabla sensible lleva `creado_en`, `creado_por`, y los cambios se registran en `auditoria_evento` (inmutable).
- **Ledger:** append-only. Prohibido `UPDATE`/`DELETE` sobre asientos; las correcciones son asientos compensatorios.

## 2. Entidades núcleo (módulo 001)

| Entidad | Campos clave | Notas |
|---|---|---|
| `usuario` | id, tipo (cliente/vendedor/inspector/admin), estado | Base de identidad |
| `rol` / `permiso` | nombre, ámbito | RBAC; refleja separación de funciones Sudeban |
| `auditoria_evento` | id, actor, accion, entidad, antes, despues, ts | **Inmutable**; toda transacción y cambio de estado |
| `secreto_config` | clave, referencia | Solo referencias; secretos fuera de la BD |

## 3. Inventario y certificación (módulos 004, 005)

| Entidad | Campos clave | Notas |
|---|---|---|
| `vehiculo` | id, vin, marca, modelo, versión, año, carrocería, transmisión, combustible, tracción, puestos, kilometraje, estado (inspección/reacondicionamiento/exhibición/reservado/vendido), sede | Inventario publicado propio de WAMMA. |
| `inspeccion` | id, vehiculo_id, inspector_id, estado | Cabecera de los 240 puntos |
| `inspeccion_punto` | inspeccion_id, codigo_punto, categoria (mecánica/estética/legal), resultado, evidencia_url, zona (exterior/interior), severidad (leve/moderada), ubicacion, posicion_x, posicion_y | **240 puntos**. Los puntos con resultado no conforme y categoría estética se publican como **Imperfecciones** en la ficha (C2). |
| `validacion_legal` | vehiculo_id, ocr_documentos, cruce_antecedentes, cruce_deudas, resultado | Verificación previa a la publicación |
| `publicacion` | vehiculo_id, precio_venta, moneda, tasa_bcv, garantia, estado, fotos[] | Ficha del catálogo con fotos en storage nacional |
| `garantia` / `devolucion` | publicacion_id, condiciones, estado | Garantía WAMMA |

## 4. Seguimiento comercial (módulo 010)

| Entidad | Campos clave | Notas |
|---|---|---|
| `persona` | id, nombre_apellido, cedula, telefono_whatsapp, correo, canal_origen | **Raíz del ámbito comercial.** Deduplicada por cédula; por teléfono si la cédula falta. Distinta de `usuario` (001) y de `solicitante` (WMA-F-FIN-001): una persona puede no llegar a ser nunca ninguna de las dos. Cédula, teléfono y correo cifrados + índice ciego |
| `oportunidad` | id, persona_id, vehiculo_id, etapa, modalidad_pago, valor_estimado + moneda + tasa_bcv, asesor_id, proxima_accion, proxima_accion_fecha, motivo_perdida, solicitud_credito_id | Intención de compra sobre un vehículo. `motivo_perdida` obligatorio si y solo si `etapa = cerrado_perdido`. Los estados cerrados son terminales: retomar contacto crea una oportunidad nueva |
| `interaccion` | id, persona_id, oportunidad_id, canal, direccion, nota, autor_id, ocurrido_en, corrige_interaccion_id | **Append-only.** Corregir es añadir una interacción que referencia a la anterior, nunca editar |
| `etapa_historial` | oportunidad_id, etapa_anterior, etapa_nueva, nota, actor_id, ts | **Append-only.** Sin esta traza no existe "tiempo en etapa" ni conversión del embudo: solo la foto actual |
| `catalogo_etapas` / `catalogo_motivos_perdida` | codigo, nombre, orden, es_terminal / exige_texto | Catálogos **cerrados**. Cambiar una etapa es una fila, no un despliegue |

**Regla de separación (`010-crm-comercial/spec.md` §8.3):** la capa comercial ve contacto, vehículo de interés, etapa y notas. **No ve** ingresos, egresos, cuenta bancaria ni recaudos. `oportunidad.solicitud_credito_id` es un **puntero, no una unión de datos**: el asesor conoce el estado de la solicitud, no su contenido.

**Dos ejes distintos:** `vehiculo.estado` describe el auto; `oportunidad.etapa` describe la negociación. No se fusionan — un mismo auto puede tener una oportunidad perdida y otra en negociación.

## 5. Solicitud de crédito y riesgo (módulo 006 / WMA-F-FIN-001)

| Entidad | Campos clave | Notas |
|---|---|---|
| `solicitud_credito` | id, numero_solicitud, vehiculo_id, lead_id, datos_personales, datos_laborales, datos_financieros, recaudos[], estado | Digitalización WMA-F-FIN-001. `lead_id` referencia a `oportunidad` (§4), lo que cierra el insumo **D15** de `solicitud-credito/spec.md` §13 |
| `decision_riesgo` | id, solicitud_id, score_interno, score_datametrics, politica_resultado (aprobado/rechazado/condicionado), limite_aprobado | Decisión algorítmica + comité |
| `alerta_aml` | solicitud_id, regla, severidad, revisado_por, estado | Prevención legitimación de capitales |

## 6. Ecosistema fintech: ledger y pagos (módulo 007)

### Ledger sagrado (partida doble inmutable)

| Entidad | Campos clave | Notas |
|---|---|---|
| `cuenta_contable` | codigo, nombre, tipo (activo/pasivo/patrimonio/ingreso/egreso), moneda | Plan contable |
| `asiento` | id, transaccion_ref, descripcion, fecha, ts, creado_por | Inmutable |
| `linea_asiento` | asiento_id, cuenta_id, debe, haber, moneda, tasa_bcv | Partida doble exacta |

Regla invariable: por cada asiento, **Σ debe = Σ haber**. Correcciones = asiento compensatorio que referencia al original.

### Crédito vivo y pagos

| Entidad | Campos clave | Notas |
|---|---|---|
| `credito` | id, decision_id, principal, tasa (4% mensual / 48% anual), plazo, estado | Cuotas fijas indexadas |
| `cuota` | credito_id, numero, vencimiento, capital, interes, estado (pendiente/pagada/mora) | Tabla de amortización |
| `pago` | id, credito_id, monto, canal (C2P/Pago Móvil), moneda, tasa_bcv, idempotency_key, estado | Idempotente |
| `conciliacion` | pago_id, extracto_bancario_ref, estado | Cruce contra banco |

## 7. Tesorería y operación (módulo 009)

| Entidad | Campos clave | Notas |
|---|---|---|
| `movimiento_inventario` | vehiculo_id, estado_anterior, estado_nuevo, ts | Control por sede/estado |
| `reporte_regulatorio` | tipo, periodo, contenido, generado_en | Formatos Sudeban |
| `notificacion` | destinatario, tipo, canal, estado | Recordatorios/confirmaciones |

---
*WAMMA · Confidencial · Rev. 3 · No constituye asesoría legal ni financiera.*
