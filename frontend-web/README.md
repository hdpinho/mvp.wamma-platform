# WAMMA — Maqueta Visual del Cliente (frontend-web)

Este directorio contiene la maqueta visual navegable y responsiva (mobile-first) de las pantallas de cara al cliente final para el MVP de WAMMA, construida con React, TypeScript, Vite y CSS personalizado. 

## Estructura del Código

De acuerdo con las especificaciones de diseño (`ui-design.md`), el código está organizado de la siguiente manera:

```
frontend-web/src/
├── tokens/        # Colores de marca (#D17438), rampa extendida, semánticos y espaciado
├── components/    # Componentes base presentacionales reutilizables (PrecioMoneda, Boton, etc.)
├── mocks/         # Datos de simulación locales (vehículos, usuario y amortizaciones de crédito)
├── screens/       # Las 6 pantallas cliente C1...C6 del MVP
└── App.tsx        # Enrutador, inicialización de estados y panel de demostración
```

## Pantallas Implementadas (C1...C6)

1. **C1 Catálogo / Vitrina (`screens/C1_Catalogo.tsx`):**
   - Muestra el inventario de vehículos disponibles.
   - Filtros dinámicos por marca, año y rango de precio en USD.
   - Buscador por texto con soporte para listado vacío (`Estado` component).
   - Patrón multi-moneda (USD y VES a tasa BCV).
   - Sello "Certificado · 240 Puntos" visible.

2. **C2 Ficha del Vehículo + Simulador (`screens/C2_FichaVehiculo.tsx`):**
   - Ficha técnica completa del auto y resumen de los 240 puntos de la inspección.
   - **Simulador de Financiamiento:** Slider interactivo de cuota inicial (30% - 70%) y selección de plazos (6, 12, 18, 24 meses) con cálculo automático en base a la tasa de interés del 4% mensual (48% anual).

3. **C3 Vende tu Auto (`screens/C3_VendeTuAuto.tsx`):**
   - Formulario de captación.
   - Motor K-Price mock que genera una cotización estimada al instante.
   - Selector y formulario interactivo para agendar la cita de inspección física.

4. **C4 Onboarding / KYC (`screens/C4_OnboardingKYC.tsx`):**
   - Asistente paso a paso (stepper) que simula el proceso de verificación exigido por Sudeban.
   - Carga de documentos con extracción de datos simulada mediante OCR (Cédula y RIF).
   - Captura biométrica facial y de prueba de vida interactiva con indicaciones temporales (pestañeo, sonrisa).

5. **C5 Solicitud de Financiamiento (`screens/C5_SolicitudFinanciamiento.tsx`):**
   - Formulario de solicitud económica.
   - Simulación visual de consulta de buró de crédito (Access Datametrics) y cruce de listas AML (OFAC/PEP) con traza de auditoría.
   - Muestra resultado de aprobación o rechazo en función del score simulado.

6. **C6 Mi Panel / Pago de Cuota (`screens/C6_MiPanel.tsx`):**
   - Centro de control del deudor con métricas de balance (Deuda restante, próxima cuota y estado del GPS).
   - Tabla de amortización con filas semánticas de estados (`FilaAmortizacion.tsx`).
   - Pasarela Pago Móvil/C2P interactiva para pagar cuotas de forma simulada.
   - **Contabilidad Partida Doble:** Al procesar un pago, muestra en pantalla el asiento contable registrado en el Ledger del backend en partida doble (Debe/Haber en bolívares e indexación en dólares a tasa BCV con clave de idempotencia).

## Panel de Simulación Flotante (Demo Control Panel)

Para facilitar la evaluación visual de todas las variaciones de la interfaz y flujos sin requerir una base de datos real, se ha incluido una consola de control colapsable en la esquina inferior derecha:
- **Nivel KYC:** Cambia dinámicamente entre *Básico* (bloquea la solicitud de crédito con alertas visuales de bloqueo) y *Verificado* (permite acceder a financiamiento).
- **Crédito Activo:** Alterna la presencia de un crédito activo en la sección de "Mi Panel" para pasar de estado vacío al panel con deudas.
- **Mora Cuota 3:** Fuerza la cuota #3 a estado de *Mora* (activando alertas y color de mora) o *Normal*.
- **Tasa BCV:** Slider para variar la tasa de cambio de referencia. Al moverla, todos los precios de la vitrina, del simulador, de la amortización y de la pasarela bancaria se actualizan instantáneamente en bolívares.

## Comandos para levantar localmente

Para levantar el servidor de desarrollo e interactuar con la maqueta:

```bash
cd frontend-web
npm install
npm run dev
```

Abre en tu navegador la URL mostrada en terminal (normalmente `http://localhost:5173`).
