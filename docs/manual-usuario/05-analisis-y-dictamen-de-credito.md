# 05 · Análisis y dictamen de crédito (WMA-F-FIN-001)

**Quién lo usa:** el **analista de crédito** (lee y dictamina) y el **auditor** (solo lee). Ningún otro rol ve expedientes: ni el asesor, ni el coordinador, ni inventario, ni el administrador de usuarios. **Estado:** funciona contra el servidor; el dictamen es **manual**.

> **Alcance (D-63, D-65).** El scoring, la verificación contra listas (AML) y el «Score Buró» están **fuera de esta entrega**: no hay puntajes ni «AML limpio». El analista decide a mano y deja su justificación. El código del motor se conserva apagado en el servidor.

**Menú:** Solicitudes Crédito (`/admin/solicitudes`).

## Bandeja

- Cuatro indicadores arriba: solicitudes, por dictaminar, aprobadas y monto aprobado.
- Filtros **Todas · Nuevas · Aprobadas · Condicionadas · Rechazadas** y buscador por número, solicitante, cédula o vehículo.
- Cada fila muestra el número (`SOL-AAAA-NNNN`), el solicitante, el vehículo, el monto, la cuota estimada, los recaudos adjuntos y el estado.

| Estado | Significa |
|---|---|
| **Nueva** | Recién enviada por el cliente |
| **En evaluación** | En revisión, o devuelta al analista tras completar recaudos o reabrir el expediente |
| **Condicionada** | El analista pidió información o documentos |
| **Aprobada** · **Rechazada** | Dictamen final |
| **Desembolsada** | El crédito ya se pagó; no se reabre |

Si la bandeja no se puede leer, la pantalla lo dice con **Reintentar**; nunca muestra una lista vacía por un error.

## Expediente

Al pulsar **Revisar** se abre el expediente con lo que la persona escribió: operación (vehículo, precio, inicial, monto, cuota y capacidad de pago, **calculadas por el servidor**), datos personales, contacto, laborales, financieros, referencias, cuenta bancaria, declaraciones y la **evidencia de aceptación** (fecha, IP, agente y versión del texto). Lo que falta se muestra como **«No informado»**: nunca se rellena.

**Quedan en la bitácora**: cada vez que se abre un expediente (`solicitud_credito.consultada`), con quién y cuándo.

### Recaudos

Cada documento tiene tres acciones de revisión: **Conforme**, **Ilegible** y **Rechazar**, y el botón **Ver**.

- **Ver** abre el archivo con un **enlace firmado que vence en 5 minutos**. Los archivos están en un contenedor privado, sin dirección pública, y cada apertura queda en la bitácora.
- Antes de aprobar, la pantalla avisa si la cuota supera la capacidad de pago o si hay recaudos sin marcar como conformes. La justificación debe explicarlo.

## Dictamen manual

El formulario pide:

| Campo | Regla |
|---|---|
| **Decisión** | Aprobar, condicionar (pedir información o documentos) o rechazar |
| **Límite aprobado** y **cuota máxima permitida** | Solo al aprobar, mayores que cero. El límite **no puede superar** el monto solicitado |
| **Justificación** | Obligatoria, de al menos 10 caracteres. Queda con tu usuario en la bitácora |

El servidor registra el dictamen y la bitácora guarda **el resultado anterior, el estado anterior y el nuevo**. No hay puntaje por defecto.

### Aviso al solicitante (automático)

Al registrar el dictamen **se abren solos** WhatsApp y el programa de correo con el texto aprobado por el PO (D-72), con el nombre del solicitante, el número de solicitud y el vehículo, **sin cifras del crédito**. Tú revisas y envías. Si el navegador bloquea la ventana, el aviso naranja ofrece los botones **WhatsApp** y **Correo**.

### Condicionar: el cliente completa sus documentos (D-70)

1. Elige **Condicionar** y escribe qué falta. Esa justificación **no se muestra** al cliente.
2. Al registrar, el servidor emite un **enlace de recaudos** y se abre WhatsApp (y el correo) con el texto de «falta información» y el enlace.
3. El aviso naranja muestra el enlace **una sola vez**, con **Copiar enlace**. Si se pierde, usa **Volver a enviar el enlace de recaudos**: emite otro y el anterior deja de servir.
4. El cliente sube los documentos (ver capítulo 04). La solicitud vuelve a **En evaluación**, con el mismo número, y los documentos nuevos se suman; uno del mismo tipo reemplaza al anterior.

## Reabrir un expediente con dictamen (D-71)

Una solicitud **aprobada** o **rechazada** no admite un dictamen nuevo directamente. Si hace falta cambiarla:

1. Abre el expediente: aparece **Reabrir expediente**, con un cuadro de justificación.
2. Escribe por qué (al menos 10 caracteres) y pulsa **Reabrir expediente**.
3. La solicitud vuelve a **En evaluación**. El dictamen anterior sigue visible como contexto y el formulario de dictamen se habilita.
4. La bitácora guarda la reapertura (`solicitud_credito.reabierta`) con el estado anterior y tu justificación.

**No se puede reabrir** si el crédito ya está **desembolsado** o si la **venta ya se cerró** (el vehículo salió de la vitrina). Un auditor no reabre.

## Reglas y mensajes

| Mensaje | Qué pasó |
|---|---|
| Escribe la justificación del dictamen (al menos 10 caracteres). | Falta o es muy corta la justificación |
| Indica el límite aprobado y la cuota máxima permitida, mayores que cero. | Se aprobó sin condiciones |
| El límite aprobado no puede superar el monto solicitado. | El límite pasa de lo pedido |
| La solicitud … ya fue aprobada. Para cambiarlo, primero reabre el expediente con su justificación. | Se intentó dictaminar sobre un dictamen final |
| Solo se reabre un expediente aprobado o rechazado. | La solicitud está en otro estado |
| La venta de este vehículo ya se cerró: el expediente no se puede reabrir. | Ya se vendió |
| Solo se piden más recaudos en una solicitud condicionada. | Se pidió el enlace de recaudos de otro estado |
| El dictamen quedó registrado, pero no se pudo preparar el aviso al cliente. | El dictamen se guardó; falló solo el aviso |

## Bitácora de este módulo

`solicitud_credito.creada` · `consultada` · `evaluada` · `reabierta` · `enlace_recaudos_emitido` · `recaudos_completados` · `solicitud_recaudo.cargado` · `enlace_emitido` · `abierto` · `validado`. Son de solo agregar: una corrección es un nuevo evento.
