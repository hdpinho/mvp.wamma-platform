# 03 · Seguimiento comercial (módulo 010)

**Quién lo usa:** asesores y coordinadores comerciales (backoffice); visitantes al agendar una cita. **Estado:** operativo en backend Spring Boot (Java 21) y frontend React, alineado con el spec aprobado `specs/010-crm-comercial/spec.md` y probado localmente.

## Agendar una cita (sitio público)

Desde la ficha del vehículo (`C2_FichaVehiculo`), **Agendar cita**:
1. El visitante indica nombre y WhatsApp (obligatorios), correo (opcional), fecha de visita y horario preferido (mañana o tarde). (Conforme a D-48, se retiró el selector de rango de ingresos).
2. **Modalidad exclusiva de financiamiento (D-30):** Se eliminó la opción de pago de contado del formulario público. Toda cita queda automáticamente registrada bajo la modalidad **Financiamiento WAMMA**.
3. **Reserva y bloqueo temporal (D-48):** Al enviar, el vehículo pasa atómicamente a `reservado` por **24 horas** (`reserva_vence_en`). Si nadie confirma la cita en ese plazo, el vehículo se libera automáticamente de vuelta a `exhibicion`.
4. Se crea la oportunidad comercial en etapa **Nuevo** y el prospecto queda registrado en la base de datos con su número telefónico normalizado E.164 venezolano y cifrado en reposo (AES-256-GCM).
5. **Control de captación (D-48):** Máximo 5 citas por IP y 2 por teléfono en un lapso de 24 horas para prevenir spam.

No se pide la cédula en este paso: se solicita al confirmar la cita en backoffice, cuando el cliente ya está comprometido (§8.5 del spec).

### Recaudos que se informan al agendar (D-45)

El mismo formulario muestra, en dos pestañas, qué documentos preparar. Es **solo informativo**: en este paso no se carga ningún archivo.

| Pestaña | Para qué | Documentos |
|---|---|---|
| **Requisitos Digitales** | Para cargarlos en la solicitud en línea, después de la visita | Cédula o pasaporte vigente, por ambas caras · RIF personal actualizado, del portal del SENIAT · Constancia de trabajo (empleados) o certificación de ingresos firmada por contador público colegiado (independientes) · Estados de cuenta bancarios de los últimos 3 a 6 meses, en PDF del banco · Recibo de servicio público o contrato de arrendamiento vigente · Datos de 2 referencias personales y 1 familiar |
| **Requisitos Físicos** | Para llevarlos el día de la cita | Cédula de identidad original laminada, indispensable para entrar y validar la identidad · Copia impresa del RIF · Original de la constancia laboral o certificación del contador, con sello húmedo y firmas · Copia del recibo de servicio o del contrato de alquiler · Celular con WhatsApp activo, para validar un código de seguridad |

Al confirmar la cita, la pantalla final repite la lista como recordatorio: *Documentos a tener listos para tu cita y financiamiento*.

> **Pendiente del PO:** esta lista no coincide del todo con los recaudos de la solicitud de crédito (capítulo 04), ni en los meses de estados de cuenta ni en las referencias. Además, menciona un código de seguridad por WhatsApp que D-16 dejó fuera de esta fase. Cuando el PO fije la lista oficial, se corrige aquí.

## Bandeja de citas (backoffice)

**Menú:** Citas y Solicitudes (`O3_GestionCitas`). El número rojo indica las citas pendientes.

| Acción | Qué hace |
|---|---|
| **Confirmar** | Pide la cédula del cliente; puede corregir el correo, el día y la franja. Si esa cédula ya existía en otra persona, el sistema realiza la fusión automática sin perder datos ni teléfonos. La reserva del vehículo queda ratificada y **se abren solos** WhatsApp y, si hay correo, el programa de correo del asesor, con la confirmación ya redactada (día, horario, vehículo y qué traer). El asesor revisa y envía (D-69, D-75) |
| **Descartar** | Cierra la cita y exige un motivo justificado. El vehículo reservado se libera inmediatamente de vuelta al catálogo |
| **WhatsApp** | Abre la conversación con el mensaje prellenado. Al volver, el sistema ofrece registrar la interacción en la bitácora inmutable |
| **Asistió** | En una cita confirmada, marca la visita y lleva automáticamente la oportunidad a la etapa **Visitó** |
| **Vender Vehículo** | Aparece tras la asistencia confirmada. Permite seleccionar:<ul><li>**Contado (D-48):** cierra la venta (`cerrado_ganado`) y el vehículo pasa a `vendido`.</li><li>**Financiamiento:** la oportunidad pasa a *En negociación*, el vehículo se mantiene reservado y el servidor emite un **enlace personal de 7 días** para esa persona y ese vehículo. Al emitirlo **se abren solos** WhatsApp (y el correo, si el cliente dejó uno) con el enlace ya en el mensaje.</li></ul> |

**El enlace personal.** El servidor guarda solo su huella: el texto completo se muestra una vez, en la pestaña donde se emitió. Si se recarga la pantalla, no se vuelve a mostrar y se puede **emitir uno nuevo** (el anterior deja de servir). Si el navegador bloquea la ventana de WhatsApp, la tarjeta ofrece los botones **Enviar por WhatsApp**, **Enviar por correo** y **Copiar enlace**.

**Crédito de la oportunidad.** Cuando el cliente envía su solicitud, la tarjeta muestra el **número y el estado** del crédito (nada más: el asesor no ve ingresos, cuentas ni recaudos). Según el resultado aparece un botón para avisar al cliente por WhatsApp con el texto aprobado por el PO (D-72): crédito aprobado, no aprobado, o falta información.

## Embudo comercial (backoffice)

**Menú:** Embudo Comercial (`O7_EmbudoComercial`). Una columna por etapa, con métricas en tiempo real de cantidad y volumen monetario en euros.

| Etapa | Se considera estancada tras |
|---|---|
| Nuevo | 2 días sin actividad |
| Contactado | 3 días |
| Cita confirmada | 7 días |
| Visitó | 7 días |
| En negociación | 14 días |
| Vendido / Perdido | Son finales: no se reabren |

**Reglas del sistema:**
- Avanzar a cualquier etapa posterior está permitido, incluso saltando etapas intermedias.
- Volver a una etapa anterior exige obligatoriamente una **nota de justificación**.
- Marcar una oportunidad como **perdida** exige un **motivo** del catálogo (`precio`, `sin_capacidad`, `desistio`, `compro_otro`, `no_contactable`, `rechazo_financiamiento`, `otro`). "Otro motivo" exige además una explicación textual.
- Retomar contacto con alguien cuya oportunidad está cerrada crea una nueva oportunidad sin sobreescribir la histórica.
- Las notas e interacciones son inmutables (append-only); una corrección se registra como una nueva entrada.
- **«Tomar» y «repartir» no están disponibles en esta versión (D-73).** Las oportunidades nuevas quedan **sin asesor asignado** y todos los asesores las ven y operan. El coordinador ve todo el embudo. El servidor rechaza la asignación (`wamma.crm.asignacion-habilitada`, apagada por defecto), así que no hay forma de hacerla por otra vía.

## Personas (backoffice)

**Menú:** Personas (`O7_Personas`). Búsqueda por nombre o por coincidencia exacta de cédula/teléfono mediante índice ciego HMAC-SHA-256 (sin descifrar en base de datos).
La **Ficha 360** (`O7_FichaPersona`) reúne:
1. Datos de contacto descifrados al vuelo solo para usuarios autorizados.
2. Todas las oportunidades históricas (activas y cerradas).
3. Todas las citas asociadas.
4. Historial cronológico inmutable de interacciones y llamadas.

## Operación con el servidor (Spring Boot API)

- **Endpoints REST:** `/v1/citas` (público), `/v1/crm/citas`, `/v1/crm/oportunidades`, `/v1/crm/personas`, `/v1/crm/metricas/embudo`, `/v1/crm/catalogos` y `/v1/enlaces-financiamiento/{token}`.
- **Bitácora de auditoría:** Cada cambio de etapa, confirmación, descarte, fusión y emisión de enlace genera un registro de auditoría inmutable en `auditoria_evento` con el ID del usuario y la IP de origen.
- **Si el servidor no responde:** la pantalla lo dice y ofrece **Reintentar**. No se muestran datos de relleno ni se da por hecha una acción que el servidor no confirmó.
- **Qué ve cada rol:** el asesor ve las oportunidades sin dueño y, en lo ajeno, recibe «no encontrado» (queda en la bitácora). El coordinador y el auditor ven todo el embudo.

## Avisos al cliente por WhatsApp y correo (D-69, D-75)

La plataforma **no envía mensajes por su cuenta**: al ocurrir el hecho, **abre solos** WhatsApp Web o la aplicación de escritorio (`wa.me`) y el programa de correo de la computadora (`mailto:`), con el mensaje ya redactado. La persona de WAMMA lo revisa y lo envía desde su propia cuenta.

| Momento | Quién lo dispara | Qué se abre |
|---|---|---|
| Confirmar la cita | Asesor | WhatsApp y, si hay correo, el correo, con la confirmación |
| Emitir el enlace de financiamiento | Asesor | WhatsApp y, si hay correo, el correo, con el enlace personal |
| Dictamen de crédito (aprobada, rechazada) | Analista (capítulo 05) | WhatsApp y correo del solicitante, con el texto aprobado |
| Condicionar el crédito | Analista (capítulo 05) | WhatsApp y correo con el enlace para completar los documentos |

Si el navegador bloquea la ventana, la misma pantalla ofrece los botones para abrirlos con un clic. Un mensaje abierto y no enviado no queda registrado en ninguna parte: abrir un chat no prueba que hubo conversación (spec 010, RF-010.11).

> **Límite conocido:** al agendar una cita, el equipo se entera por la bandeja del backoffice. No hay correo automático al buzón de WAMMA, porque exigiría un servidor de correo (D-18).
