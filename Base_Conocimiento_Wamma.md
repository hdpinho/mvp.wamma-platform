# Base de Conocimiento — WAMMA by Token Pago POS

**Documento Maestro de Negocio y Operación.**  
Fuente única de verdad de cifras, políticas comerciales, marca y parámetros del MVP.

---

## 1. Qué es WAMMA y Modelo de Negocio

WAMMA es la plataforma de venta, certificación y financiamiento de vehículos usados garantizados en Venezuela, adaptando el modelo **Kavak** a las particularidades del mercado local.

- **Propuesta de valor:** Compra e inspección rigurosa de vehículos usados, reacondicionamiento, certificación de 240 puntos y financiamiento directo con cuotas fijas bajo sistema de amortización francés.
- **Alcance MVP:** Venta e inventario propio certificado, simulador de cuotas, cotizador interno, CRM de seguimiento de citas y captación de solicitudes de crédito.
- **Fuera del MVP:** Captación de inventario de terceros (K-Price), telemetría GPS en tiempo real y suscripción OCN (Constitución v2.0.0).
- **Regulación:** En esta etapa WAMMA **no opera bajo supervisión de Sudeban** (enmienda v2.0.0 a la Constitución).

---

## 2. Identidad Visual y Marca

- **Colores de marca:**
  - Naranja primario: `#D17438` (`var(--naranja-500)`)
  - Carbón institucional: `#2B2B2B` (`var(--carbon)`)
  - Fondo blanco y superficies neutras cálidas. Prohibido el uso de azules fríos o fondos negros sólidos detrás del logo.
- **Tipografía:** Montserrat (`var(--font-sans)`) para títulos, cuerpo y cifras numéricas.
- **Sede:** Única sede central denominada **Distrito Capital** (Gran Caracas).

---

## 3. Política de Crédito y Capacidad de Pago

- **Evaluación de capacidad:** La capacidad de pago máxima permitida se fija en el **30% del ingreso mensual comprobable** del solicitante.
- **Egresos:** Los gastos fijos declarados se registran únicamente con carácter referencial para el análisis de riesgo; no reducen la capacidad de pago calculada.
- **Acceso:** La solicitud de crédito se realiza en autoservicio asistido tras la visita física al vehículo mediante enlace personal emitido por el asesor comercial.

---

## 4. Parámetros Financieros (Política Aprobada MVP)

> **Decisión del Product Owner (D-26):** Parámetros oficiales de financiamiento vigentes para la plataforma web y backoffice.

| Parámetro | Valor Oficial | Notas |
|---|---|---|
| **Sistema de amortización** | Francés (cuotas fijas) | Cuotas iguales en USD durante todo el plazo |
| **Tasa de interés mensual** | 4.0% mensual | Equivalente al 48.0% anual |
| **Plazo** | Fijo en 24 meses | Sin opciones de plazo variables en el MVP |
| **Factor de amortización** | $\approx 0.0655868313$ | $i / (1 - (1 + i)^{-n})$ con $i = 0.04$ y $n = 24$ |
| **Opciones de inicial** | 20%, 30%, 40% | Selección en el simulador |
| **Inicial mínima** | 20% del valor de venta | Porcentaje base por defecto |
| **Relación cuota / ingreso máxima** | 30% del ingreso mensual | Plazo 24 meses, inicial mínima 20% |
| **Moneda base** | USD (Dólares estadounidenses) | Con referencia en Bolívares (Bs.) a tasa oficial BCV |
| **Formato de presentación** | USD: sin decimales<br>VES: con 2 decimales | Redondeo matemático solo en la capa visual |

### Fórmulas del Motor Unificado

- **Factor francés:** $\text{Factor} = \frac{i}{1 - (1 + i)^{-n}} \quad (\approx 0.0655868313)$
- **Monto financiado:** $\text{Precio} \times (1 - \% \text{ inicial})$
- **Cuota mensual fija:** $\text{Monto financiado} \times \text{Factor}$
- **Cuota mensual máxima:** $\text{Ingreso mensual} \times 0.30$
- **Precio máximo de vehículo:** $\frac{\text{Cuota máxima}}{\text{Factor} \times (1 - \% \text{ inicial})}$
- **Ingreso mensual mínimo:** $\frac{\text{Cuota mensual}}{0.30}$

### Multiplicadores de Capacidad según Inicial

| % Inicial | Divisor efectivo | Multiplicador sobre el ingreso mensual |
|---|---|---|
| **20%** | $\text{Factor} \times 0.80 \approx 0.052469$ | **$\times 5.72$** (exacto: 5.7176) |
| **30%** | $\text{Factor} \times 0.70 \approx 0.045911$ | **$\times 6.53$** (exacto: 6.5344) |
| **40%** | $\text{Factor} \times 0.60 \approx 0.039352$ | **$\times 7.62$** (exacto: 7.6235) |

### Matriz de Capacidad según Ingresos (Inicial 20%)

| Ingreso Mensual | Cuota Máxima (30%) | Precio Máximo del Carro |
|---|---|---|
| **$800** | $240 | $4,574 |
| **$1,000** | $300 | $5,718 |
| **$1,500** | $450 | $8,576 |
| **$2,000** | $600 | $11,435 |
| **$2,500** | $750 | $14,294 |

### Umbrales de Ingreso Mínimo según Inventario (Inicial 20%)

| Precio del Carro | Cuota Fija Mensual | Ingreso Mensual Mínimo |
|---|---|---|
| **$6,000** (piso del rango) | $315 | $1,049 |
| **$8,500** (costo promedio) | $446 | $1,487 |
| **$12,000** (techo del rango) | $630 | $2,099 |
| **$15,400** (Toyota Corolla de referencia) | $808 | $2,693 |

*Nota estratégica:* Con un umbral de ingreso mínimo de ~$1,050 para el vehículo más accesible, la plataforma cuenta con un estado pedagógico "sin resultados" que orienta al usuario a aportar una inicial mayor (30% o 40%) o registrarse como prospecto en el CRM (Módulo 010) para recibir asesoría personalizada.

---

## 5. Tabla de Parámetros en Base de Datos (Supabase Cloud)

Los parámetros no residen fijos en el código cliente; se gestionan en la tabla `parametros_financiamiento` administrada por Flyway (`V0015__parametros_financiamiento.sql`):
- `tasa_mensual NUMERIC(6, 4)`
- `plazo_meses INT`
- `ratio_cuota_ingreso NUMERIC(4, 2)`
- `opciones_inicial NUMERIC(4, 2)[]`
- `inicial_minima NUMERIC(4, 2)`
- `vigente_desde TIMESTAMPTZ`
- `activo BOOLEAN`

**Salvaguarda de seguridad:** Si los parámetros no cargan desde Supabase/Backend, la interfaz **no muestra cuotas con valores de respaldo**. Se presenta el estado de *"Cálculo no disponible"*.

---

## 6. Módulos y Arquitectura Técnica

- **Frontend:** React 19 + TypeScript + Vite (`frontend-web`).
- **Backend:** Spring Boot 4.1 / Java 21 modular (`backend`).
- **Base de Datos:** PostgreSQL en Supabase Cloud con migraciones Flyway y RLS.
- **Almacenamiento:** Compatible con S3 (Supabase Storage).
