# 000 · Modelo de datos — MVP WAMMA

**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**

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

## 4. Solicitud de crédito y riesgo (módulo 006 / WMA-F-FIN-001)

| Entidad | Campos clave | Notas |
|---|---|---|
| `solicitud_credito` | id, numero_solicitud, vehiculo_id, datos_personales, datos_laborales, datos_financieros, recaudos[], estado | Digitalización WMA-F-FIN-001 |
| `decision_riesgo` | id, solicitud_id, score_interno, score_datametrics, politica_resultado (aprobado/rechazado/condicionado), limite_aprobado | Decisión algorítmica + comité |
| `alerta_aml` | solicitud_id, regla, severidad, revisado_por, estado | Prevención legitimación de capitales |

## 5. Ecosistema fintech: ledger y pagos (módulo 007)

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

## 6. Tesorería y operación (módulo 009)

| Entidad | Campos clave | Notas |
|---|---|---|
| `movimiento_inventario` | vehiculo_id, estado_anterior, estado_nuevo, ts | Control por sede/estado |
| `reporte_regulatorio` | tipo, periodo, contenido, generado_en | Formatos Sudeban |
| `notificacion` | destinatario, tipo, canal, estado | Recordatorios/confirmaciones |

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
