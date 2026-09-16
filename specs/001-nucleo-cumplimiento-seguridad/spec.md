# 001 · Núcleo de seguridad y control de accesos

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 2 · **Septiembre 2026**
**Depende de:** — (es la base de todo)
**Estado:** **Aprobado** por el Product Owner el 15 de septiembre de 2026 (D-24). Incorpora las decisiones D-03 a D-08 y la Constitución v3.0.0

> Spec del QUÉ y el POR QUÉ. El CÓMO, en `./plan.md`. Principios vinculantes en `../../.specify/memory/constitution.md`.

## 0. Qué cambió en la Rev. 2

- Se retira el encuadre Sudeban (Constitución v2.0.0): ni expediente regulatorio ni "separación de funciones Sudeban". La separación de funciones se conserva como buena ingeniería (Principio I).
- **L1** queda cerrado como "no aplica" (D-06).
- Roles, 2FA, secretos y primer administrador, decididos (D-03, D-04, D-05, D-07).
- El alcance se limita a lo que necesita la maqueta operativa: el **backoffice**. Los visitantes del sitio público no tienen cuenta (D-08).

## 1. Objetivo

Que solo el personal autorizado entre al backoffice; que cada persona haga solo lo que su rol permite; que toda acción sensible quede registrada sin posibilidad de alterarla; y que los datos personales y los secretos se guarden cifrados.

## 2. Por qué importa

La plataforma custodia cédulas, teléfonos, ingresos y cuentas bancarias de personas reales (Principio I). Ningún módulo que toque esos datos se da por terminado sin este.

## 3. Alcance

**Incluye:** usuarios del backoffice; roles y permisos con mínimo privilegio; ingreso con contraseña y segundo factor (TOTP); sesiones con vencimiento y cierre; bloqueo por intentos fallidos; recuperación de acceso; bitácora de auditoría inmutable y su consulta; cifrado de campo para datos personales y secretos; secretos en variables de entorno; administración de usuarios; creación del primer administrador.

**No incluye:** cuentas de clientes del sitio público (D-08); inicio de sesión con terceros (SSO); gestor de secretos dedicado (D-05, más adelante); reportería regulatoria (L1, no aplica).

## 4. Actores y roles (D-03)

| Rol | Para qué existe |
|---|---|
| Administrador | Gestiona usuarios, roles y la configuración de la plataforma |
| Asesor comercial | Atiende a las personas y lleva sus oportunidades |
| Coordinador comercial | Supervisa el embudo y reparte las oportunidades |
| Inventario | Da de alta y mantiene los vehículos |
| Analista de crédito | Revisa las solicitudes de crédito y sus recaudos |
| Auditor | Consulta sin modificar nada, incluida la bitácora |

Un usuario puede tener varios roles. **Separación de funciones (Principio I):** el auditor solo consulta, y administrar accesos no da permiso para operar inventario, CRM ni crédito. Quien necesite ambas cosas recibe también el rol operativo, y esa asignación queda en la bitácora.

## 5. Historias de usuario

- Como **administrador**, quiero crear usuarios y asignarles roles, para que cada quien acceda solo a lo suyo.
- Como **usuario del backoffice**, quiero entrar con mi contraseña y un código de la app de mi teléfono, para que una contraseña robada no baste.
- Como **usuario que perdió el teléfono**, quiero recuperar el acceso con un código de recuperación o con ayuda del administrador.
- Como **auditor**, quiero consultar la bitácora con filtros, sin poder modificar nada.
- Como **administrador**, quiero que una cuenta se bloquee tras varios intentos fallidos, para frenar a quien intente adivinar contraseñas.

## 6. Requisitos funcionales (RF)

- **RF-001.1 Usuarios.** Nombre de usuario único, nombre, correo y estado (activo, inactivo o bloqueado). Un usuario no se borra: se desactiva.
- **RF-001.2 RBAC.** Permisos por rol, mínimo privilegio por defecto, varios roles por usuario. Matriz en `plan.md` §9.
- **RF-001.3 Segundo factor.** TOTP obligatorio para **todo** usuario del backoffice, porque todos ven datos personales. Se activa en el primer ingreso.
- **RF-001.4 Recuperación.** Códigos de un solo uso entregados al activar el 2FA. El administrador puede restablecer la contraseña y el 2FA de otro usuario.
- **RF-001.5 Sesiones.** Vencen por inactividad y por duración máxima. Se pueden cerrar. Desactivar a un usuario cierra todas sus sesiones.
- **RF-001.6 Bloqueo.** Tras un número de intentos fallidos seguidos, la cuenta se bloquea durante un tiempo.
- **RF-001.7 Contraseñas.** Política de longitud mínima y rechazo de contraseñas débiles. Se guardan con hash, nunca en claro.
- **RF-001.8 Cifrado.** Los datos personales y los secretos se cifran por campo en la base, con un índice ciego para buscar sin descifrar. TLS en tránsito.
- **RF-001.9 Bitácora.** Registro inmutable de ingresos, fallos de acceso, cambios de usuarios y roles, intentos denegados y —desde sus propios módulos— toda transacción de dinero y todo cambio de estado de inventario. Nunca registra contraseñas, secretos, tokens ni códigos.
- **RF-001.10 Consulta de la bitácora.** Con filtros por fecha, usuario, entidad y acción, para el auditor y el administrador.
- **RF-001.11 Secretos.** Fuera del código y del repositorio, en variables de entorno (D-05).
- **RF-001.12 Primer administrador.** Se crea al arrancar, desde variables de entorno, si no existe ningún usuario. Debe cambiar la contraseña y activar el 2FA en su primer ingreso (D-07).

## 7. Requisitos no funcionales

- 2FA sin proveedor externo ni costo (D-04).
- Funciona con frontend y backend en dominios distintos (Vercel y Render) sin depender de cookies de terceros, que Safari y Firefox bloquean.
- Las sesiones sobreviven a un reinicio del servidor: el plan gratuito de Render lo apaga tras 15 minutos sin tráfico (D-19).
- Nada específico de Supabase (Principio II).
- Referencias técnicas voluntarias: OWASP ASVS y NIST SP 800-63B.

## 8. Reglas de negocio

- La bitácora nunca se edita ni se borra, y lo impide el motor de base de datos, no la aplicación.
- Sin permiso explícito, la acción se deniega.
- Siempre debe quedar al menos un administrador activo: el último no puede desactivarse ni perder el rol.
- Los mensajes de error de ingreso no revelan si un usuario existe.

## 9. Entidades de datos

`usuario`, `rol`, `permiso`, `usuario_rol`, `rol_permiso`, `sesion`, `codigo_recuperacion` y `auditoria_evento` (ver `plan.md` §3). `secreto_config` queda sin uso: los secretos no se guardan en la base (D-05).

## 10. Integraciones

Ninguna externa. TOTP es un estándar abierto (RFC 6238), compatible con cualquier app autenticadora.

## 11. Criterios de aceptación (Given/When/Then)

- **CA-001.1** Dado un usuario sin permiso explícito, cuando intenta una acción restringida, entonces se deniega y el intento queda en la bitácora.
- **CA-001.2** Dado un usuario que acertó la contraseña, cuando no presenta un código TOTP válido, entonces no obtiene una sesión de trabajo.
- **CA-001.3** Dada una transacción financiera, cuando se ejecuta, entonces tiene un registro de auditoría asociado.
- **CA-001.4** Dado un registro de auditoría, cuando alguien intenta editarlo, borrarlo o vaciar la tabla, entonces la operación falla.
- **CA-001.5** Dada una cuenta con los intentos fallidos agotados, cuando se presenta la contraseña correcta durante el bloqueo, entonces el ingreso se rechaza igual.
- **CA-001.6** Dado un código TOTP ya usado, cuando se presenta de nuevo, entonces se rechaza.
- **CA-001.7** Dado un código de recuperación, cuando se usa, entonces sirve una sola vez.
- **CA-001.8** Dado un usuario desactivado, cuando usa una sesión abierta, entonces se rechaza de inmediato.
- **CA-001.9** Dada una sesión sin actividad más allá del límite, cuando se usa, entonces pide ingresar de nuevo.
- **CA-001.10** Dado un usuario con rol de auditor, cuando intenta modificar cualquier dato, entonces se rechaza.
- **CA-001.11** Dada la bitácora, cuando se revisa, entonces no contiene contraseñas, secretos, tokens ni códigos.
- **CA-001.12** Dado un dato personal cifrado, cuando se lee la base sin la clave, entonces no es legible; y si se altera, descifrarlo falla.
- **CA-001.13** Dado un primer arranque sin usuarios, cuando el servidor inicia, entonces crea al administrador; en los arranques siguientes, no.

## 12. Métricas de éxito

0 accesos al backoffice sin 2FA; 100 % de las acciones sensibles en la bitácora; 0 secretos en el repositorio.

## 13. Preguntas abiertas

- ~~P1-001 — valores de la política~~ **Cerrado** (D-24): contraseña de 12 caracteres como mínimo; bloqueo tras 5 intentos durante 15 minutos; sesión de 30 minutos de inactividad y 12 horas como máximo.
- ~~P2-001 — matriz de permisos por rol~~ **Cerrado** (D-24): la de `plan.md` §9.
- ~~L1 — formatos de Sudeban~~ **Cerrado**: no aplica (D-06).
- ~~Gestor de secretos y proveedor de 2FA~~ **Cerrado**: variables de entorno y TOTP (D-04, D-05).
- ~~Niveles de privilegio por dirección~~ **Cerrado**: roles de D-03; su detalle es P2-001.

## 14. Trazabilidad

Constitución: Principios I y VI. Decisiones D-03 a D-08 y D-20. Esquema: V0002, V0009 y V0013 (`plan.md` §3).

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
