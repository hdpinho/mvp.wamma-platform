# 000 · Modelo de datos — MVP WAMMA

**Clasificación:** Confidencial · **Rev.:** 3 · **Septiembre 2026**

> Modelo conceptual. Las decisiones de implementación (índices, tipos exactos) las toma el agente al planificar cada módulo, respetando las reglas de la Constitución (Principio V). Las tablas residen en **Supabase** (PostgreSQL administrado). Las migraciones se gestionan con **Flyway** desde Spring Boot. Toda marca `[NEEDS CLARIFICATION]` debe resolverse antes de migrar.

## 1. Convenciones obligatorias

- **Montos:** nunca `float`/`double`. Usar Java `BigDecimal` con escala fija o `long` en céntimos. Toda fila monetaria guarda `monto`, `moneda` y `tasa_bcv` aplicada + `fecha_tasa`. La moneda de referencia es el **EUR** (Constitución v3.0.0), con equivalencia en `VES`; la base admite `EUR` desde la etapa 2.
- **Identificadores:** UUID.
- **Auditoría:** toda tabla sensible lleva `creado_en`, `creado_por`, y los cambios se registran en `auditoria_evento` (inmutable).
- **Ledger:** append-only. Prohibido `UPDATE`/`DELETE` sobre asientos; las correcciones son asientos compensatorios.

## 2. Entidades núcleo (módulo 001)

| Entidad | Campos clave | Notas |
|---|---|---|
| `usuario` | id, nombre_usuario, nombre, correo, estado, 2FA (secreto TOTP cifrado), bloqueo | Personal del backoffice. Los visitantes del sitio público no tienen cuenta (D-08). Los roles viven en `usuario_rol`, no en un campo del usuario |
| `rol` / `permiso` | código, nombre, ámbito | RBAC con mínimo privilegio; separación de funciones (Principio I). Roles de D-03; matriz en `001/plan.md` §9 |
| `sesion` | usuario_id, hash del token, nivel, vencimientos, revocación | Solo el hash del token; se revoca al cerrar sesión o desactivar al usuario |
| `codigo_recuperacion` | usuario_id, hash del código, usado_en | Recuperación del 2FA; cada código sirve una vez |
| `auditoria_evento` | id, actor, accion, entidad, antes, despues, ts | **Inmutable**; toda transacción y cambio de estado. Nunca contiene contraseñas, secretos ni tokens |
| `secreto_config` | clave, referencia | Sin uso: los secretos van en variables de entorno (D-05) |

## 3. Inventario y certificación (módulos 004, 005)

| Entidad | Campos clave | Notas |
|---|---|---|
| `vehiculo` | id, **código de inventario**, vin, placa (opcional), marca, modelo, versión, año, carrocería, transmisión, combustible, tracción, puestos, kilometraje, estado, sede, adquisición (opcional), es_demostracion | Inventario propio de WAMMA. El **código** es el identificador visible y el que usa la API: `WAM-00017` por secuencia, y `veh-001`…`veh-016` en los de ejemplo. La **disponibilidad** comercial es una vista de `estado`: `exhibicion` = disponible, `reservado` = con cita, `vendido`. Placa y precio de adquisición son opcionales, y la adquisición va completa o vacía (D-12, V0014). |
| `inspeccion` | id, vehiculo_id, inspector_id, estado | Cabecera de los 240 puntos |
| `inspeccion_punto` | inspeccion_id, codigo_punto, categoria (mecánica/estética/legal), resultado, evidencia_url, zona (exterior/interior), severidad (leve/moderada), ubicacion, posicion_x, posicion_y | **240 puntos**. Los puntos con resultado no conforme y categoría estética se publican como **Imperfecciones** en la ficha (C2). |
| `validacion_legal` | vehiculo_id, ocr_documentos, cruce_antecedentes, cruce_deudas, resultado | Verificación previa a la publicación |
| `publicacion` | vehiculo_id, precio_venta, moneda, tasa_bcv + fecha_tasa, garantía, estado (borrador/publicado/pausado/vendido), etiqueta comercial | Ficha de la vitrina. Los precios van en **euros** (D-21) y la **tasa BCV se fija al publicar**: corregir después la tasa del día no reescribe lo ya publicado. Un vehículo solo sale al sitio público cuando su publicación está `publicado` |
| `publicacion_foto` | publicacion_id, clave y clave_miniatura en el almacén, ancho, alto, orden, es_principal, créditos, subida_por | De **5 a 10 fotos** por vehículo (D-10). Se guardan sin los metadatos de ubicación de la cámara, y la principal es única por publicación |
| `tasa_cambio_bcv` | fecha, moneda, tasa_ves, fuente, quién la registró y quién la corrigió | Tasa oficial del día, una por fecha y moneda (D-13). La vitrina usa siempre la más reciente; corregir una queda en la bitácora con el valor anterior |
| `garantia` / `devolucion` | publicacion_id, condiciones, estado | Garantía WAMMA |

## 4. Seguimiento comercial (módulo 010)

| Entidad | Campos clave | Notas |
|---|---|---|
| `persona` | id, nombre_apellido, cedula, correo, canal_origen, criterio_resolucion | **Raíz del ámbito comercial.** Deduplicada por cédula; por **cualquiera de sus teléfonos** si la cédula falta. Distinta de `usuario` (001) y de `solicitante` (WMA-F-FIN-001): una persona puede no llegar a ser nunca ninguna de las dos. Cédula y correo cifrados + índice ciego |
| `persona_telefono` | persona_id, telefono, es_principal | Un teléfono por fila, cifrado + índice ciego. El principal es el último que dio el cliente; los demás se conservan y cuentan para deduplicar |
| `fusion_persona` | persona_sobreviviente_id, persona_absorbida_id, copia_absorbida, oportunidad_ids, cita_ids, interaccion_ids, fusionada_en | **Append-only.** Copia íntegra del registro absorbido y de lo que se le reasignó. Sin ella la fusión sería irreversible (`010-crm-comercial/plan.md` §5.1) |
| `oportunidad` | id, persona_id, vehiculo_id, etapa, modalidad_pago, valor_estimado + moneda + tasa_bcv + fecha_tasa, asesor_id, proxima_accion, proxima_accion_fecha, motivo_perdida, solicitud_credito_id, enlace de financiamiento (hash del token, emitido_en, expira_en, usado_en), version | Intención de compra sobre un vehículo. `motivo_perdida` obligatorio si y solo si `etapa = cerrado_perdido`. Los estados cerrados son terminales: retomar contacto crea una oportunidad nueva. El enlace personal de solicitud de crédito se emite al vender con financiamiento (`010-crm-comercial/spec.md` §8.8); del token solo se guarda su hash, es de un solo uso y vence |
| `interaccion` | id, persona_id, oportunidad_id, canal, direccion, nota, autor_id, ocurrido_en, corrige_interaccion_id | **Append-only.** Corregir es añadir una interacción que referencia a la anterior, nunca editar |
| `etapa_historial` | oportunidad_id, etapa_anterior, etapa_nueva, nota, actor_id, creado_en | **Append-only.** Sin esta traza no existe "tiempo en etapa" ni conversión del embudo: solo la foto actual |
| `cita_inspeccion` | oportunidad_id, persona_id, vehiculo_id, sede_id, dia_preferido, franja, estado | Una cita es un evento dentro de una oportunidad. Estados `pendiente`, `confirmada`, `descartada`; «Asistió» mueve la oportunidad a `visito` |
| `catalogo_etapa` / `catalogo_motivo_perdida` | codigo, nombre, orden, es_terminal, umbral_estancada_dias / exige_texto | Catálogos **cerrados**. Cambiar una etapa es una fila, no un despliegue |

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
