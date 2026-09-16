# 04 · Financiamiento

**Quién lo usa:** visitantes (simulador y solicitud), asesores (cotizador) y el analista de crédito (bandeja). **Estado:** flujos de la maqueta. En la etapa 4 el cálculo pasa al servidor y se construyen la pantalla de parámetros y la bandeja de crédito.

## Simulador de cuota (sitio público)

En la ficha del vehículo y en la página de financiamiento. El visitante elige la inicial (desde el 20 %) y el plazo, y ve la cuota mensual estimada. Con su ingreso mensual, el simulador indica si la cuota cabe en su capacidad de pago: **el 30 % del ingreso** (decisión del PO). Los gastos se registran como referencia, pero no la reducen.

Es una estimación: no es una oferta de crédito.

## Cotizador de crédito (backoffice)

**Menú:** Cotizador Crédito. Herramienta del asesor para estructurar una propuesta:
1. Elegir un vehículo del inventario, o indicar un precio manual.
2. Anotar nombre y WhatsApp del cliente.
3. Ajustar la inicial (del 20 % al 60 %) y el plazo.
4. Revisar la tabla de amortización (sistema francés: cuota fija) y la evaluación de capacidad de pago.
5. **Copiar propuesta para WhatsApp**: copia al portapapeles un resumen listo para enviar.

*Fallo conocido de la maqueta:* el campo "Tasa mensual" no cambia el cálculo. Se corrige en la etapa 4.

## Solicitud de crédito (sitio público)

Solo se accede con el **enlace personal** que envía el asesor al vender con financiamiento. Sin enlace válido, la página explica cómo obtenerlo.

El formulario tiene ocho pasos, y cada uno explica por qué pide esos datos:
1. Vehículo y condiciones
2. Identificación
3. Ubicación y contacto
4. Información laboral
5. Balance financiero
6. Referencias y banco
7. Recaudos: cédula o pasaporte, RIF, constancia de ingresos, estado de cuenta de seis meses, recibo de servicio o contrato de arrendamiento, y dos referencias personales. Pueden enviarse después
8. Declaraciones y envío: cuatro declaraciones con texto literal del formato WMA-F-FIN-001 (veracidad, consulta a centrales de riesgo, origen de fondos y compromiso de pago), cada una con su casilla obligatoria

Al enviar, el cliente recibe un número de solicitud con el formato `WMA-SC-AAAA-NNNNNN`.

## Cambios previstos en la etapa 4

- El cálculo de cuotas lo hace el servidor, con los parámetros vigentes.
- **Parámetros de financiamiento** (pantalla nueva del backoffice): tasa mensual, plazos y montos mínimo y máximo (D-14).
- La solicitud se guarda en el servidor, cifrada, con sus recaudos en almacenamiento privado (D-09).
- Sin verificación por código OTP: en la maqueta el código aparecía en pantalla. El acceso se controla con el enlace personal, que sirve una sola vez y vence (D-16).
- **Bandeja de crédito** (pantalla nueva del backoffice): listado y detalle de las solicitudes recibidas, con sus recaudos, para el analista de crédito (D-17).
- La moneda del crédito pasa a euros, con alcance por confirmar (D-15).
