# 000 · Registro de decisiones del Product Owner

**Proyecto:** WAMMA · Plataforma propia · **Fase 1 (MVP)**
**Clasificación:** Confidencial · **Septiembre 2026**

> Cada decisión que cierra una pregunta abierta queda aquí con su fecha, para que specs, planes y el manual de usuario la citen en lugar de repetirla. Si una decisión cambia, se añade una fila nueva que la sustituye; las anteriores no se borran.

## 14 de septiembre de 2026 — Backend de la Fase 1

| # | Tema | Decisión | Afecta a |
|---|---|---|---|
| D-01 | Alcance | Backend para que la maqueta actual funcione al 100 %: 001, inventario y catálogo, CRM, simulador de financiamiento y solicitud de crédito como captación. Scoring (006) y pagos con ledger (007) quedan fuera hasta tener convenios con bancos, buró y listas | Todos |
| D-02 | Etapas | 0 base técnica · 1 módulo 001 · 2 inventario y catálogo · 3 CRM · 4 financiamiento · 5 cierre y despliegue. En cada etapa: spec, plan y tareas aprobados antes de programar | Plan |
| D-03 | Roles del backoffice | Administrador, asesor comercial, coordinador comercial, inventario, analista de crédito y auditor (solo lectura) | 001 |
| D-04 | 2FA | Códigos temporales (TOTP) con app autenticadora, sin proveedor ni costo | 001 |
| D-05 | Secretos | Variables de entorno de Render, incluidas las claves de cifrado. Un gestor dedicado, más adelante | 001 |
| D-06 | L1 — formatos de Sudeban | Cerrado como **no aplica**, por la enmienda v2.0.0 de la Constitución | 001, 009 |
| D-07 | Primer administrador | Usuario `hdpinho`. Sus datos de contacto se cargan por variables de entorno, no en el repositorio | 001 |
| D-08 | Clientes del sitio público | Sin cuenta en esta fase: solo inician sesión los usuarios del backoffice | 001, 005 |
| D-09 | Fotos y recaudos | Almacenamiento compatible con S3. Se empieza con Supabase Storage, usado a través de su API S3 para poder cambiar de proveedor por configuración. Los recaudos van en un contenedor privado | 004, 005, solicitud |
| D-10 | Inventario inicial | Arranca con los vehículos de demostración, ya en su almacenamiento definitivo, con 5 a 10 fotos por vehículo | 004, 005 |
| D-11 | Sedes | Una sola sede, en el Distrito Capital | 004, 010 |
| D-12 | Datos del vehículo | Placa y precio de adquisición, opcionales en esta fase | 004 |
| D-13 | Tasa BCV | Registro diario desde el backoffice, con fecha y fuente. Automatizarla, después | 009 |
| D-14 | Parámetros de financiamiento | Pantalla de parámetros en el backoffice: tasa mensual, plazos y montos mínimo y máximo. Ingeniería propone los valores iniciales y el PO los confirma | Financiamiento |
| D-15 | Moneda | Euro (EUR). **Alcance por confirmar** (ver pendientes) | Constitución, todos |
| D-16 | OTP de la solicitud | Sin OTP en esta fase: al formulario solo se llega con el enlace personal que emite el asesor | Solicitud |
| D-17 | Bandeja de crédito | Bandeja sencilla en el backoffice para el analista de crédito | Solicitud |
| D-18 | Aviso al buzón comercial | Se retira en esta fase: las capturas nuevas se ven en el backoffice. La confirmación al cliente sigue por `mailto:` | 010 |
| D-19 | Hosting | Plan gratuito de Render: el servidor se apaga tras 15 minutos sin tráfico y tarda cerca de un minuto en volver | Infraestructura |
| D-20 | Manual de usuario | Cada etapa deja en `docs/manual-usuario/` todo lo necesario para redactar el manual de los módulos que toca | Todas las etapas |

## 15 de septiembre de 2026 — Cierre de pendientes del día anterior

| # | Tema | Decisión | Sustituye | Afecta a |
|---|---|---|---|---|
| D-21 | Moneda | El **euro aplica a toda la plataforma**: precios del catálogo, cuotas, simulador, cotizador y solicitud de crédito, con equivalencia en bolívares a la tasa BCV del euro. Constitución enmendada a v3.0.0 (Principio V) | Precisa D-15 | Todos |
| D-22 | Fotos | Las toma un fotógrafo de WAMMA y son del vehículo real que se vende. WAMMA es titular de los derechos | Precisa D-10 | 004, 005 |
| D-23 | Sede | Una sola sede, denominada **Distrito Capital** | Precisa D-11 | 004, 010 |
| D-25 | Etapa 2: inventario, catálogo y tasa BCV | **Aprobados** el spec 005 Rev. 2, su plan y sus tareas, con las opciones recomendadas por ingeniería:<ul><li>Fotos de demostración: las 16 actuales, marcadas como referenciales y con su crédito. Se publican con una foto, por excepción, hasta tener las del fotógrafo (E9-A).</li><li>De 5 a 10 fotos para publicar (E10).</li><li>Se puede publicar sin certificar, con aviso y sin sello (E11).</li><li>Precios de demostración: las mismas cifras, en euros (E12).</li><li>VIN obligatorio (E4).</li><li>Servidor dormido: copia local del catálogo en el navegador; sin consulta periódica por ahora (E14).</li><li>Los archivos que otra sesión está pasando a euros se toman cuando esa sesión termine (E15).</li><li>Se trabaja en local: sin despliegue ni commit hasta nuevo aviso.</li></ul> | Cierra P-005.1 a P-005.4 | 004, 005, 009 |
| D-24 | Módulo 001 | **Aprobados** el spec Rev. 2, el plan y las tareas:<ul><li>2FA para todo el backoffice y sesión con token opaco.</li><li>Sesión: 30 min de inactividad y 12 h como máximo. Contraseña de 12 caracteres como mínimo. Bloqueo tras 5 intentos, durante 15 min.</li><li>10 códigos de recuperación, y restablecimiento por el administrador.</li><li>Pantallas **Usuarios** y **Bitácora**.</li><li>Matriz de permisos de `001/plan.md` §9: el administrador no opera sin rol operativo; el auditor ve el expediente de crédito; la tasa BCV la registran el administrador y el analista de crédito.</li><li>PostgreSQL embebido para las pruebas locales.</li></ul> | Cierra P1-001 y P2-001 | 001 |

## Pendientes derivados

| Tema | Pregunta | Bloquea |
|---|---|---|
| Sede (D-23) | Dirección de la sede, para la ficha del vehículo y la confirmación de citas | Nada crítico; etapa 2 |
| Parámetros (D-14) | Confirmar los valores iniciales que proponga ingeniería | Etapa 4 |

---
*WAMMA · Confidencial · No constituye asesoría legal ni financiera.*
