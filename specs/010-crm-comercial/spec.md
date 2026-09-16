# 010 · Seguimiento comercial de prospectos (CRM ligero)

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Septiembre 2026**
**Función:** Convertir el interés capturado en la vitrina en venta gestionada
**Depende de:** 001 (identidad del asesor, auditoría, cifrado); 005 (vehículo publicado)
**Alimenta a:** `specs/solicitud-credito/` (resuelve el `lead_id`, insumo D15)
**Estado:** **Aprobado** por el Product Owner (septiembre 2026). C1, C4 y C5 resueltos (C4, con el módulo 001: D-24); quedan abiertas C2, C3 y C6, que no bloquean las olas 1 y 2

> Spec del QUÉ y el POR QUÉ. El CÓMO va en `./plan.md`. Principios en `../../.specify/memory/constitution.md`.

---

## 0. Premisa bajo la que se redacta

Este módulo se redacta bajo el encuadre que la **Constitución v2.0.0** ya recoge formalmente: la plataforma **no opera como fintech supervisada** en esta etapa y **no existe restricción de residencia de datos** (ver su Registro de enmiendas).

- El **Principio I**, reformulado como *protección del dato personal y trazabilidad*, **rige de lleno** aquí: este es precisamente el módulo que custodia los datos de contacto de personas que todavía no son clientes.
- El **Principio II**, reformulado como *portabilidad de la infraestructura*, no impone residencia, pero sí exige que el módulo no se ate a servicios propietarios de un proveedor.
- Rigen plenamente el **Principio V** (montos sin `float`, moneda + tasa BCV), el **VI** (seguridad transversal, mínimo privilegio, secretos fuera del repositorio) y el **VII** (SDD: nada se implementa con `[NEEDS CLARIFICATION]` abierto).

Dejar de estar supervisado quita al regulador, **no la responsabilidad sobre el dato de un tercero**. Este módulo custodia nombre, cédula, teléfono y correo de gente que solo quiso ver un carro, y por eso conserva las exigencias de cifrado, mínimo privilegio y trazabilidad que la Constitución impone por seguridad, no por cumplimiento.

---

## 1. Objetivo

Que ningún interés de compra se pierda por falta de seguimiento. El módulo introduce la **persona** como entidad raíz del ámbito comercial, un **embudo de etapas** sobre cada intención de compra, y un **historial de interacciones** que sobrevive al asesor que lo atendió.

## 2. Por qué importa

Hoy la plataforma ya captura interés —cada cita agendada trae nombre, cédula, WhatsApp, vehículo y modalidad de pago— pero lo captura **como evento aislado**. Los datos de contacto viven dentro de cada cita, así que dos visitas del mismo cliente son dos registros sin relación. El equipo no puede responder tres preguntas que deciden el negocio:

1. **¿Cuántos de los que se interesan compran?** Sin embudo no hay tasa de conversión, y sin tasa de conversión no se sabe si el problema es el tráfico, el precio o el cierre.
2. **¿Por qué se pierden los que se pierden?** Un motivo de pérdida agregado distingue "el precio está alto" de "el financiamiento no califica" de "el auto no era el que buscaban". Son tres problemas distintos con tres soluciones distintas.
3. **¿Qué se le dijo a este cliente la última vez?** Hoy la conversación ocurre en el WhatsApp personal del asesor y no queda en ninguna parte. Si el asesor cambia, el vínculo se pierde entero.

El módulo es deliberadamente **ligero**: cubre esas tres preguntas y nada más. No aspira a reemplazar un CRM comercial cuando el equipo crezca; aspira a que ese día los datos estén limpios y con una persona por cédula.

## 3. Alcance

**Incluye (MVP):**
- `persona` como entidad raíz del ámbito comercial, **deduplicada** al capturar.
- `oportunidad`: intención de compra sobre un vehículo, con **etapa** del embudo y **motivo de pérdida** obligatorio al cerrar en falso.
- `interaccion`: registro **append-only** de cada contacto (canal, dirección, nota, autor).
- Asignación de un **asesor responsable** por oportunidad.
- **Próxima acción** con fecha, para que el seguimiento no dependa de la memoria de nadie.
- Vista de **embudo** por etapa y **ficha 360** de la persona en el backoffice.
- **Métricas del embudo**: conversión entre etapas, tiempo en etapa, motivos de pérdida agregados.

**No incluye (y no es deuda técnica, es decisión de alcance):**
- Campañas, correo masivo y automatizaciones de mercadeo.
- Pronóstico de ventas, cuotas por asesor y cálculo de comisiones.
- Integración con la **WhatsApp Business API** de Meta. Se mantiene el enlace `wa.me`, que es gratuito y no exige verificación de empresa (ver §10).
- Telefonía, grabación o transcripción de llamadas.
- Puntuación automática de prospectos (*lead scoring*).
- Portal de autogestión para que el cliente vea su propio expediente.
- Reemplazo del módulo 009: el tablero administrativo sigue siendo dueño del inventario y la tesorería.

## 4. Actores y roles

| Actor | Qué hace |
|---|---|
| **Asesor comercial** | Atiende las oportunidades asignadas, registra interacciones, mueve etapas |
| **Coordinador comercial** | Ve el embudo completo, reparte oportunidades sin dueño, consulta métricas |
| **Administración** | Consulta de solo lectura para operación y conciliación con inventario |

El asesor **solo ve las oportunidades que le pertenecen** más las que no tienen dueño. El embudo completo es del coordinador. Es mínimo privilegio (Principio VI) aplicado al dato comercial.

## 5. Historias de usuario

- Como **asesor**, quiero ver mis prospectos ordenados por próxima acción vencida, para saber a quién llamar hoy sin revisar una lista completa.
- Como **asesor**, quiero registrar en dos clics lo que hablé por WhatsApp, para que el siguiente que atienda a ese cliente sepa dónde quedó la conversación.
- Como **asesor**, quiero ver todo el historial de una persona —sus oportunidades anteriores y por qué no cerraron—, para no repetir un argumento que ya falló.
- Como **coordinador**, quiero ver cuántos prospectos hay en cada etapa y cuánto tiempo llevan ahí, para detectar dónde se estanca el embudo.
- Como **coordinador**, quiero los motivos de pérdida agregados del mes, para llevar al comité un problema con evidencia en vez de una impresión.
- Como **coordinador**, quiero que al cerrar una venta el vehículo pase a vendido sin que nadie lo haga a mano, para que la vitrina no ofrezca un auto que ya no existe.

## 6. Requisitos funcionales (RF)

### Persona y deduplicación
- **RF-010.1** Toda captura de interés (cita agendada, solicitud de crédito, alta manual) **resuelve o crea** una `persona`. Nunca se crea un registro comercial huérfano.
- **RF-010.2** La deduplicación usa la **cédula** como clave natural cuando está presente; si no, el **teléfono normalizado**. Dos capturas que resuelven a la misma persona producen **una persona y dos oportunidades**.
- **RF-010.3** La ficha de la persona muestra todas sus oportunidades (abiertas y cerradas) y su historial completo de interacciones, en orden cronológico inverso.

### Oportunidad y embudo
- **RF-010.4** Una `oportunidad` representa la intención de compra de **una** persona sobre **un** vehículo. Una persona puede tener varias oportunidades abiertas a la vez.
- **RF-010.5** La oportunidad avanza por las etapas declaradas en §8.1. Toda transición se valida contra la máquina de estados y **queda registrada** con actor y momento.
- **RF-010.6** Cerrar una oportunidad como perdida **exige un motivo** del catálogo de §8.2. Sin motivo, la transición se rechaza.
- **RF-010.7** Cada oportunidad admite un **asesor responsable** y una **próxima acción** con fecha.
- **RF-010.8** Una oportunidad cerrada **no se reabre**. Retomar el contacto crea una oportunidad nueva sobre la misma persona, de modo que las métricas del embudo no se falseen.

### Interacciones
- **RF-010.9** Toda interacción registra canal, dirección (entrante/saliente), nota, autor y momento en que ocurrió.
- **RF-010.10** El historial de interacciones es **append-only**: no se edita ni se borra. Una corrección es una interacción nueva que referencia a la anterior.
- **RF-010.11** Tras usar el enlace de WhatsApp, la interfaz **ofrece** registrar la interacción. No se registra sola: abrir un chat no prueba que hubo conversación.

### Enlace con el resto de la plataforma
- **RF-010.12** Al pasar una oportunidad a `cerrado_ganado`, el vehículo pasa a **vendido**. Al pasar a `cerrado_perdido`, el vehículo vuelve a **disponible**.
- **RF-010.13** La oportunidad puede vincularse a una `solicitud_credito` por referencia. La capa comercial **no accede** al contenido del expediente (ver §8.3).
- **RF-010.14** El módulo provee el `lead_id` que `specs/solicitud-credito/` declara ausente como insumo **D15**, cerrando esa pregunta abierta.

### Métricas
- **RF-010.15** Conversión entre etapas consecutivas y conversión global, en un rango de fechas.
- **RF-010.16** Tiempo medio en cada etapa y listado de oportunidades **estancadas** (sin interacción ni cambio de etapa en N días; N configurable).
- **RF-010.17** Motivos de pérdida agregados por período.

### Venta y financiamiento (decisión del Product Owner, septiembre 2026)
- **RF-010.18** Agendar una cita desactiva «Agendar cita» y «Solicitar financiamiento» en la ficha del vehículo mientras la cita siga abierta.
- **RF-010.19** Una cita confirmada ofrece «Asistió», que lleva la oportunidad a `visito`. Solo después aparece «Vender Vehículo».
- **RF-010.20** «Vender Vehículo» de contado cierra la venta; financiado emite un enlace personal de solicitud de crédito y deja el vehículo reservado (§8.8).
- **RF-010.21** Confirmar una cita, si hay correo, abre el correo del asesor con la confirmación para el cliente (§10). El asesor puede corregir el día y el horario acordados antes de confirmar.

## 7. Requisitos no funcionales

| Requisito | Exigencia |
|---|---|
| **Cifrado de campo** | Cédula, teléfono y correo se cifran en reposo, con índice ciego para permitir la deduplicación sin descifrar (Principio VI). Depende de `platform/crypto` (módulo 001) |
| **Inmutabilidad** | `interaccion` y `etapa_historial` son append-only a nivel de motor de base de datos, no por convención |
| **Mínimo privilegio** | El asesor no lee oportunidades de otros asesores ni datos del expediente de crédito |
| **Montos** | `valor_estimado` sigue el Principio V: precisión fija, moneda y tasa BCV con su fecha. Prohibido `float` |
| **Rendimiento** | La vista de embudo responde en < 500 ms con 5.000 oportunidades abiertas |
| **Retención** | Los datos de prospectos que nunca compran tienen período de conservación definido `[NEEDS CLARIFICATION: C2]` |

## 8. Reglas de negocio

### 8.1 Etapas del embudo

| Etapa | Significado | Quién la produce |
|---|---|---|
| `nuevo` | Interés registrado, nadie lo ha contactado | Automática al capturar |
| `contactado` | Hubo comunicación saliente y el cliente respondió | Asesor, al registrar interacción |
| `cita_confirmada` | Día y hora acordados con el cliente | Asesor, desde la bandeja de citas |
| `visito` | El cliente se presentó en la sede | Asesor, con «Asistió» en la bandeja de citas |
| `negociacion` | Hay una oferta concreta sobre la mesa | Asesor |
| `cerrado_ganado` | Venta concretada | Asesor / coordinador |
| `cerrado_perdido` | No se concretó; exige motivo | Asesor / coordinador |

**Transiciones permitidas:**

- **Avance:** a cualquier etapa posterior. Saltarse etapas es legítimo — hay quien entra a la sede y compra el mismo día.
- **Retroceso:** permitido **con nota obligatoria**. Un cliente se enfría y vuelve a `contactado`; prohibirlo solo consigue que el equipo mienta al sistema para que le cuadre.
- **Cierre:** a `cerrado_perdido` desde cualquier etapa abierta.
- **Desde un estado cerrado:** ninguna. Es terminal (RF-010.8).

Toda transición no declarada se **rechaza y se registra** el intento.

### 8.2 Catálogo de motivos de pérdida

`precio_fuera_de_presupuesto` · `no_califico_financiamiento` · `compro_en_otra_parte` · `dejo_de_responder` · `vehiculo_vendido_a_otro_cliente` · `no_era_el_vehiculo_buscado` · `otro` (exige texto libre)

El catálogo es **cerrado** a propósito. Un campo libre produce cien redacciones del mismo motivo y ninguna métrica.

### 8.3 Separación entre la capa comercial y el expediente de crédito

La capa comercial ve **nombre, teléfono, correo, cédula, vehículo de interés, etapa y notas**. No ve **ingresos, egresos, cuenta bancaria ni recaudos**: eso pertenece al expediente de `specs/solicitud-credito/` y requiere el rol de crédito.

`oportunidad.solicitud_credito_id` es un **puntero, no una unión de datos**. Que el asesor sepa que existe una solicitud y en qué estado está es necesario para vender; que vea cuánto gana el cliente, no.

### 8.4 Dos ejes que no se deben fusionar

`vehiculo.estado` (disponible / cita agendada / vendido) describe **el auto**. `oportunidad.etapa` describe **la negociación**. Son ejes distintos y se relacionan solo por las reglas de RF-010.12 y por el bloqueo del vehículo al crear la oportunidad. Colapsarlos en un solo campo parece una simplificación y es un error: un mismo auto puede tener una oportunidad perdida y otra en negociación.

### 8.5 Captura en dos pasos (decisión C1)

La cédula **no se pide para agendar**. El formulario público exige **nombre y WhatsApp**; el correo es opcional. La cédula se solicita en el **segundo paso**, cuando el asesor confirma la cita y el cliente ya está comprometido.

**Por qué:** pedir cédula para *mirar* un carro es fricción alta en la captación, y hasta ahora nadie ha medido cuántos prospectos se pierden en ese campo. Al mover el dato al momento de la confirmación se captura más arriba del embudo sin renunciar a la deduplicación fuerte: simplemente llega más tarde.

**Consecuencia sobre la deduplicación (RF-010.2):** entre la captura y la confirmación, la persona se resuelve por **teléfono normalizado**. Al llegar la cédula, se consolida:

- Si la cédula **no existe** en otra persona, se adjunta a la actual.
- Si la cédula **ya existe** en otra persona, hay dos registros que son la misma gente y se **fusionan sin descartar ningún dato**: se conservan todos los teléfonos (el más reciente queda como principal) y una copia del registro absorbido, de modo que la fusión se puede auditar y revertir (`plan.md` §5.1).
- Una persona sin cédula **no bloquea** el embudo: avanza hasta `cita_confirmada`, que es donde el dato se exige.

### 8.6 Umbrales de estancamiento (decisión C5)

Una oportunidad está **estancada** cuando lleva sin interacción ni cambio de etapa más de:

| Etapa | Umbral |
|---|---|
| `nuevo` | 2 días |
| `contactado` | 3 días |
| `cita_confirmada` | 7 días |
| `visito` | 7 días |
| `negociacion` | 14 días |

El umbral es **por etapa** y no único, porque un prospecto sin llamar dos días es urgente mientras una negociación de diez días es sana. Un umbral único marcaría en rojo lo normal y en verde lo que se está perdiendo.

Los cinco valores son **parámetros configurables**, no constantes de código: se ajustarán cuando haya datos reales de duración por etapa.

### 8.7 El embudo no es fuente de verdad del inventario

Igual que el módulo 009, este módulo **refleja** el estado del vehículo (005) y **referencia** el expediente de crédito. La fuente de verdad de cada dato sigue siendo su módulo dueño.

### 8.8 Venta tras la visita y habilitación del financiamiento (decisión del Product Owner, septiembre 2026)

Agendar una cita **reserva el vehículo**: en su ficha se desactivan «Agendar cita» y «Solicitar financiamiento» para todos los visitantes.

Después, desde la bandeja de citas:

1. **«Asistió»**, en una cita confirmada, lleva la oportunidad a `visito`.
2. **«Vender Vehículo»** aparece solo después de la asistencia. Pide confirmar la forma de pago, precargada con la que el cliente indicó al agendar, porque puede haber cambiado:
   - **Contado:** cierra la venta (`cerrado_ganado`) y el vehículo pasa a **vendido**.
   - **Financiamiento:** la oportunidad pasa a `negociacion`, el vehículo **sigue reservado** y se emite un **enlace personal** de solicitud de crédito para esa persona y ese vehículo. El asesor lo envía por WhatsApp o por correo. La venta se cierra desde el embudo cuando se apruebe el crédito.

El enlace es la única forma de llegar a la solicitud de crédito (`../solicitud-credito/spec.md` §0.5). Lleva el vehículo, pero ningún dato personal.

**Limitación de la maqueta:** sin servidor, el enlace se valida solo por su forma, así que no es un control de acceso. En producción el token es aleatorio, de un solo uso y con vencimiento, y lo valida el servidor. Además, en la maqueta cada navegador guarda su propio inventario: un vehículo creado desde el backoffice no existe en el teléfono del cliente.

## 9. Entidades de datos

`persona`, `oportunidad`, `interaccion`, `etapa_historial` (ver `../000-overview/data-model.md` §4).

## 10. Integraciones

| Integración | Decisión |
|---|---|
| **WhatsApp** | Enlaces `wa.me` con mensaje prellenado y número venezolano normalizado, como ya hace el backoffice. Gratuito, sin verificación de empresa y sin dependencia de Meta. **Contrapartida asumida:** la conversación ocurre fuera de la plataforma y el registro depende de que el asesor escriba la nota (RF-010.11) |
| **Correo** | Notificación de nueva captura al buzón comercial. Al **confirmar la cita** se abre el correo del propio asesor con la confirmación ya redactada para el cliente: enlace `mailto:`, por decisión del Product Owner, sin proveedor ni dominio. Solo admite texto plano: un correo con diseño y logo exigiría envío desde servidor, fuera de esta etapa. Si el cliente no dejó correo al agendar, el asesor puede anotarlo al confirmar |
| **Módulo 005** | Lectura del vehículo publicado y escritura de su estado de disponibilidad |
| **solicitud-credito** | Entrega del `lead_id`; lectura del **estado** de la solicitud, nunca de su contenido |

El salto a la WhatsApp Business API queda fuera de alcance: cuesta por conversación, exige verificar la empresa ante Meta y solo se justifica con un volumen que hoy no existe.

## 11. Criterios de aceptación (Given/When/Then)

- **CA-010.1** Dadas dos citas agendadas con la misma cédula, cuando se consultan las personas, entonces existe **una** persona con **dos** oportunidades.
- **CA-010.2** Dada una oportunidad abierta, cuando se intenta cerrarla como perdida sin motivo, entonces la operación se rechaza y la etapa no cambia.
- **CA-010.3** Dada una oportunidad en `cerrado_ganado`, cuando se intenta moverla a cualquier etapa, entonces se rechaza y el intento queda registrado.
- **CA-010.4** Dada una interacción registrada, cuando se intenta modificarla o borrarla, entonces **el motor de base de datos lo impide** (no la capa de aplicación).
- **CA-010.5** Dada una oportunidad que pasa a `cerrado_ganado`, cuando se confirma, entonces el vehículo queda en **vendido** y desaparece de la vitrina.
- **CA-010.6** Dada una oportunidad que pasa a `cerrado_perdido`, cuando se confirma, entonces el vehículo vuelve a **disponible** y admite nuevas citas.
- **CA-010.7** Dado un usuario con rol de asesor, cuando consulta una oportunidad con solicitud de crédito vinculada, entonces obtiene el **estado** de la solicitud y **ningún** dato financiero del solicitante.
- **CA-010.8** Dado un asesor, cuando lista el embudo, entonces ve únicamente sus oportunidades y las sin asignar.
- **CA-010.9** Dada una oportunidad con tres cambios de etapa, cuando se consultan las métricas, entonces el tiempo en cada etapa se calcula desde `etapa_historial` y suma el total transcurrido.
- **CA-010.10** Dado un retroceso de etapa sin nota, cuando se intenta, entonces se rechaza.
- **CA-010.11** Dada una persona con cédula, cuando se consulta la base directamente, entonces la cédula está **cifrada** y existe su índice ciego.

## 12. Métricas de éxito

- **Tasa de conversión** `nuevo → cerrado_ganado`, medida por primera vez (hoy no existe el dato).
- **Prospectos sin contactar en 24 h**: debe tender a cero.
- **Oportunidades estancadas** (sin actividad en N días): debe bajar mes a mes.
- **Cobertura de registro**: proporción de oportunidades con al menos una interacción registrada. Mide si el equipo realmente usa el módulo; si es baja, el problema es de fricción en la interfaz, no de disciplina.
- **Distribución de motivos de pérdida**: su utilidad es que deje de estar dominado por `otro`.

## 13. Preguntas abiertas

Ninguna tarea de implementación arranca con estas abiertas si la afecta (Principio VII).

- ~~`C1` **¿La cédula es obligatoria para agendar una cita?**~~ **CERRADO** (septiembre 2026): **captura en dos pasos**. Nombre y WhatsApp para agendar; cédula al confirmar la cita. Ver §8.5.
- `[NEEDS CLARIFICATION: C2]` **Período de conservación** de datos de prospectos que nunca compran. Afecta al requisito de retención de §7.
- `[NEEDS CLARIFICATION: C3]` **Reparto de oportunidades sin dueño:** ¿manual por el coordinador, o automático por turno? Afecta a RF-010.7.
- ~~`C4` **Identidad del asesor mientras el módulo 001 no exista.**~~ **CERRADO** (15/09/2026, D-24): el módulo 001 ya da usuarios reales, con rol y sesión (`CurrentUser`). El CRM los usa como autor de cada interacción y dueño de cada oportunidad cuando pase al servidor (etapa 3).
- ~~`C5` **Umbral de "estancada"**~~ **CERRADO** (septiembre 2026): umbral **por etapa** — 2 / 3 / 7 / 7 / 14 días. Ver §8.6.
- `[NEEDS CLARIFICATION: C6]` **¿Se notifica al cliente** algún cambio de etapa, o el embudo es puramente interno? Afecta al alcance de la integración de correo.
- ~~`C7` **Enmienda de la Constitución** que recoja la premisa de §0.~~ **CERRADO** — Constitución **v2.0.0** (septiembre 2026). El texto vigente y este spec ya no discrepan.

## 14. Trazabilidad

**Constitución v2.0.0:** Principio I (protección del dato personal, mínimo privilegio, conservación declarada), II (portabilidad de la infraestructura), V (montos con precisión fija), VI (seguridad transversal), VII (SDD).
**Overview:** módulo 010 en `../000-overview/product-overview.md` §3; ola 2 en `../000-overview/tasks-build-order.md` §2; entidades en `../000-overview/data-model.md` §4.
**Dependencias:** 001 (identidad, auditoría, cifrado), 005 (vehículo publicado).
**Resuelve:** insumo **D15** (`lead_id`) de `../solicitud-credito/spec.md` §13.
**Código existente que absorbe:** `frontend-web/src/screens/admin/O3_GestionCitas.tsx`, `frontend-web/src/state/vehiculosContexto.tsx`, `frontend-web/src/types/vehiculo.ts` (`CitaSolicitud`).

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
