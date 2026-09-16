# 005 · Desglose de tareas — Etapa 2: inventario, catálogo y tasa BCV

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Septiembre 2026**
**Referencias:** `./spec.md` (QUÉ) · `./plan.md` (CÓMO)
**Estado:** **Aprobado** por el Product Owner el 15 de septiembre de 2026 (D-25)

> Tareas ordenadas por dependencia. Cada una declara cómo se verifica. Todo se construye y se prueba **en local** (PostgreSQL embebido y almacenamiento en disco). Supabase y Render solo se tocan en la ola H, con confirmación.

---

## 0. Puerta de entrada

| Bloqueante | Bloquea | Estado |
|---|---|---|
| Aprobación del spec Rev. 2, del plan y de estas tareas | Todo | **Cerrado** (D-25) |
| **P-005.1 / E9:** fotos de demostración | E1 | **Cerrado**: opción A |
| **P-005.2 / E10:** mínimo de fotos | A4, D4 | **Cerrado**: de 5 a 10 |
| **P-005.3 / E11:** publicar sin certificar | A4, D4 | **Cerrado**: con aviso y sin sello |
| **E4:** VIN obligatorio | B1, D2 | **Cerrado** |
| **E15:** coordinación con la otra sesión (EUR) | F2 a F5 | Se toman esos archivos cuando esa sesión termine |

---

## Ola A · Núcleo puro (sin base de datos)

### A1 — Dinero y conversión
`Money` (`BigDecimal` con escala 2 y moneda) y la conversión EUR → VES con `HALF_UP`.
**Verifica:** redondeo en los casos límite; rechaza monedas mezcladas; nunca usa `double`.

### A2 — Procesado de fotos
Se decodifica (JPEG, PNG y WebP), se reduce a 1600 px y a 640 px, y se codifica como JPEG; el tipo se valida por su firma.
**Verifica:** CA-005.8 (el GPS desaparece), tamaños y proporción, y rechazo de lo que no es imagen o supera los 10 MB.

### A3 — Correspondencias con la maqueta
Transmisión, combustible, carrocería, etiqueta y disponibilidad entre los valores de la maqueta y los de la base.
**Verifica:** ida y vuelta de cada valor.

### A4 — Reglas
Cuándo se puede publicar (fotos, precio, tasa y certificación según E11), transiciones de disponibilidad (§4.2 del plan) y siguiente código `WAM-`.
**Verifica:** tabla de casos.

---

## Ola B · Datos

### B1 — Migración V0014
Los cambios de `plan.md` §3.
**Verifica:** pruebas nuevas en `pruebas-esquema.sql`; desde cero en local y en la CI.

### B2 — Repositorios JDBC
Vehículo, publicación, fotos, inspección y tasa.
**Verifica:** las pruebas de integración ejecutan cada consulta contra el esquema real.

---

## Ola C · Almacenamiento

### C1 — Puerto y adaptador de disco
`AlmacenFotos`, la carpeta local y `/archivos/**`.
**Verifica:** guardar, servir y borrar; una ruta con `..` se rechaza.

### C2 — Adaptador S3
AWS SDK v2 apuntado a un endpoint configurable.
**Verifica:** en local, contra un doble de prueba; contra Supabase, en la ola H.

---

## Ola D · API

### D1 — Tasa BCV
Registro, corrección, historial y vigente (pública). **Verifica:** CA-005.7 y bitácora de la corrección con antes y después.

### D2 — Inventario
Alta, edición con control de concurrencia, eliminación solo de borradores, imperfecciones y certificación. **Verifica:** CA-005.9, CA-005.11 y 409 concurrente.

### D3 — Fotos
Subir, quitar, ordenar y elegir la principal. **Verifica:** máximo 10, una sola principal y borrado del objeto al quitar.

### D4 — Publicación
Publicar, pausar, publicar los listos y cambio de precio con la tasa fijada. **Verifica:** CA-005.1 (según E11) y CA-005.5.

### D5 — Disponibilidad
Transiciones y permisos. **Verifica:** CA-005.10 y la corrección de un vendido solo con `inventario.gestionar`.

### D6 — Vitrina pública
`/v1/catalogo` y la ficha, sin datos internos y con caché de 60 s. **Verifica:** CA-005.6 y que no aparezcan placa ni adquisición en la respuesta.

---

## Ola E · Datos de demostración

### E1 — Carga inicial
Recursos en `resources/demo/` y `DemoInventorySeeder`, según E9.
**Verifica:** los 16 vehículos y sus 37 imperfecciones cargados; un segundo arranque no duplica nada; queda en la bitácora.

---

## Ola F · Frontend

### F1 — Clientes de la API
Catálogo, inventario y tasa.

### F2 — Contexto del inventario
Fuente doble (servidor o maqueta), `precio` en EUR, `fotos[]`, código de inventario y copia local del catálogo (E14).

### F3 — Formulario del vehículo
Gestor de fotos, certificación, imperfecciones, y placa y adquisición opcionales.

### F4 — Ficha
Galería y créditos de las fotos referenciales.

### F5 — Pantalla de inventario
Estado de publicación, Publicar, Pausar, Publicar los listos y Eliminar solo en borrador.

### F6 — Pantalla Tasa BCV
Registro e historial, con su entrada en el menú.

### F7 — Vitrina con la tasa real
Se oculta el simulador de la maqueta cuando hay servidor.

### F8 — CSP
`img-src` con el origen de las fotos.

### F9 — CRM
Los cambios de disponibilidad van al servidor cuando hay sesión.

---

## Ola G · Cierre

### G1 — Pruebas
Unitarias, integración y recorrido en navegador (`plan.md` §9).

### G2 — Manual de usuario
Capítulo 02 (inventario, fotos, publicación y vitrina) y la tasa BCV, con capturas (D-20).

### G3 — Documentación
Actualizar para esta etapa `data-model.md`, `database-schema-design.md` y `ui-design.md` (deuda de la Constitución v3.0.0), y el nombre `estado_disponibilidad` en el spec 010, que en el esquema es `vehiculo.estado`.

---

## Ola H · Despliegue *(acciones del PO marcadas)*

### H1 — Supabase Storage
Contenedor público `vehiculos` y claves S3 *(PO)*.

### H2 — Ensayo de V0014 contra Supabase
En una transacción que se revierte, con confirmación.

### H3 — Render
Variables de fotos, de S3 y de la carga de demostración *(PO)*.

### H4 — Primer uso
Tasa BCV del día y **Publicar los listos** *(PO)*.

**Definition of Done** (`../000-overview/tasks-build-order.md` §3): criterios de aceptación cumplidos, sin `[NEEDS CLARIFICATION]` que bloqueen esta etapa, bitácora y permisos operativos, pruebas en verde y manual actualizado.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
