# 001 · Núcleo de cumplimiento y seguridad

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Rev.:** 1 · **Junio 2026**
**Pilar Kavak:** Habilitador regulatorio (licencia para operar)
**Depende de:** — (es la base de todo)
**Estado:** Draft para `/clarify`

> Spec del QUÉ y el POR QUÉ. El CÓMO en `../000-overview/architecture-plan.md` y `../000-overview/data-model.md`. Principios vinculantes en `../../.specify/memory/constitution.md`.

## 1. Objetivo
Construir la base sobre la que se monta todo lo demás: identidad de roles y permisos, cifrado de datos sensibles, bitácora de auditoría inmutable y la preparación del expediente técnico para Sudeban.

## 2. Por qué importa
Sin esto no se puede operar **legalmente**. Construirlo primero es lo que da "bases sólidas desde el día uno" (Constitución, Principio I). Ningún otro módulo financiero se da por terminado sin que este esté operativo.

## 3. Alcance
**Incluye (MVP):** RBAC con separación de funciones Sudeban; autenticación con 2FA para roles administrativos; cifrado en reposo y tránsito; bitácora de auditoría inmutable; gestión de secretos fuera del repositorio; base del expediente técnico (manuales, diagramas, flujos).
**No incluye:** automatización completa de reportería regulatoria (módulo 009); SSO con terceros (fase posterior).

## 4. Actores y roles
Administrador de plataforma; Oficial de Cumplimiento; Auditoría Interna; CRSO/Riesgo; Seguridad de la Información; operadores de negocio (con permisos acotados). El modelo de roles **debe reflejar la independencia** de cumplimiento, auditoría, riesgo y seguridad respecto de la operación de TI y del negocio.

## 5. Historias de usuario
- Como **Oficial de Cumplimiento**, quiero un acceso con permisos independientes del negocio y de TI, para ejercer mi función sin conflicto de interés.
- Como **Auditor Interno**, quiero consultar una bitácora inmutable de toda transacción financiera y todo cambio de estado de inventario, para auditar sin riesgo de manipulación.
- Como **Administrador**, quiero que todo acceso administrativo exija 2FA, para reducir el riesgo de compromiso de credenciales.

## 6. Requisitos funcionales (RF)
- **RF-001.1** El sistema gestiona usuarios, roles y permisos (RBAC) con mínimo privilegio por defecto.
- **RF-001.2** El RBAC modela la separación de funciones obligatoria de Sudeban (cumplimiento, auditoría, riesgo, seguridad independientes de TI/negocio).
- **RF-001.3** Todo rol administrativo requiere **2FA**.
- **RF-001.4** El sistema cifra datos sensibles en reposo y exige TLS en tránsito.
- **RF-001.5** Cada transacción financiera y cada cambio de estado de inventario genera un registro **inmutable** en la bitácora de auditoría (actor, acción, antes/después, timestamp).
- **RF-001.6** Los secretos (claves, credenciales de integración) se gestionan fuera del código y del repositorio.
- **RF-001.7** El sistema permite exportar la documentación técnica base del expediente Sudeban.

## 7. Requisitos no funcionales y cumplimiento
Referencias: Res. 119.10/119.18 Sudeban (Riesgo TI/Oficial de Cumplimiento), LISB Art. 70–80 y 76 (gobierno corporativo/auditoría), ISO 27001 (seguridad), COBIT/ISACA (gobierno TI). La bitácora debe ser **append-only**.

## 8. Reglas de negocio
La bitácora nunca se edita ni se borra. El mínimo privilegio es el estado por defecto: los permisos se conceden explícitamente.

## 9. Entidades de datos
`usuario`, `rol`, `permiso`, `auditoria_evento`, `secreto_config` (ver `data-model.md`).

## 10. Integraciones
Proveedor de 2FA (TOTP/OTP). Gestor de secretos. `[NEEDS CLARIFICATION: gestor de secretos y proveedor 2FA a confirmar]`.

## 11. Criterios de aceptación (Given/When/Then)
- **CA-001.1** Dado un usuario sin permiso explícito, cuando intenta una acción restringida, entonces el sistema la deniega y registra el intento.
- **CA-001.2** Dado un acceso administrativo, cuando se inicia sesión sin 2FA, entonces el acceso se rechaza.
- **CA-001.3** Dada una transacción financiera, cuando se ejecuta, entonces existe un registro de auditoría inmutable asociado.
- **CA-001.4** Dado un asiento de auditoría, cuando alguien intenta editarlo o borrarlo, entonces la operación falla.

## 12. Métricas de éxito
100% de transacciones financieras con registro de auditoría; 0 accesos administrativos sin 2FA; 0 secretos en el repositorio.

## 13. Preguntas abiertas
- `[NEEDS CLARIFICATION: L1 — formatos exactos del expediente/reportería que exige Sudeban]`
- `[NEEDS CLARIFICATION: niveles de privilegio finos por dirección (Administración, Finanzas, Operaciones, Comercialización, Tecnología)]`

## 14. Trazabilidad
Constitución: Principios I, VI. Overview: módulo 001. Dependencias: research D-(2FA/secretos), L1.

---
*WAMMA · Confidencial · Rev. 1 · No constituye asesoría legal ni financiera.*
