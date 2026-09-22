# 04 · Financiamiento

**Quién lo usa:** visitantes (simulador y solicitud), asesores (cotizador) y el analista de crédito (bandeja). **Estado:** flujos de la maqueta. En la etapa 4 el cálculo pasa al servidor y se construyen la pantalla de parámetros y la bandeja de crédito.

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
3. Ajustar la inicial (del 20 % al 60 %), el plazo (6, 12, 18, 24 o 36 meses; arranca en 18) y la tasa mensual (arranca en 4 %).
4. Revisar la tabla de amortización (sistema francés: cuota fija) y la evaluación de capacidad de pago.
5. **Copiar propuesta para WhatsApp**: copia al portapapeles un resumen listo para enviar.

Todas las cifras van en euros. La tasa mensual ya entra en el cálculo: el fallo de la maqueta se corrigió el 16/09/2026.

> **Pendiente del PO:** el cotizador permite condiciones fuera de la política aprobada en D-26: plazos distintos de 24 meses, inicial de hasta 60 % y cualquier tasa. Hay que confirmar si el asesor puede cotizar fuera de política.

## Solicitud de crédito (sitio público)

Solo se accede con el **enlace personal** que envía el asesor al vender con financiamiento. Sin enlace válido, la página explica cómo obtenerlo.

El formulario tiene ocho pasos, y cada uno explica por qué pide esos datos:
1. Vehículo y condiciones
2. Identificación
3. Ubicación y contacto
4. Información laboral
5. Balance financiero
6. Referencias y banco
7. Recaudos: cédula o pasaporte, RIF, constancia de ingresos, estado de cuenta de seis meses, recibo de servicio o contrato de arrendamiento, y dos referencias personales. Pueden enviarse después. *La lista que se informa al agendar la cita (capítulo 03, D-45) difiere en los meses y en las referencias: pendiente de unificar por el PO*
8. Declaraciones y envío: cuatro declaraciones con texto literal del formato WMA-F-FIN-001 (veracidad, consulta a centrales de riesgo, origen de fondos y compromiso de pago), cada una con su casilla obligatoria

Al enviar, el cliente recibe un número de solicitud con el formato `WMA-SC-AAAA-NNNNNN`.

## Cambios previstos en la etapa 4

- El cálculo de cuotas lo hace el servidor, con los parámetros vigentes.
- **Parámetros de financiamiento:** los valores aprobados en D-26, que cerró D-14, se leen del servidor. D-14 preveía además una pantalla del backoffice para editarlos. D-26 no la menciona: se confirma al planificar la etapa 4.
- La solicitud se guarda en el servidor, cifrada, con sus recaudos en almacenamiento privado (D-09).
- Sin verificación por código OTP: en la maqueta el código aparecía en pantalla. El acceso se controla con el enlace personal, que sirve una sola vez y vence (D-16).
- **Bandeja de crédito** (pantalla nueva del backoffice): listado y detalle de las solicitudes recibidas, con sus recaudos, para el analista de crédito (D-17).
- El crédito va en euros, como el resto de la plataforma (D-21, que cerró el alcance que D-15 dejaba abierto).
