# Resumen de Mejoras — 18 Septiembre 2026

Se implementaron las mejoras solicitadas en la vitrina de vehículos y en el proceso de agendamiento de citas presenciales de WAMMA.

---

## 1. Etiquetas de la Vitrina sobre los Vehículos

Se ajustó la lista de etiquetas permitidas a **únicamente las tres opciones oficiales**:
- **`Recién ingresado`**: Distintivo verde esmeralda para vehículos de reciente incorporación.
- **`Reservado para cita`**: Distintivo naranja WAMMA con icono de reloj ⏱️ para unidades con visita agendada o reserva activa.
- **`Súper oportunidad`**: Distintivo con gradiente dorado/ámbar y estrella ⭐ para oportunidades comerciales destacadas.

### Archivos actualizados:
- [`frontend-web/src/types/vehiculo.ts`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/types/vehiculo.ts): Definición del tipo `EtiquetaVehiculo = 'Recién ingresado' | 'Reservado para cita' | 'Súper oportunidad'`.
- [`frontend-web/src/types/inventario.ts`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/types/inventario.ts): Mapeo API-UI y `OPCIONES_ETIQUETA` para el catálogo y backoffice.
- [`frontend-web/src/api/catalogo.ts`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/api/catalogo.ts): Contrato TypeScript para las etiquetas de catálogo.
- [`frontend-web/src/components/TarjetaVehiculo.tsx`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/components/TarjetaVehiculo.tsx): Renderizado estético y badges de la vitrina.
- [`frontend-web/src/screens/C2_FichaVehiculo.tsx`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/screens/C2_FichaVehiculo.tsx): Insignia sobre la foto principal y banners informativos de disponibilidad.
- [`frontend-web/src/mocks/vehiculos.ts`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/mocks/vehiculos.ts): Inventario simulado actualizado con las 3 etiquetas oficiales.
- [`backend/src/main/resources/demo/inventario.json`](file:///c:/Users/hdpinho/mvp.wamma-platform/backend/src/main/resources/demo/inventario.json): Catálogo demo de Spring Boot actualizado.
- [`backend/src/main/java/com/wamma/inventory/VehicleInput.java`](file:///c:/Users/hdpinho/mvp.wamma-platform/backend/src/main/java/com/wamma/inventory/VehicleInput.java): Validación `@Pattern` de etiquetas en el API.
- [`backend/src/main/resources/db/migration/V0016__actualizar_etiquetas_vitrina.sql`](file:///c:/Users/hdpinho/mvp.wamma-platform/backend/src/main/resources/db/migration/V0016__actualizar_etiquetas_vitrina.sql): Migración Flyway para actualizar la restricción `CHECK` en base de datos.

---

## 2. Requisitos de Financiamiento en el Formulario de Agendar Cita

En el modal de agendar cita ([`ModalAgendarCita.tsx`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/components/ModalAgendarCita.tsx)), se integró un módulo informativo con selectores de pestañas interactivas para que el cliente conozca con antelación los recaudos que debe preparar:

### 📱 Requisitos en Digital *(para cargar en la solicitud en línea tras la visita)*
1. **Cédula o Pasaporte vigente:** Archivo PDF o fotografía nítida y legible por ambas caras.
2. **RIF personal actualizado:** Comprobante digital descargado del SENIAT con domicilio vigente.
3. **Constancia de Trabajo o Certificación de Ingresos:** En dependencia: membretada con sueldo mensual. Independientes: certificación de ingresos visada por contador público (CPC).
4. **Estados de cuenta bancarios:** PDF oficial descargado del banco de los últimos 3 a 6 meses donde se reflejen los ingresos.
5. **Comprobante de domicilio:** Recibo de servicio público (luz, agua, gas o telefonía fija) o contrato de arrendamiento vigente.
6. **Referencias:** Datos de contacto de 2 referencias personales y 1 familiar.

### 🏛️ Requisitos en Físico *(para llevar el día de la cita en sede)*
1. **Cédula de Identidad laminada original vigente:** Requisito indispensable para acceso a las instalaciones y validación de identidad.
2. **Copia física impresa del RIF vigente.**
3. **Original de Constancia laboral o Certificación CPC:** En papel con firmas autógrafas y sello húmedo / timbre fiscal.
4. **Copia física de recibo de servicio o contrato de alquiler:** Para el expediente de residencia.
5. **Teléfono móvil con WhatsApp activo:** Para recibir y validar en recepción el código OTP de seguridad.

### Pantalla de Confirmación de Cita
Se agregó un cuadro resumen de chequeo con la lista de recaudos físicos y digitales para que el cliente los tenga presentes una vez confirmada su cita.

---

---

## 3. Rediseño del Hero y Barra de Pilares WAMMA

1. **Botones de acción WAMMA**: Modificados a "Encuéntralo" y "Fináncialo", con formato cuadrado de esquinas redondeadas (`border-radius: 8px`), tamaño prominente y color naranja WAMMA (`#D17438`).
2. **Textos y buscador**:
   - Subtítulo: *"Olvídate de ir de un lado a otro. Aquí resolvemos todo el camino, para que llegues tranquilo al carro que se ajusta a ti."*
   - Placeholder del buscador: *"Buscar por marca o modelo (ej. Chevrolet, Aveo, Fiesta, Arauca)"*.
3. **Barra de Pilares WAMMA**:
   - Desplegada a todo el ancho en la base del Hero: **Inspección · Certificación · Financiamiento · Seguro · Acompañamiento**.
   - Tipografía refinada Montserrat en negrita blanca (`#FFFFFF`), con separadores de punto medio `·` y distribución uniforme (`justify-content: space-evenly`).
   - Sin recuadros ni iconos circulares pesados, brindando un acabado editorial limpio y corporativo acorde a la maqueta de referencia.
   - Soporte para desplazamiento táctil horizontal en dispositivos móviles.
4. **Encabezado Móvil con Logo Oficial**:
   - Se incorporó la barra superior fija (`.barra-movil-superior`) para visualización en navegadores móviles y tablets (`<= 1024px`).
   - Muestra el Logo oficial WAMMA horizontal naranja en la esquina superior izquierda y el botón de acceso directo `🏦 Wamma - Bank` en la derecha.

---

## 4. Pruebas y Validación

- **TypeScript (`tsc -b`):** 0 errores de compilación.
- **Pruebas unitarias (`npm run test`):** 17/17 pruebas pasando satisfactoriamente.
- **Validación Visual en Navegador:** Verificado con el subagente de navegación en `http://localhost:5175/`:
  - Vitrina de vehículos: Se verificaron las nuevas etiquetas oficiales (`Recién ingresado`, `Reservado para cita`, `Súper oportunidad`).
  - Modal de cita: Apertura, navegación entre pestañas digital y física, y checklist de confirmación.
  - Calculadora de capacidad: Eliminación de flechas stepper nativas y validación estricta numérica.
  - Hero y Barra de Pilares: Estética de alta fidelidad, con botones "Encuéntralo" / "Fináncialo" y franja de pilares WAMMA refinada.
  - Navegación Móvil: Logo oficial WAMMA visible y fijo en la parte superior en resolución móvil (390x844).
