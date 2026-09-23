# Release — 23 de Septiembre 2026
**WAMMA by Token Pago POS — Plataforma MVP**

**Clasificación:** Confidencial · **Fecha:** 23 de Septiembre 2026 · **Versión:** 3.1.0

---

## 🚀 Resumen del Release

Este release consolida los avances de la **Etapa 3 (Módulo 010 - CRM)** en el backend Spring Boot, las mejoras visuales y funcionales del **Portal / Vitrina (Módulo 005)**, y la integración de navegación institucional y requisitos de financiamiento.

---

## 1. Módulo 010 — CRM & Gestión de Prospectos (Ola A)

Se implementó el núcleo puro de dominio del CRM en **Spring Boot (Java 21)** siguiendo arquitectura hexagonal y principios DDD:

- **Entidades de Dominio:**
  - `Prospecto`: Gestión del ciclo de vida del cliente potencial (nuevo, contactado, calificado, cita agendada, ganado, perdido).
  - `Interaccion`: Registro inmutable de llamadas, mensajes de WhatsApp, correos y visitas presenciales.
  - `TareaCrm`: Recordatorios y asignaciones para asesores comerciales con estados de seguimiento.
  - `Oportunidad`: Trazabilidad comercial vinculada a vehículos específicos y solicitudes de financiamiento.
- **Servicios de Aplicación:** Casos de uso desacoplados de persistencia con validaciones de negocio.
- **Decisiones PO Incorporadas:** D-44 a D-48 documentadas formalmente en `specs/000-overview/decisiones-po.md`.

---

## 2. Módulo 005 — Portal y Vitrina de Vehículos

- **Etiquetas Oficiales de Catálogo:**
  - `Recién ingresado` (Verde esmeralda).
  - `Reservado para cita` (Naranja WAMMA con icono ⏱️).
  - `Súper oportunidad` (Gradiente dorado con estrella ⭐).
- **Hero & Barra de Pilares WAMMA:**
  - Botones principales de acción: **"Encuéntralo"** y **"Fináncialo"** con radio de 8px y estilo de marca.
  - Franja horizontal completa de pilares institucionales: *Inspección · Certificación · Financiamiento · Seguro · Acompañamiento*.
- **Modal de Agendamiento de Citas con Requisitos Unificados:**
  - Se unificó la lista de recaudos para financiamiento eliminando la división artificial en pestañas ("Digital" vs "Físico").
  - Ahora se presenta una **única lista clara y consolidada** con los requisitos indispensables (Cédula/Pasaporte, RIF, constancia/certificación CPC, estados de cuenta de 3 a 6 meses, comprobante de domicilio, referencias y validación OTP), indicando que el cliente puede consignarlos en físico el día de la cita o cargarlos digitalmente en su solicitud.
- **Simulador de Financiamiento en Ficha del Vehículo:**
  - Los números del resumen de cabecera (`€ inicial` y `€ × 24 meses`) ahora se muestran en **tamaño destacado (28px, negrita 800)** con la misma jerarquía visual que el precio de contado original.
  - Actualización completamente **reactiva y dinámica**: al cambiar el porcentaje de inicial (20%, 30%, 40%) o el precio en el simulador, las cifras de la cabecera se recalculan de forma inmediata en tiempo real.
- **Portal y Buscador de Vehículos:**
  - Subtítulo oficial de la Vitrina ([`C1_Catalogo.tsx`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/screens/C1_Catalogo.tsx)): actualizado a: *"Todos los vehículos están certificados con Estándar WAMMA: inspeccionados en más de 200 puntos, reacondicionados y con validación legal de documentos. Disponibles ahora, listos para agendar cita."*
  - Ajuste del buscador en la Vitrina: placeholder y criterio actualizados a **`"Buscar por marca o modelo"`**, eliminando la referencia y filtrado por *"versión"*, en coherencia con el buscador principal del Hero.
  - **Orden "Más relevantes":** regla de negocio implementada para que **nunca se muestre Toyota de primero** en los resultados de la vitrina (priorizando alternativas destacadas como Chevrolet Aveo o Hyundai Tucson).
  - **Filtro de Cuota Mensual por Rangos:** se actualizaron las opciones del filtro lateral a la estructura de rangos continuos:
    - **`Hasta 390`** (cuotas ≤ €390/mes).
    - **`Desde 391 hasta 600`** (cuotas entre €391 y €600/mes).
    - **`A partir de 600`** (cuotas > €600/mes).
    - Opción de reset rápido **`Ver todo`**.
- **Ficha Técnica y Especificaciones del Vehículo:**
  - Se incorporó el atributo **`"Cantidad de dueños"`** en el bloque de Especificaciones de la ficha del vehículo ([`C2_FichaVehiculo.tsx`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/screens/C2_FichaVehiculo.tsx)), permitiendo visibilizar la cantidad de propietarios previos (por defecto 1 dueño) junto al VIN, kilometraje, transmisión y tracción.
  - Actualización del encabezado del bloque de inspección a **`"Certificación Estándar WAMMA"`** en consonancia con la nueva identidad de marca.
- **Distintivo Oficial de Calidad y Armonización Institucional:**
  - Sustitución transversal del texto `"Inspección 240 puntos"` por la denominación oficial **`"Certificado Con Estándar WAMMA"`** en:
    - Pie de las tarjetas de vehículo de la vitrina ([`TarjetaVehiculo.tsx`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/components/TarjetaVehiculo.tsx)).
    - Modal de agendar cita presencial ([`ModalAgendarCita.tsx`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/components/ModalAgendarCita.tsx)).
    - Sello oficial tipo píldora ([`SelloCertificado.tsx`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/components/SelloCertificado.tsx)).
    - Título HTML de la aplicación web: `WAMMA — Certificado con Estándar WAMMA` ([`index.html`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/index.html)).
    - Slogan y enlaces del sitemap institucional en el pie de página ([`PiePagina.tsx`](file:///c:/Users/hdpinho/mvp.wamma-platform/frontend-web/src/components/PiePagina.tsx)).
- **Navegación Móvil:** Encabezado superior fijo con logo oficial horizontal WAMMA y acceso directo `🏦 Wamma - Bank`.

---

## 3. Entorno de Ejecución Local y Puertos

| Servicio | Tecnología | Puerto Local | Estado |
|---|---|---|---|
| **Frontend Web (WAMMA)** | React 19 + Vite | `http://localhost:5176/` | **Activo** |
| **Backend API (WAMMA)** | Spring Boot 3.3 + JDK 21 | `http://localhost:8080/` | Standalone / Supabase |
| **SIGRIT (Mockup)** | React + Vite | `http://localhost:5173/` | **Activo** |

---

## 4. Estado de CI/CD y Despliegue en la Nube

- **Frontend en Vercel:** [https://wamma-mvp.vercel.app](https://wamma-mvp.vercel.app)
- **Backend en Render:** [wamma-backend](https://render.com) (Health check: `/api/health`)
- **Repositorio Central:** Rama `main` sincronizada con Git.
