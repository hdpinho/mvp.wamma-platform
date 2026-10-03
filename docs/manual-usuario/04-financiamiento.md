# 04 · Financiamiento

**Quién lo usa:** visitantes (simulador y solicitud), asesores (cotizador) y el analista de crédito (bandeja). **Estado:** la política (tasa, plazo, inicial, capacidad) sale del servidor y la solicitud se guarda en el servidor. El análisis y el dictamen están en el capítulo 05.

## Calculadora de capacidad y financiamiento (sitio público)

Disponible en la sección **/financiamiento** y en la ficha de cada vehículo (D-31):
- **Recorrido en 3 pasos:**
  1. **Calcula tu capacidad:** Ingresa tus ingresos mensuales para saber qué cuota máxima puedes asumir y qué vehículos califican.
  2. **Elige tu vehículo y agenda tu cita:** Desde la vitrina agenda tu cita para conocer tu próximo vehículo.
  3. **Completa tu solicitud:** Tras la cita, el asesor te orientará sobre la formalización de tu financiamiento.
- **Regla de capacidad responsable:** Cuota máxima permitida de hasta el **30 % del ingreso mensual comprobable** (D-26).
- **Parámetros aprobados:** Tasa fija mensual de 4.0 % (48 % anual), plazo fijo a 24 meses (sistema francés de cuota fija) e iniciales configuradas al 20 %, 30 % o 40 % del valor del vehículo.
- **Moneda:** Todas las cifras, simulaciones y cuotas se expresan estrictamente en euros (`EUR` / `€`), sin montos en bolívares de cara al usuario en vitrina pública (D-27). Al ingresar el ingreso mensual, el sistema muestra cuántos autos del inventario califican y ofrece el botón para verlos filtrados en la vitrina.

- El campo de ingreso **solo admite números**: no tiene flechas para subir o bajar el valor.
- Si los parámetros no cargan, la calculadora muestra **«cálculo no disponible»** en vez de una cuota con valores de respaldo.
- Desde la barra superior se llega aquí con el acceso **🏦 Wamma - Bank** (D-47), y desde la portada con **Fináncialo** (D-46).

Es una estimación informativa orientada a la capacidad de pago; la aprobación formal se realiza tras la cita y evaluación crediticia.

## Cotizador de crédito (backoffice)

**Menú:** Cotizador Crédito. Herramienta del asesor para estructurar una propuesta:
1. Elegir un vehículo del inventario, o indicar un precio manual.
2. Anotar nombre y WhatsApp del cliente.
3. Ajustar la inicial (del 20 % al 60 %), el plazo (**fijo en 24 meses**, D-55) y la tasa mensual (arranca en 4 %, el valor de la política).
4. Revisar la tabla de amortización (sistema francés: cuota fija) y la evaluación de capacidad de pago.
5. **Copiar propuesta para WhatsApp**: copia al portapapeles un resumen listo para enviar.

Todas las cifras van en euros. La tasa mensual ya entra en el cálculo: el fallo de la maqueta se corrigió el 16/09/2026.

> **Pendiente del PO:** el cotizador sigue permitiendo una inicial de hasta 60 % y cualquier tasa. Hay que confirmar si el asesor puede cotizar fuera de la política aprobada en D-26 (24 meses, 4 % mensual).

**Quién cambia la política:** solo quien tiene el permiso de parámetros (administrador). El servidor acepta únicamente **plazo de 24 meses y moneda base euro**; cualquier otro valor se rechaza. Cada cambio queda en la bitácora con el valor anterior y el nuevo.

## Solicitud de crédito (sitio público)

Solo se accede con el **enlace personal** que envía el asesor al vender con financiamiento. Sin enlace válido, la página explica cómo obtenerlo. El enlace vale 7 días y **sirve una sola vez**: al enviar la solicitud queda usado.

Cuando el enlace se abre, el servidor entrega el vehículo (aunque ya esté reservado para esta venta), la política vigente y lo que el asesor ya sabía de la persona (nombre, cédula, teléfono y correo), para no pedírselo de nuevo.

El formulario tiene ocho pasos, y cada uno explica por qué pide esos datos:
1. Vehículo y condiciones
2. Identificación
3. Ubicación y contacto
4. Información laboral
5. Balance financiero
6. Referencias y banco
7. Recaudos: cédula o pasaporte, RIF, constancia de ingresos, estado de cuenta de seis meses, recibo de servicio o contrato de arrendamiento, y dos referencias personales. Pueden enviarse después. *La lista que se informa al agendar la cita (capítulo 03, D-45) difiere en los meses y en las referencias: pendiente de unificar por el PO (D-74)*
8. Declaraciones y envío: cuatro declaraciones con texto literal del formato WMA-F-FIN-001 (veracidad, consulta a centrales de riesgo, origen de fondos y compromiso de pago), cada una con su casilla obligatoria

Al enviar, el cliente recibe su **número de solicitud** (por ejemplo `SOL-2026-0002`). El número sale de un contador del servidor: dos solicitudes simultáneas nunca comparten número.

### Lo que decide el servidor

- **Las cifras las calcula el servidor**, no el navegador: el monto financiado (precio menos inicial), la cuota (sistema francés, política vigente, redondeada a centavos) y la capacidad de pago (30 % del ingreso declarado). Lo que el navegador mande en esos campos se ignora.
- **Inicial:** al menos el mínimo de la política (20 %) y menor que el precio. Si no, el servidor responde con el motivo y el enlace **no se gasta**.
- **Ingreso mensual:** obligatorio y mayor que cero.
- **Plazo:** 24 meses, fijo; el formulario lo muestra sin selector.
- **Tasa BCV:** si no hay una tasa registrada, el envío se rechaza con un aviso claro; no se inventa un valor.
- **Sin código OTP:** el acceso se controla con el enlace personal (D-16, D-57). La aceptación queda registrada con fecha, IP, agente y versión del texto.
- **Privacidad:** el expediente se guarda cifrado y los recaudos van a un contenedor privado, sin dirección pública (D-09, D-59).

## Si el analista pide más documentos (D-70)

Cuando el analista **condiciona** la solicitud, el cliente recibe por WhatsApp y correo un **enlace nuevo** (el anterior ya no sirve). Ese enlace **no abre el formulario**: abre la pantalla *«Completa los documentos de tu solicitud»*, con el número de su solicitud y la lista de recaudos.

1. Los documentos ya enviados aparecen como **Ya enviado**; los demás, como **Pendiente**.
2. El cliente adjunta lo que le pidieron. Si vuelve a cargar un tipo que ya había enviado (por ejemplo la cédula), **reemplaza** al anterior.
3. Pulsa **Enviar documentos**. Aparece *«Documentos recibidos»* con el **mismo número de solicitud**.
4. La solicitud vuelve a la bandeja del analista, **En evaluación**, y el enlace queda usado.

Por seguridad, esa pantalla pública **no muestra** lo que el analista escribió al condicionar: eso se lo dice el analista o el asesor.

| Mensaje | Cuándo |
|---|---|
| Enlace no disponible · «Este enlace ya se usó para enviar una solicitud…» | El cliente ya envió sus documentos con ese enlace |
| Enlace no disponible · «Este enlace no es válido…» | El analista emitió un enlace nuevo y este dejó de servir |
| Adjunta al menos un documento para completar tu solicitud. | Se pulsó Enviar sin archivos |
| La solicitud … ya no espera recaudos. | El analista decidió mientras tanto |
