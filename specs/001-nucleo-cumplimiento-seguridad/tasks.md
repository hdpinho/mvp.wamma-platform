# 001 · Desglose de tareas — Núcleo de seguridad y control de accesos

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Septiembre 2026**
**Referencias:** `./spec.md` (QUÉ) · `./plan.md` (CÓMO)
**Estado:** **Aprobado** por el Product Owner el 15 de septiembre de 2026 (D-24)

> Tareas ordenadas por dependencia. Cada una declara qué la desbloquea y cómo se verifica.

**Avance al 15/09/2026:**

| Ola | Estado |
|---|---|
| A · Núcleo puro | ✅ Hecha, con pruebas unitarias (vectores del RFC 6238 incluidos) |
| B · Datos | ✅ V0013 ensayada (77/77 pruebas del esquema), repositorios JDBC, siembra y primer administrador |
| C · Autenticación | ✅ Ingreso en dos pasos, sesiones, autorización con 403 auditado y bitácora |
| D · Administración y consulta | ✅ API de usuarios, de la bitácora y de la cuenta propia |
| E · Frontend | ✅ Sesión, ingreso con QR, guarda y menú por permisos, Usuarios, Bitácora, Mi cuenta y CSP |
| F · Despliegue | ⏳ Espera las acciones del PO (`plan.md` §12) |
| G · Cierre | ✅ 57 pruebas del backend en verde; recorrido en navegador con 61 comprobaciones y sin errores de CSP; manual 01 con capturas; C4 del 010 cerrado |

---

## 0. Puerta de entrada

| Bloqueante | Bloquea | Estado |
|---|---|---|
| **P1-001** valores de política (sesión, contraseña, bloqueo) | A3, C1, C4 | **Cerrado** (D-24) |
| **P2-001** matriz de permisos | B3, C5, D1–D2, E3 | **Cerrado** (D-24) |
| **S10** PostgreSQL embebido para pruebas locales | G1 (en local) | **Cerrado** (D-24) |
| Variables de entorno en Render y Vercel | F1–F3 | Acción del PO (`plan.md` §12) |

La **ola A** no depende de ninguna respuesta: es núcleo puro.

---

## Ola A · Núcleo puro (sin base de datos)

### A1 — Cifrado de campo e índice ciego
`FieldCipher` (AES-256-GCM, versión de clave, datos asociados) y `BlindIndex` (HMAC-SHA256), en `platform/crypto`.
**Verifica:** ida y vuelta; texto alterado → error; clave distinta → error; datos asociados distintos → error; índice determinista y distinto con otra clave.

### A2 — TOTP
Generación del secreto, URI `otpauth`, verificación con ventana de ±1 paso y rechazo de pasos ya usados.
**Verifica:** vectores del RFC 6238 (apéndice B); código fuera de ventana → rechazado; mismo paso dos veces → rechazado.

### A3 — Políticas de contraseña y de bloqueo
**Depende de:** P1-001.
**Verifica:** longitudes límite; contraseña con el nombre de usuario → rechazada; contraseña común → rechazada; conteo y vencimiento del bloqueo.

### A4 — Catálogo de permisos y matriz como datos
Los códigos de permiso y la matriz de §9, en un solo lugar, de donde salen la siembra (B3) y las pruebas.
**Depende de:** P2-001.
**Verifica:** cada rol aprobado tiene su fila; ningún permiso queda sin rol.

---

## Ola B · Datos

### B1 — Migración V0013
`usuario` (nombre de usuario, sin `tipo`, TOTP cifrado, bloqueo, cambio obligatorio), `sesion`, `codigo_recuperacion`, `auditoria_evento.entidad_id` nulo y RLS en las tablas nuevas.
**Verifica:** `SchemaTestRunner` en modo `ensayo 13 -Dbloqueo` y en modo `desde-cero`, con pruebas nuevas en `pruebas-esquema.sql`; CI en verde.

### B2 — Repositorios JDBC
SQL explícito con `JdbcClient`, sin JPA (`plan.md` §2).
**Depende de:** B1. **Verifica:** las pruebas de integración ejecutan cada consulta contra el esquema real.

### B3 — Siembra de roles y permisos
En V0013, desde la matriz aprobada. **Depende de:** A4, B1.

### B4 — Primer administrador
Al arrancar, si no hay usuarios y existen las variables `WAMMA_ADMIN_*`, crea al administrador con `debe_cambiar_contrasena`.
**Verifica:** CA-001.13. Segundo arranque → no crea nada; sin variables → no crea nada y lo avisa en el log.

---

## Ola C · Autenticación

### C1 — Ingreso, paso 1 (contraseña)
Bloqueo por cuenta, límite por IP y mensajes neutros. **Verifica:** CA-001.5.

### C2 — Ingreso, paso 2 (TOTP o código de recuperación)
**Verifica:** CA-001.2, CA-001.6 y CA-001.7.

### C3 — Primer ingreso
Cambio de contraseña obligatorio, activación del 2FA y entrega de los códigos de recuperación.

### C4 — Sesiones
Token opaco con hash en la base, inactividad y duración máxima, cierre y revocación. **Verifica:** CA-001.8 y CA-001.9.

### C5 — Autorización y acceso denegado
Filtro de sesión, permisos como *authorities*, `@PreAuthorize` por endpoint y 403 auditado. **Verifica:** CA-001.1 y CA-001.10.

### C6 — Bitácora
`AuditLog` en la misma transacción, catálogo de eventos (§8) y enmascarado. **Verifica:** CA-001.3 y CA-001.11.

---

## Ola D · Administración y consulta

### D1 — API de usuarios
Alta, edición, activar o desactivar, roles, restablecimientos y la salvaguarda del último administrador.

### D2 — API de la bitácora
Filtros y paginación por cursor.

### D3 — Cuenta propia
`GET /v1/auth/yo` y cambio de contraseña.

---

## Ola E · Frontend

### E1 — Sesión en el cliente
Token en `sessionStorage`, cabecera `Authorization` y 401 → ingreso.

### E2 — Pantallas de ingreso
Contraseña, código, cambio de contraseña, activación del 2FA con código QR y códigos de recuperación.

### E3 — Guarda y menú por permisos
Nombre del usuario y **Cerrar sesión** en la barra lateral.

### E4 — Pantalla Usuarios (administrador)

### E5 — Pantalla Bitácora (auditor y administrador)

### E6 — CSP en `vercel.json`
**Verifica:** el sitio público y el backoffice funcionan sin errores de CSP en la consola.

---

## Ola F · Despliegue *(acciones del PO marcadas)*

### F1 — Render
Variables de entorno *(PO)*, perfil `supabase`; Flyway aplica V0013 al arrancar.

### F2 — Vercel
`VITE_API_URL` *(PO)*.

### F3 — Primer ingreso real
Del administrador; después, retirar `WAMMA_ADMIN_CONTRASENA_INICIAL` *(PO)*.

### F4 — *(Recomendado)* Activar `wamma_app`
Para que el backend deje de usar al dueño del esquema.

---

## Ola G · Cierre

### G1 — Pruebas
Unitarias, web, integración (CI y local según S10) y recorrido en navegador del ingreso con TOTP.

### G2 — Manual de usuario
El capítulo 01 queda completo, con capturas (D-20).

### G3 — Trazabilidad
Marcar C4 del spec 010 (identidad del asesor) como resuelto.

**Definition of Done** (`../000-overview/tasks-build-order.md` §3): criterios de aceptación cumplidos, sin `[NEEDS CLARIFICATION]` abiertos, bitácora y RBAC operativos, pruebas en verde y manual actualizado.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
