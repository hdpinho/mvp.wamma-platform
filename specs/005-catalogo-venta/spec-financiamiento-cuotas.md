# Spec · Motor Unificado de Financiamiento y Calculadoras de Cuota

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**  
**Clasificación:** Confidencial · **Rev.:** 1 · **Septiembre 2026**  
**Módulo:** 005 (Catálogo, Ficha y Financiamiento) / 006 (Parámetros Financieros)  
**Estado:** **Propuesta para aprobación del Product Owner**  

---

## 1. Objetivo
Unificar y centralizar el cálculo de cuotas fijas de financiamiento automotriz (sistema francés) en un único motor matemático puro (`financiamientoMotor.ts`), eliminando cualquier cálculo disperso o duplicado en el frontend, parametrizando las políticas comerciales en Supabase Cloud vía Flyway y proveyendo dos interfaces visuales:
1. **Simulador de cuota en la ficha del vehículo.**
2. **Calculadora de cuota máxima según ingresos.**

---

## 2. Parámetros Aprobados de Política Financiera

| Parámetro | Valor Aprobado | Columna en BD |
|---|---|---|
| **Tasa de interés** | 4.0% mensual (48% anual simple) | `tasa_mensual` (`0.0400`) |
| **Sistema de amortización** | Francés (cuota fija mensual) | — |
| **Plazo** | Fijo en 24 meses (sin selector para el usuario) | `plazo_meses` (`24`) |
| **Opciones de inicial** | 20%, 30%, 40% | `opciones_inicial` (`{0.20, 0.30, 0.40}`) |
| **Inicial mínima** | 20% | `inicial_minima` (`0.20`) |
| **Capacidad de pago máxima** | 30% del ingreso mensual neto | `ratio_cuota_ingreso` (`0.30`) |
| **Moneda base** | USD con referencia en Bolívares a tasa oficial BCV | `moneda_base` |

---

## 3. Fórmulas Matemáticas del Motor Único

- **Factor de amortización:**  
  $$\text{factor} = \frac{i}{1 - (1 + i)^{-n}}$$  
  Con $i = 0.04$ y $n = 24$: $\text{factor} \approx 0.0655868313$.

- **Monto financiado:**  
  $$\text{montoFinanciado} = \text{precio} \times (1 - \text{pctInicial})$$

- **Cuota mensual:**  
  $$\text{cuota} = \text{montoFinanciado} \times \text{factor}$$

- **Cuota mensual máxima admisible:**  
  $$\text{cuotaMaxima} = \text{ingreso} \times \text{ratioCuotaIngreso} \quad (0.30)$$

- **Precio máximo financiable:**  
  $$\text{precioMaximo} = \frac{\text{cuotaMaxima}}{\text{factor} \times (1 - \text{pctInicial})}$$

- **Ingreso mínimo requerido para un vehículo:**  
  $$\text{ingresoMinimo} = \frac{\text{cuota}}{\text{ratioCuotaIngreso}} \quad (0.30)$$

### Criterios de Redondeo y Precisión
- Los cálculos internos operan siempre con precisión decimal completa (`number` de doble precisión).
- **USD:** se formatea sin decimales (número entero redondeado), salvo en tablas de detalle técnico legal.
- **Bolívares (VES):** con 2 decimales y separador de miles oficial (`es-VE`).

---

## 4. Requisitos Funcionales

### RF-FIN-01: Motor Matemático Puro
Módulo TypeScript independiente (`financiamientoMotor.ts`) sin librerías de UI ni estado de React:
- `calcularFactor(tasaMensual, plazoMeses): number`
- `calcularCuota(precio, pctInicial, params): number`
- `calcularCuotaMaxima(ingreso, params): number`
- `calcularPrecioMaximo(ingreso, pctInicial, params): number`
- `calcularIngresoMinimo(precio, pctInicial, params): number`
- `simularOpciones(precio, params): OpcionFinanciamiento[]`
- Manejo estricto de entradas no válidas: números $\le 0$, `null`, `undefined` o `NaN` arrojan error controlado o resultado nulo, sin romper la interfaz.

### RF-FIN-02: Tabla de Parámetros en Base de Datos (Supabase / Flyway)
- Tabla `parametros_financiamiento` gestionada por migración Flyway `V0015`.
- RLS habilitado: lectura pública para registros con `activo = true`, escritura restringida al rol administrativo / `wamma_app`.
- Si los parámetros fallan al cargar desde la API: la interfaz **no** realiza cálculos con valores inventados; muestra el estado **"Cálculo no disponible"**.

### RF-FIN-03: Simulador en Ficha del Vehículo
- Encabezado con marca, modelo y versión.
- Muestra "$X inicial" y "$Y × 24 meses" usando 20% de inicial por defecto.
- Referencia en Bolívares calculada con la tasa BCV oficial del sistema.
- Botón **"Agendar"** acompañado de la nota de reserva/bloqueo (texto parametrizado en constante pendiente de confirmación legal).
- Sección **"Simula tu cuota"** (subtítulo: *"Ajusta la inicial para ver cuánto pagarías al mes"*):
  - Selector de inicial con 3 opciones exclusivas: **20%**, **30%**, **40%**.
  - Plazo fijo visible como texto estático: *"Plazo: 24 meses"*.
  - Recuadro de resultado con etiqueta exacta: **"Cuota"** (sin "mensual" ni "estimada").
  - Desplegable interactivo **"Ver detalle"** que agrupa desglose de tasa, costo financiero total y monto neto a financiar (reservado para validación legal).

### RF-FIN-04: Calculadora de Cuota Máxima según Ingresos
- Campo de ingreso mensual con validación numérica estricta ($> 0$).
- Plazo fijo: *"Plazo: 24 meses"*.
- Cálculo inmediato de **"Cuota mensual máxima"** ($= \text{ingreso} \times 0.30$).
- Botón **"Ver vehículos con estas cuotas"**: redirige al catálogo con filtro en query param (`/catalogo?precioMax=...`).
- Estado "Sin resultados":
  - Explica pedagógicamente que elevar la inicial a 30% o 40% amplía los vehículos accesibles.
  - Informa cuántos vehículos calificarían con 30% y con 40%.
  - Ofrece enlace directo al flujo de prospección del Módulo 010 (CRM) para asesoría personalizada.

---

## 5. Pruebas Unitarias Obligatorias
El motor contará con suite de pruebas automáticas que validan con tolerancia $\le \pm 0.01$:
- Factor para $i=0.04, n=24 \rightarrow 0.0655868313$.
- Cuotas para precio $\$15,400$ al 20%, 30% y 40% ($\$808.03$, $\$707.03$, $\$606.02$).
- Cuota máxima para ingreso $\$1,000 \rightarrow \$300.00$.
- Precio máximo para ingreso $\$1,000$ al 20%, 30% y 40% ($\$5,717.61$, $\$6,534.41$, $\$7,623.48$).
- Precio máximo para ingreso $\$2,000$ al 20% $\rightarrow \$11,435.22$.
- Ingreso mínimo para precios de $\$6,000$ y $\$12,000$ ($\$1,049.39$ y $\$2,098.78$).
- Validaciones con ceros, números negativos y cadenas vacías.
