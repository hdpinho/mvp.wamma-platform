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
| **Confirmar** | Pide la cédula del cliente; puede corregir el correo, el día y la franja. Si esa cédula ya existía en otra persona, el sistema realiza la fusión automática sin perder datos ni teléfonos. La reserva del vehículo queda ratificada y abre el correo del asesor (`mailto:`) con la confirmación redactada para el cliente |
| **Descartar** | Cierra la cita y exige un motivo justificado. El vehículo reservado se libera inmediatamente de vuelta al catálogo |
| **WhatsApp** | Abre la conversación con el mensaje prellenado. Al volver, el sistema ofrece registrar la interacción en la bitácora inmutable |
| **Asistió** | En una cita confirmada, marca la visita y lleva automáticamente la oportunidad a la etapa **Visitó** |
| **Vender Vehículo** | Aparece tras la asistencia confirmada. Permite seleccionar:<ul><li>**Contado (D-48):** cierra la venta (`cerrado_ganado`) y el vehículo pasa a `vendido`.</li><li>**Financiamiento:** la oportunidad pasa a *En negociación*, el vehículo se mantiene reservado y el sistema genera un token seguro de 7 días (`/solicitud?token=...`) para que el asesor se lo envíe al cliente.</li></ul> |

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
- El coordinador comercial ve todo el embudo y puede asignar asesores. Los asesores ven sus oportunidades y pueden "Tomar" oportunidades sin dueño.

## Personas (backoffice)

**Menú:** Personas (`O7_Personas`). Búsqueda por nombre o por coincidencia exacta de cédula/teléfono mediante índice ciego HMAC-SHA-256 (sin descifrar en base de datos).
La **Ficha 360** (`O7_FichaPersona`) reúne:
1. Datos de contacto descifrados al vuelo solo para usuarios autorizados.
2. Todas las oportunidades históricas (activas y cerradas).
3. Todas las citas asociadas.
4. Historial cronológico inmutable de interacciones y llamadas.

## Operación con el servidor (Spring Boot API)

- **Endpoints REST:** `/v1/citas` (público), `/v1/crm/citas`, `/v1/crm/oportunidades`, `/v1/crm/personas`, `/v1/crm/metricas/embudo`, `/v1/crm/catalogos` y `/v1/enlaces-financiamiento/{token}`.
- **Bitácora de auditoría:** Cada cambio de etapa, asignación, confirmación, descarte y fusión genera un registro de auditoría inmutable en `auditoria_evento` con el ID del usuario y la IP de origen.
- **Resiliencia:** Si el servidor no está disponible o se opera sin conexión, el frontend conmuta automáticamente a modo local garantizando que la navegación nunca se bloquee.
