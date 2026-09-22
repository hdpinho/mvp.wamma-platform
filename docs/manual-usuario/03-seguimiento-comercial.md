# 03 · Seguimiento comercial (módulo 010)

**Quién lo usa:** asesores y coordinadores comerciales (backoffice); visitantes al agendar una cita. **Estado:** flujos de la maqueta, alineados con el spec aprobado `specs/010-crm-comercial/spec.md`. En la etapa 3 los datos pasan al servidor.

## Agendar una cita (sitio público)

Desde la ficha del vehículo, **Agendar cita**:
1. El visitante indica nombre y WhatsApp (obligatorios), correo (opcional), la fecha de visita y horario preferido (mañana o tarde), y su rango de ingresos mensuales (opcional).
2. **Modalidad exclusiva de financiamiento (D-30):** Se eliminó la opción de pago de contado del formulario público. Toda cita queda automáticamente registrada bajo la modalidad **Financiamiento WAMMA**.
3. Al enviar, el vehículo queda reservado temporalmente y se crea una oportunidad en la etapa **Nuevo**.

No se pide la cédula en este paso: se solicita al confirmar la cita, cuando el cliente ya está comprometido (§8.5 del spec).

### Recaudos que se informan al agendar (D-45)

El mismo formulario muestra, en dos pestañas, qué documentos preparar. Es **solo informativo**: en este paso no se carga ningún archivo.

| Pestaña | Para qué | Documentos |
|---|---|---|
| **Requisitos Digitales** | Para cargarlos en la solicitud en línea, después de la visita | Cédula o pasaporte vigente, por ambas caras · RIF personal actualizado, del portal del SENIAT · Constancia de trabajo (empleados) o certificación de ingresos firmada por contador público colegiado (independientes) · Estados de cuenta bancarios de los últimos 3 a 6 meses, en PDF del banco · Recibo de servicio público o contrato de arrendamiento vigente · Datos de 2 referencias personales y 1 familiar |
| **Requisitos Físicos** | Para llevarlos el día de la cita | Cédula de identidad original laminada, indispensable para entrar y validar la identidad · Copia impresa del RIF · Original de la constancia laboral o certificación del contador, con sello húmedo y firmas · Copia del recibo de servicio o del contrato de alquiler · Celular con WhatsApp activo, para validar un código de seguridad |

Al confirmar la cita, la pantalla final repite la lista como recordatorio: *Documentos a tener listos para tu cita y financiamiento*.

> **Pendiente del PO:** esta lista no coincide del todo con los recaudos de la solicitud de crédito (capítulo 04), ni en los meses de estados de cuenta ni en las referencias. Además, menciona un código de seguridad por WhatsApp que D-16 dejó fuera de esta fase. Cuando el PO fije la lista oficial, se corrige aquí.

## Bandeja de citas (backoffice)

**Menú:** Citas y Solicitudes. El número rojo indica las citas pendientes.

| Acción | Qué hace |
|---|---|
| **Confirmar** | Pide la cédula del cliente; puede corregir el correo, el día y la franja. Si esa cédula ya existía en otra persona, las dos se fusionan sin perder datos. Abre el correo del asesor con la confirmación redactada para el cliente |
| **Descartar** | Cierra la cita y pide el motivo |
| **WhatsApp** | Abre la conversación con el mensaje prellenado. Después, el sistema ofrece registrar la interacción |
| **Asistió** | En una cita confirmada, lleva la oportunidad a **Visitó** |
| **Vender Vehículo** | Aparece tras la asistencia. Pide confirmar la forma de pago. **Contado:** cierra la venta y el vehículo pasa a vendido. **Financiamiento:** la oportunidad pasa a *En negociación*, el vehículo sigue reservado y se emite el enlace personal de solicitud de crédito para enviarlo al cliente |

## Embudo comercial (backoffice)

**Menú:** Embudo Comercial. Una columna por etapa, con cantidad y monto.

| Etapa | Se considera estancada tras |
|---|---|
| Nuevo | 2 días sin actividad |
| Contactado | 3 días |
| Cita confirmada | 7 días |
| Visitó | 7 días |
| En negociación | 14 días |
| Vendido / Perdido | Son finales: no se reabren |

**Reglas del sistema:**
- Avanzar a cualquier etapa posterior está permitido, incluso saltando etapas.
- Volver a una etapa anterior exige una **nota**.
- Marcar una oportunidad como **perdida** exige un **motivo** del catálogo. "Otro motivo" exige además un texto.
- Retomar contacto con alguien cuya oportunidad está cerrada crea una oportunidad nueva.
- Las notas de seguimiento no se editan ni se borran: una corrección es una nota nueva.

## Personas (backoffice)

**Menú:** Personas. Búsqueda por nombre, cédula o teléfono. La ficha de cada persona reúne sus datos de contacto, todas sus oportunidades (abiertas y cerradas) y el historial de interacciones.

Una misma persona no se duplica: se reconoce por su cédula o, mientras no la haya dado, por cualquiera de sus teléfonos.

## Cambios previstos en la etapa 3

- Los datos pasan al servidor y los ve todo el equipo según su rol.
- Se retira el aviso "Notificación despachada" al buzón comercial, que en la maqueta no enviaba nada (D-18). Las capturas nuevas se ven en el backoffice.
- El enlace personal de financiamiento lo valida el servidor: sirve una sola vez y vence.
- Cada acción queda en la bitácora de auditoría con el usuario que la hizo.
