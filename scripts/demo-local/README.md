# Demostración local de WAMMA

Recorrido de unos 20 minutos, **de la vitrina a la aprobación del crédito**, sobre una base local desechable. No toca Supabase, Render ni Vercel. Todo lo que se muestra funciona contra el servidor; lo que no, está marcado en «Lo que no se debe prometer».

## Antes de empezar

1. **Navegador:** Chrome o Edge, con las **ventanas emergentes permitidas** para `localhost:5174` (el candado de la barra de direcciones → *Ventanas emergentes* → Permitir). WAMMA abre WhatsApp en una pestaña nueva y, sin ese permiso, el navegador la bloquea; en ese caso la pantalla ofrece un botón para abrirla con un clic.
2. **WhatsApp:** tener abierta la sesión de WhatsApp Web (o la aplicación de escritorio) con una cuenta de prueba.
3. **Correo:** Windows debe tener un programa de correo predeterminado para los enlaces `mailto:` (Outlook, Correo de Windows…). Si no hay, WhatsApp funciona igual.
4. **Arranque** (PowerShell, desde la carpeta del proyecto):

   ```powershell
   .\scripts\demo-local\iniciar-demo.ps1
   ```

   Tarda 1 o 2 minutos. Al final muestra los usuarios. **Cada arranque empieza de cero**: lo que se haga se pierde al apagar.
5. **Apagar:** `.\scripts\demo-local\detener-demo.ps1`.

| Qué | Dirección |
|---|---|
| Vitrina pública | http://localhost:5174 |
| Backoffice | http://localhost:5174/admin/ingresar |

### Usuarios

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin.local` | `Demostracion WAMMA 2026 administrador` |
| Asesor comercial | `demo.asesor` | `Demostracion WAMMA 2026 asesor` |
| Coordinador comercial | `demo.coordinador` | `Demostracion WAMMA 2026 coordinador` |
| Analista de crédito | `demo.analista` | `Demostracion WAMMA 2026 analista` |
| Inventario | `demo.inventario` | `Demostracion WAMMA 2026 inventario` |
| Auditor | `demo.auditor` | `Demostracion WAMMA 2026 auditor` |

**Segundo factor.** Cada ingreso pide un código de 6 dígitos. Sin teléfono, se obtiene el vigente con:

```powershell
node scripts/demo-local/codigo-2fa.mjs demo.analista
```

El código vale 30 segundos y **no se puede usar dos veces**: si un ingreso se rechaza, espera al siguiente.

### Datos que ya hay

- **16 vehículos** en la vitrina, con foto y cuota «desde» según la política vigente.
- **Tres prospectos** en el CRM: María Rodríguez (cita agendada), Carlos Mendoza (ya visitó, pago de contado) y Alejandro Gómez (en negociación).
- **Una solicitud de crédito** ya enviada (Carlos Mendoza), esperando al analista.

## Guion

> Conviene tener **tres ventanas**: una de **incógnito** para el cliente (la vitrina y su enlace), una para el **asesor** y otra para el **analista**. Así no se mezclan las sesiones.

### 1 · El cliente conoce la vitrina (sin ingresar)

1. Abrir http://localhost:5174. En **Catálogo**, mostrar las 16 tarjetas, los filtros por cuota y el orden por relevancia.
2. Entrar a una **ficha**: fotos, datos, el simulador de cuota (inicial 20/30/40 %, 24 meses, tasa 4 % mensual) y las imperfecciones declaradas.
3. En **Financiamiento**, mostrar la calculadora de capacidad: «cuota máxima del 30 % del ingreso».

### 2 · El cliente agenda su cita

1. En la ficha, **Agendar cita**: nombre, WhatsApp, **correo** (opcional), día y turno. Confirmar.
2. Mostrar el mensaje de éxito con el turno registrado y qué documentos llevar.
3. Volver al catálogo: el vehículo ya figura **con cita** y nadie más puede agendarlo.

### 3 · El asesor atiende (`demo.asesor`)

1. **Citas y Solicitudes**: aparece la cita nueva, **sin asesor asignado** (todos los asesores ven las nuevas; «tomar» y «repartir» no están en esta versión).
2. **Confirmar cita**: escribir una cédula (ej. `V-24123456`) y confirmar. **Se abren solos WhatsApp y, si el cliente dejó correo, el correo**, con la confirmación redactada. Mostrar el aviso de la pantalla.
3. **Asistió a la cita** → **Vender Vehículo** → *Financiamiento* → **Emitir enlace de financiamiento**. **Se abre solo WhatsApp con el enlace personal** dentro del mensaje.
4. Señalar que el enlace aparece **una sola vez** (por seguridad el servidor guarda solo su huella). Copiarlo para el siguiente paso.

### 4 · El cliente solicita el crédito (ventana de incógnito, enlace copiado)

1. Abrir el enlace. Mostrar el vehículo, el **plazo fijo de 24 meses** y que **ya vienen precargados** su nombre, cédula, teléfono y correo.
2. Recorrer los 8 pasos (cada uno explica para qué pide los datos). En **Recaudos**, adjuntar un par de archivos (JPG, PNG o PDF).
3. En el último paso aceptar las declaraciones y **Enviar solicitud**: aparece el **número de solicitud** (`SOL-AAAA-NNNN`).
4. Volver a abrir el mismo enlace: dice que **ya se usó**.

### 5 · El analista decide (`demo.analista`)

1. **Solicitudes Crédito**: la solicitud nueva y la que ya estaba. **Revisar**.
2. Recorrer el expediente: operación y capacidad de pago (**calculadas por el servidor**), datos del solicitante y evidencia de aceptación. Pulsar **Ver** en un recaudo: se abre con un enlace firmado que vence en minutos.
3. **Pedir documentos:** elegir *Condicionar*, escribir qué falta y **Registrar dictamen**. **Se abre solo WhatsApp** con el texto aprobado y el **enlace para completar los documentos**.
4. En la ventana del cliente, abrir ese enlace: no repite el formulario; muestra *«Completa los documentos de tu solicitud»*, con lo ya enviado marcado. Subir un documento (uno repetido **reemplaza** al anterior) y **Enviar documentos**.
5. De vuelta en el analista: la solicitud sigue **con el mismo número** y vuelve a **En evaluación**. Marcar los recaudos como **Conforme**, elegir *Aprobar crédito*, indicar el límite y la cuota máxima, escribir la justificación y **Registrar dictamen**. **Se abre solo WhatsApp** con el aviso de aprobación (sin cifras).
6. *(Opcional)* **Reabrir expediente**: con el crédito aprobado, escribir por qué y reabrirlo; vuelve a *En evaluación* y se puede dictaminar de nuevo.

### 6 · Se cierra la venta (`demo.asesor`)

1. **Citas y Solicitudes**: la tarjeta muestra **Crédito aprobado · SOL-…** (solo número y estado: el asesor no ve cifras ni documentos) y el botón para avisar al cliente.
2. En **Embudo Comercial**, mover la oportunidad a **Vendido**. El vehículo sale de la vitrina.

### 7 · Otros roles (si hay tiempo)

| Rol | Qué mostrar |
|---|---|
| `demo.inventario` | Alta y edición de vehículos, fotos, publicación |
| `demo.coordinador` | Embudo y Personas completos; **no** puede asignar asesores |
| `demo.auditor` | Bitácora inmutable (cada apertura de expediente, dictamen y reapertura queda registrada); lee los expedientes pero **no dictamina** |
| `admin.local` | Usuarios y roles, tasa BCV, parámetros de financiamiento (solo plazo de 24 meses y euros) |

## Lo que no se debe prometer

- **No hay envío automático de mensajes por el servidor.** WhatsApp y el correo **se abren solos** con el mensaje listo, y una persona de WAMMA lo envía. No hay SMTP ni la API de WhatsApp Business.
- **Al agendar una cita no sale ningún correo al equipo**: la cita aparece en la bandeja del backoffice.
- **El crédito se dictamina a mano.** No hay puntaje, ni verificación de listas (AML), ni Score Buró: están fuera de esta entrega.
- **Fotos:** las 9 que se muestran con «Origen por confirmar» son de demostración y su origen está pendiente. Las imperfecciones de la ficha son demostrativas (llevan su nota).
- **Textos pendientes de aprobación del PO:** la lista oficial de recaudos, el aviso legal de reserva, las afirmaciones comerciales de la vitrina (por ejemplo «Certificado con Estándar WAMMA» y «Fotografías reales de estudio» en el pie de página) y el texto legal definitivo de las declaraciones.
- **Después de aprobar el crédito** no hay desembolso, pagos ni contabilidad: fuera del alcance (D-65).
- **Todo es local.** Nada de esto está publicado en Vercel ni en Render (D-56).

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| «El puerto 8080 ya está en uso» | `detener-demo.ps1` y volver a iniciar |
| El ingreso rechaza el código | Esperar el siguiente código de `codigo-2fa.mjs` (no se reutilizan) |
| «No pudimos validar tu enlace» | El backend se reinició: la base nace vacía y el enlace ya no existe. Emitir uno nuevo |
| No se abre WhatsApp | Permitir ventanas emergentes; si no, usar el botón **WhatsApp** del aviso |
| No se abre el correo | Falta un programa de correo predeterminado; usar WhatsApp |
| Registros del servidor | `scratch/demo/backend.log` |
