# 001 · Plan técnico — Núcleo de seguridad y control de accesos

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Septiembre 2026**
**Spec de referencia:** `./spec.md` (Rev. 2)
**Estado:** **Aprobado** por el Product Owner el 15 de septiembre de 2026 (D-24): todas las propuestas de §1 y la matriz de §9

> El QUÉ está en `spec.md`. Aquí va el CÓMO. `../000-overview/architecture-plan.md` manda sobre lo transversal.

---

## 1. Decisiones y propuestas

| # | Punto | Decisión o propuesta | Estado |
|---|---|---|---|
| S1 | Segundo factor | TOTP (RFC 6238): 6 dígitos, pasos de 30 s. Se aceptan el paso anterior y el siguiente, por desfase de reloj. Un código no se acepta dos veces | Decidido (D-04) |
| S2 | Quién usa 2FA | **Todo** usuario del backoffice, no solo el administrador: todos ven datos personales | Propuesta |
| S3 | Sesión | Token opaco aleatorio de 256 bits en la cabecera `Authorization`. En la base, solo su hash. Razones en §5 | Propuesta |
| S4 | Vencimiento de sesión | 30 minutos de inactividad; 12 horas como máximo | **Propuesta: confirmar valores (P1-001)** |
| S5 | Contraseñas | Mínimo 12 caracteres y máximo 128, sin reglas de composición (NIST SP 800-63B). No pueden contener el nombre de usuario ni estar en una lista de contraseñas comunes. Hash BCrypt | **Propuesta: confirmar (P1-001)** |
| S6 | Bloqueo | 5 intentos fallidos seguidos bloquean la cuenta 15 minutos. Además, límite de intentos por IP en el endpoint de ingreso | **Propuesta: confirmar (P1-001)** |
| S7 | Recuperación | 10 códigos de un solo uso al activar el 2FA. El administrador puede restablecer la contraseña y el 2FA de otro usuario | Propuesta |
| S8 | Primer administrador | Se crea al arrancar si no hay usuarios, con datos de variables de entorno. En su primer ingreso debe cambiar la contraseña y activar el 2FA | Decidido (D-07) |
| S9 | Claves | `WAMMA_CLAVE_CIFRADO` (AES-256) y `WAMMA_CLAVE_INDICE` (HMAC), distintas, como variables de entorno en Render | Decidido (D-05) |
| S10 | Pruebas de integración locales | PostgreSQL embebido: los binarios oficiales de PostgreSQL, que Maven descarga (no es PGlite). En CI, el PostgreSQL 17 del runner | **Pregunta al PO** |
| S11 | Pantallas nuevas | Ingreso con activación de 2FA; **Usuarios** (administrador); **Bitácora** (auditor y administrador). Sin ellas no se puede operar con más de un usuario ni ejercer el rol de auditor | Propuesta |

---

## 2. Encaje en la arquitectura

```
backend/src/main/java/com/wamma/platform/
├── config/     # SecurityConfig, CORS (etapa 0)
├── web/        # formato único de errores (etapa 0)
├── crypto/     # FieldCipher (AES-256-GCM) y BlindIndex (HMAC-SHA256)
├── identity/   # usuarios, roles, permisos, primer administrador
├── auth/       # ingreso, TOTP, sesiones, bloqueo, recuperación
└── audit/      # registro y consulta de la bitácora
```

**Dirección de las dependencias:** `platform` no depende de ningún módulo de negocio. Los módulos (inventario, CRM, crédito) usan `platform` a través de tres interfaces: `AuditLog` (registrar), `FieldCipher` (cifrar) y `CurrentUser` (quién hace la acción).

**Persistencia:** SQL explícito con `JdbcClient` (Spring JDBC) sobre el esquema de Flyway, sin JPA. *Cambio respecto de la primera versión de este plan:* el esquema ya lo define Flyway con tipos y reglas propias de PostgreSQL (`jsonb`, `CHECK`, RLS); mapearlo además con entidades duplicaba esa definición sin aportar nada. Lo que daba `ddl-auto: validate` lo cubren las pruebas de integración contra un PostgreSQL real: si una consulta no coincide con el esquema, fallan. `auditoria_evento` solo recibe `INSERT`.

---

## 3. Modelo físico — migración V0013

| Tabla | Cambio |
|---|---|
| `usuario` | + `nombre_usuario` (único, en minúsculas; con él se ingresa). − `tipo`: era una lista de puestos inventada, y los roles ya viven en `usuario_rol`. `secreto_2fa_totp` pasa a `totp_secreto_cifrado` (BYTEA). + `totp_activado_en`, `totp_ultimo_paso` (contra la reutilización de códigos), `intentos_fallidos`, `bloqueado_hasta`, `debe_cambiar_contrasena`, `contrasena_cambiada_en` |
| `sesion` *(nueva)* | `usuario_id`, `token_hash` (SHA-256, único), `nivel` (`parcial` tras la contraseña, `completa` tras el 2FA), `creada_en`, `ultimo_uso_en`, `expira_en`, `revocada_en`, `motivo_revocacion`, `ip_origen`, `agente_usuario` |
| `codigo_recuperacion` *(nueva)* | `usuario_id`, `codigo_hash`, `creado_en`, `usado_en` |
| `auditoria_evento` | `entidad_id` admite nulo: un ingreso fallido con un usuario inexistente no tiene entidad |
| `rol`, `permiso`, `rol_permiso` | Siembra de los 6 roles (D-03), del catálogo de permisos y de la matriz aprobada (§9) |

Como toda migración nueva (regla de `database-schema-design.md` §5):
- RLS explícito en las tablas nuevas.
- Privilegios de `wamma_app` por defecto; ninguna tabla nueva es append-only.
- No toca `flyway_schema_history`.
- Se ensaya antes con `backend/tools/db/SchemaTestRunner.java` en modo `ensayo 13 -Dbloqueo` y en modo `desde-cero`, añadiendo sus pruebas a `pruebas-esquema.sql`.
- Supabase la aplica al arrancar el backend con el perfil `supabase`.

---

## 4. Flujos

### 4.1 Ingreso

```
1. POST /v1/auth/ingreso {usuario, contrasena}
      → bloqueo, contraseña, estado del usuario
      ← {tokenTemporal, siguiente: CAMBIAR_CONTRASENA | ACTIVAR_2FA | CODIGO_2FA}
2. (si aplica) POST /v1/auth/contrasena-inicial {nueva}
3. (si aplica) POST /v1/auth/2fa/activacion          ← {secreto, uriOtpauth}
               POST /v1/auth/2fa/confirmacion {codigo} ← {codigosRecuperacion[10]} + sesión completa
4. POST /v1/auth/2fa {codigo | codigoRecuperacion}     ← sesión completa {token, expiraEn, usuario, permisos}
```

- El **token temporal** (sesión `parcial`) vive 5 minutos y solo sirve para los pasos 2 a 4.
- Un fallo de contraseña o de código suma un intento fallido; el acierto los pone a cero.
- **Mensaje neutro:** "Usuario o contraseña incorrectos", exista o no el usuario. Si la cuenta está bloqueada: "Demasiados intentos. Intenta de nuevo más tarde."
- Todo intento, fallido o no, queda en la bitácora.

### 4.2 Cada petición

Un filtro de Spring Security:
1. Toma el `Authorization: Bearer`.
2. Busca el hash del token y verifica que la sesión sea `completa`, esté vigente y no revocada, y que el usuario siga activo.
3. Carga sus permisos como *authorities*.

`ultimo_uso_en` se actualiza como mucho una vez por minuto, para no escribir en cada petición.

### 4.3 Recuperación y administración

- **Código de recuperación:** sustituye al TOTP una vez, y obliga a reactivar el 2FA.
- **Restablecer contraseña (administrador):** genera una contraseña temporal que se muestra una sola vez al administrador y obliga a cambiarla en el siguiente ingreso. Cierra las sesiones del usuario.
- **Restablecer 2FA (administrador):** borra el secreto y los códigos de recuperación; el usuario lo reactiva en su siguiente ingreso.
- **Desactivar un usuario:** revoca todas sus sesiones.
- **Salvaguarda:** siempre queda al menos un administrador activo.

---

## 5. Por qué un token opaco, y no JWT ni cookie

- **Cookie:** el frontend (`vercel.app`) y el backend (`onrender.com`) son sitios distintos. Una cookie del backend sería de terceros, y Safari y Firefox las bloquean por defecto. El ingreso fallaría en esos navegadores.
- **JWT:** no se puede revocar antes de que venza sin guardar una lista en la base. Si igual se consulta la base, un token opaco es más simple y no deja claves de firma que custodiar. Revocar es inmediato, que es lo que exige CA-001.8.
- **Dónde vive en el navegador:** en `sessionStorage`. Se borra al cerrar la pestaña y no se comparte entre pestañas.
  - Riesgo: un script inyectado (XSS) podría leerlo.
  - Mitigación: política de seguridad de contenido (CSP) estricta en Vercel (§11); React escapa el contenido; no hay scripts de terceros.
- **Evolución:** si WAMMA registra un dominio propio (`app.` y `api.` del mismo dominio), la sesión puede pasar a una cookie `HttpOnly` del mismo sitio sin tocar el modelo de datos.

---

## 6. TOTP

- Secreto aleatorio de 160 bits, en Base32, cifrado con `FieldCipher` en `totp_secreto_cifrado`.
- URI: `otpauth://totp/WAMMA:{usuario}?secret=…&issuer=WAMMA&algorithm=SHA1&digits=6&period=30`, compatible con Google Authenticator, Microsoft Authenticator y Authy.
- El código QR se dibuja en el navegador a partir de la URI (librería `qrcode`, licencia MIT). El secreto solo se muestra durante la activación, junto con la clave para teclearla a mano.
- `totp_ultimo_paso` guarda el último paso aceptado: un código ya usado se rechaza (CA-001.6).
- Implementación propia de unas decenas de líneas, verificada con los vectores de prueba del RFC 6238. No hace falta una dependencia para esto.

---

## 7. Cifrado de campo

| Pieza | Cómo |
|---|---|
| Algoritmo | AES-256-GCM (confidencialidad e integridad) |
| Formato | `[versión de clave: 1 byte][IV: 12 bytes aleatorios][cifrado + etiqueta]`, guardado en `BYTEA` |
| Datos asociados | Nombre de la tabla y de la columna: un cifrado no se puede mover a otra columna sin que falle |
| Índice ciego | HMAC-SHA256 con una clave distinta, sobre el valor normalizado. Hexadecimal de 64 caracteres. La normalización la define cada módulo (cédula y teléfono, en el 010) |
| Claves | 32 bytes aleatorios en Base64, en variables de entorno. Se generan en PowerShell con: `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)` |
| Rotación | El byte de versión permite que convivan dos claves. El procedimiento se documenta en la etapa 5 |

Si falta una clave, el servidor no arranca con el perfil `supabase`: prefiere no arrancar a guardar datos sin cifrar.

---

## 8. Bitácora

- `AuditLog.record(accion, entidad, entidadId, antes, despues)` se escribe **en la misma transacción** que el cambio. Si la transacción se revierte, el registro también: no hay cambio sin rastro ni rastro de un cambio que no ocurrió.
- Actor, IP (`X-Forwarded-For`, que pone Render) y navegador se toman del contexto de la petición.
- **Nunca se registran** contraseñas ni sus hashes, secretos TOTP, tokens ni códigos de recuperación. Los datos personales, en `antes` y `despues`, van enmascarados (por ejemplo, `V-****5678`).

**Eventos de esta etapa:**

| Acción | Cuándo |
|---|---|
| `sesion.iniciada` / `sesion.fallida` | Ingreso completo, o fallo con su motivo: credenciales, bloqueo o 2FA |
| `sesion.cerrada` / `sesion.revocada` | Salida voluntaria, o por desactivación o restablecimiento |
| `2fa.activado` / `2fa.restablecido` / `2fa.recuperacion_usada` | Ciclo del segundo factor |
| `contrasena.cambiada` / `contrasena.restablecida` | Cambio propio, o restablecimiento por el administrador |
| `usuario.creado` / `usuario.actualizado` / `usuario.desactivado` / `usuario.reactivado` | Administración |
| `rol.asignado` / `rol.retirado` | Cambios de permisos efectivos |
| `acceso.denegado` | Toda respuesta 403 (CA-001.1) |

**Consulta:** `GET /v1/auditoria?desde&hasta&actor&entidad&accion&cursor`, más reciente primero, 50 por página.

---

## 9. RBAC — catálogo de permisos y matriz propuesta (P2-001)

Los permisos se asignan a roles; los usuarios reciben roles. El servidor aplica cada permiso en cada endpoint (`@PreAuthorize`). El frontend solo oculta menús, por comodidad, pero no es una barrera.

| Permiso | Administrador | Asesor | Coordinador | Inventario | Analista de crédito | Auditor |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `usuarios.gestionar` | ✔ | | | | | |
| `auditoria.ver` | ✔ | | | | | ✔ |
| `parametros.gestionar` (financiamiento, etapa 4) | ✔ | | | | | |
| `tasa_bcv.registrar` (etapa 2) | ✔ | | | | ✔ | |
| `inventario.ver` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `inventario.gestionar` | | | | ✔ | | |
| `crm.ver_propias` (las suyas y las sin asignar) | | ✔ | | | | |
| `crm.ver_todas` | | | ✔ | | | ✔ |
| `crm.operar` (citas, contactos, etapas, venta) | | ✔ | ✔ | | | |
| `crm.asignar` | | | ✔ | | | |
| `cotizador.usar` | | ✔ | ✔ | | ✔ | |
| `credito.revisar` (bandeja, etapa 4) | | | | | ✔ | |
| `credito.ver` | | | | | ✔ | ✔ |

**Puntos que decide el PO:**
- El administrador **no** opera inventario, CRM ni crédito por defecto. Si también opera, se le asigna además el rol correspondiente (Principio I).
- ¿El auditor ve el expediente de crédito (`credito.ver`)? Lo propongo porque su función es controlar, pero es un dato financiero sensible.
- ¿Quién registra la tasa BCV cada día? Propongo administrador y analista de crédito.

---

## 10. Contratos de API

| Método y ruta | Permiso | Notas |
|---|---|---|
| `POST /v1/auth/ingreso` | Público | Límite por IP y bloqueo por cuenta |
| `POST /v1/auth/contrasena-inicial` | Sesión parcial | Solo si `debe_cambiar_contrasena` |
| `POST /v1/auth/2fa/activacion` · `/2fa/confirmacion` | Sesión parcial | Solo si el 2FA no está activo |
| `POST /v1/auth/2fa` | Sesión parcial | Código TOTP o de recuperación |
| `POST /v1/auth/salida` | Sesión | Revoca la sesión actual |
| `GET /v1/auth/yo` | Sesión | Usuario, roles y permisos |
| `PUT /v1/auth/contrasena` | Sesión | Cambio propio: pide la actual |
| `GET /v1/usuarios` · `POST /v1/usuarios` | `usuarios.gestionar` | Alta con contraseña temporal |
| `PATCH /v1/usuarios/{id}` | `usuarios.gestionar` | Datos, estado y roles, con la salvaguarda del último administrador |
| `POST /v1/usuarios/{id}/restablecer-contrasena` · `/restablecer-2fa` | `usuarios.gestionar` | Revoca sus sesiones |
| `GET /v1/roles` | `usuarios.gestionar` | Roles con sus permisos (solo lectura) |
| `GET /v1/auditoria` | `auditoria.ver` | Filtros y cursor |

Todas las respuestas de error usan el formato Problem Details en español de la etapa 0.

---

## 11. Frontend

- **Sesión:** un contexto nuevo (`state/sesion.tsx` + `sesionContexto.ts`, con el mismo patrón que el resto) guarda el token en `sessionStorage`. `api/cliente.ts` añade la cabecera `Authorization`; ante un 401, limpia la sesión y lleva al ingreso.
- **Pantallas nuevas:**
  - `/admin/ingresar`: usuario y contraseña → código; o bien cambio de contraseña → activación del 2FA (código QR y clave manual) → códigos de recuperación, que se muestran una vez y hay que confirmar haberlos guardado.
  - `/admin/usuarios`: listado, alta, roles, activar o desactivar y restablecimientos (administrador).
  - `/admin/bitacora`: listado con filtros (auditor y administrador).
  - Menú de cuenta: nombre del usuario, cambio de contraseña y **Cerrar sesión**.
- **Guarda:** todo `/admin/*` exige sesión; el menú lateral muestra solo las entradas que el usuario tiene permitidas.
- **CSP en `vercel.json`:** `default-src 'self'`, `connect-src` limitado al backend, `frame-ancestors 'none'`, `object-src 'none'`. `style-src` necesita `'unsafe-inline'`, porque la maqueta usa bloques `<style>` en línea. Las fuentes externas se verifican al implementar.

En esta etapa, el inventario y el CRM **siguen guardándose en el navegador**; pasan al servidor en las etapas 2 y 3. Lo que la etapa 1 añade es el acceso real delante de ellos.

---

## 12. Despliegue

Acciones que requieren al PO, porque tocan secretos:

1. En el panel de Render, configurar:
   - `SPRING_PROFILES_ACTIVE=supabase`;
   - `SUPABASE_DB_URL`, con el pooler en modo sesión, puerto 5432;
   - `SUPABASE_DB_USER` y `SUPABASE_DB_PASSWORD`;
   - `WAMMA_CLAVE_CIFRADO` y `WAMMA_CLAVE_INDICE`, generadas con el comando de §7;
   - `WAMMA_ADMIN_USUARIO`, `WAMMA_ADMIN_NOMBRE`, `WAMMA_ADMIN_APELLIDO`, `WAMMA_ADMIN_CORREO` y `WAMMA_ADMIN_CONTRASENA_INICIAL`.
2. En Vercel: `VITE_API_URL=https://wamma-backend.onrender.com`.
3. Subir el código (push) para que Render y Vercel desplieguen.
4. Primer ingreso del administrador; después, borrar `WAMMA_ADMIN_CONTRASENA_INICIAL` de Render.
5. *(Recomendado)* Activar `wamma_app` (`database-schema-design.md` §5.3), para que el backend deje de conectarse como dueño del esquema.

---

## 13. Estrategia de pruebas

| Objeto | Nivel | Exigencia |
|---|---|---|
| TOTP | Unitaria | Vectores del RFC 6238; ventana de ±1 paso; rechazo de reutilización |
| Cifrado e índice ciego | Unitaria | Ida y vuelta; texto alterado o clave distinta → error; índice determinista y distinto con otra clave |
| Políticas de contraseña y bloqueo | Unitaria | Casos límite de P1-001 |
| Endpoints de ingreso y administración | Web (MockMvc) | Formato de errores, permisos por endpoint y mensajes neutros |
| Flujo completo contra PostgreSQL real | Integración | Ingreso, bloqueo, revocación, bitácora escrita en la misma transacción y 403 auditado. Con el PostgreSQL embebido de S10, igual en local que en CI |
| Esquema V0013 | `SchemaTestRunner` | Ensayo con bloqueo simulado y reconstrucción desde cero |
| Recorrido en navegador | Playwright | Ingreso con activación del 2FA (el script calcula el TOTP), menú por rol y cierre de sesión |

---

## 14. Riesgos y limitaciones

| Riesgo | Mitigación |
|---|---|
| Un script inyectado lee el token de `sessionStorage` | CSP estricta, sin scripts de terceros y sesiones cortas |
| Render dormido: el primer ingreso tarda cerca de un minuto | Indicador de servidor (etapa 0); el cliente espera hasta 90 s |
| El único administrador pierde el teléfono y los códigos de recuperación | Guardar los códigos es un paso obligatorio del primer ingreso. Recomendación: un segundo administrador |
| Reloj del servidor desfasado | Ventana de ±1 paso; Render sincroniza la hora |
| Credenciales de la base de datos | Solo en variables de entorno de Render y en `backend/.env` local, ignorado por git. Su rotación es independiente de este módulo |

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
