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

## 3. Identidad (módulo 002 · KYC)

| Entidad | Campos clave | Notas |
|---|---|---|
| `perfil_kyc` | usuario_id, nivel (básico/verificado), cedula, rif | |
| `verificacion_identidad` | id, usuario_id, resultado_facial, prueba_vida, ocr_cedula, ocr_rif, estado | Datos biométricos cifrados |

## 4. Inventario y certificación (módulos 003, 004, 005)

| Entidad | Campos clave | Notas |
|---|---|---|
| `vehiculo` | id, vin, marca, modelo, versión, año, carrocería, transmisión, combustible, tracción, puestos, kilometraje, estado (captado/inspección/reacondicionamiento/exhibición/reservado/vendido), sede | Ciclo de inventario. `carroceria` es enumerado: Sedán, Hatchback, SUV, Camioneta, Pick-up, Coupé — necesario para la exploración por tipo y el filtro del catálogo |
| `cotizacion` | id, vehiculo_datos, precio_referencia, moneda, tasa_bcv, vigencia | K-Price MVP (tabla de referencia) |
| `inspeccion` | id, vehiculo_id, inspector_id, estado | Cabecera de los 240 puntos |
| `inspeccion_punto` | inspeccion_id, codigo_punto, categoria (mecánica/estética/legal), resultado, evidencia_url, zona (exterior/interior), severidad (leve/moderada), ubicacion, posicion_x, posicion_y | **240 puntos**. Los puntos con resultado no conforme y categoría estética son los que se publican como **Imperfecciones** en la ficha (C2); `posicion_x`/`posicion_y` los sitúan sobre el diagrama del vehículo |
| `validacion_legal` | vehiculo_id, ocr_documentos, cruce_robo, cruce_deudas, resultado | OCR + cruces |
| `publicacion` | vehiculo_id, precio_venta, moneda, tasa_bcv, garantia, estado, fotos[] | Ficha del catálogo. `fotos[]` apunta al object storage nacional (Principio II); en la maqueta son archivos estáticos de marcador de posición |
| `garantia` / `devolucion` | publicacion_id, condiciones, estado | Post-venta MVP |

## 5. Crédito y riesgo (módulo 006)

| Entidad | Campos clave | Notas |
|---|---|---|
| `solicitud_credito` | id, usuario_id, vehiculo_id, monto, plazo | |
| `consulta_scoring` | solicitud_id, fuente (Access Datametrics), puntaje (100–800), variables | 6 variables del buró |
| `screening_aml` | solicitud_id, ofac_resultado, pep_resultado, estado | OFAC + PEP |
| `decision_credito` | solicitud_id, resultado (aprobado/rechazado), criterios, aprobado_por | Trazable |

## 6. Ecosistema fintech (módulo 007) — el corazón

### Ledger de partida doble (inmutable)

| Entidad | Campos clave | Notas |
|---|---|---|
| `cuenta_contable` | id, codigo, tipo (activo/pasivo/ingreso/egreso) | Plan de cuentas |
| `asiento` | id, fecha, descripcion, referencia, idempotency_key | Cabecera; append-only |
| `asiento_linea` | asiento_id, cuenta_id, debe, haber, moneda, tasa_bcv | Suma debe = suma haber |

Regla invariable: por cada asiento, **Σ debe = Σ haber**. Correcciones = asiento compensatorio que referencia al original.

### Crédito vivo y pagos

| Entidad | Campos clave | Notas |
|---|---|---|
| `credito` | id, decision_id, principal, tasa (4% mensual / 48% anual), plazo, estado | Cuotas fijas indexadas |
| `cuota` | credito_id, numero, vencimiento, capital, interes, estado (pendiente/pagada/mora) | Tabla de amortización |
| `pago` | id, credito_id, monto, canal (C2P/Pago Móvil), moneda, tasa_bcv, idempotency_key, estado | Idempotente |
| `conciliacion` | pago_id, extracto_bancario_ref, estado | Cruce contra banco |

## 7. Cobranza / telemetría (módulo 008)

| Entidad | Campos clave | Notas |
|---|---|---|
| `dispositivo_gps` | id, vehiculo_id, credito_id, proveedor | |
| `posicion_gps` | dispositivo_id, lat, lon, ts | Telemetría |
| `consentimiento_gps` | credito_id, documento_ref, firmado_en | Base contractual del corte |
| `orden_corte` | dispositivo_id, motivo (mora), reglas, avisos_enviados, estado | Según contrato y avisos pactados |

> Las reglas de corte (horas de gracia, avisos previos) son **decisiones de política comercial** marcadas `[NEEDS CLARIFICATION]` en el módulo 008.

## 8. Tesorería y operación (módulo 009)

| Entidad | Campos clave | Notas |
|---|---|---|
| `movimiento_inventario` | vehiculo_id, estado_anterior, estado_nuevo, ts | Control por sede/estado |
| `reporte_regulatorio` | tipo, periodo, contenido, generado_en | Formatos Sudeban |
| `notificacion` | destinatario, tipo, canal, estado | Recordatorios/confirmaciones |

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
