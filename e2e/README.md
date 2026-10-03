# Pruebas de punta a punta (R5.1)

Prueban la plataforma **de verdad**: el backend real (Spring Boot sobre un PostgreSQL embebido y desechable) y, en la suite de navegador, la web real en un Chrome real. No tocan Supabase, Render ni Vercel.

Cada suite arranca **su propio backend con la base vacía**: así el administrador de arranque ingresa por primera vez, los límites de citas y de ingreso empiezan en cero y nada depende del orden.

| Suite | Archivo | Casos | Qué comprueba |
|---|---|---|---|
| `r1` | `suites/seguridad-r1.mjs` | 26 | Ingreso real con contraseña y 2FA para los seis roles; matriz de permisos del crédito; cada asesor ve lo suyo; la IP no se falsifica con `X-Forwarded-For`; recaudos privados con enlace firmado; expediente cifrado |
| `r2` | `suites/flujos-r2.mjs` | 39 | El recorrido del MVP por HTTP y los **contratos** que la web espera: cita, confirmación, venta, enlace, solicitud, análisis y dictamen |
| `r3` | `suites/credito-r3.mjs` | 14 | El servidor calcula cuota y capacidad, valida la inicial, dictamen manual con justificación, estados finales, tasa BCV, número de solicitud |
| `ui` | `suites/recorrido-ui.mjs` | 24 | **Recorrido completo en navegador**, de la vitrina a la venta cerrada: avisos por WhatsApp y correo, recaudos al condicionar, reabrir expediente, sin «Tomar», y todos los campos con nombre accesible |

## Cómo correrlas

Hace falta **Java 21** y **Maven** (`JAVA_HOME`; si `mvn` no está en el `PATH`, `E2E_MVN` con su ruta), **Node 24** y, para la suite `ui`, **Google Chrome** o el Chromium de Playwright.

```bash
cd frontend-web && npm ci        # Vite, que la suite de navegador levanta
cd ../e2e && npm ci
node ejecutar.mjs                # todas las suites (≈ 3 a 4 minutos)
node ejecutar.mjs r1 ui          # solo algunas
```

Sin Chrome instalado: `npm run navegador` baja Chromium y se usa con `E2E_NAVEGADOR=` (vacío).

Salida en `e2e/resultados/` (Git la ignora): un JSON por suite, `resumen.json`, los registros del backend y las capturas del recorrido. El proceso termina con código distinto de cero si alguna suite falla.

### Variables

| Variable | Por defecto | Para qué |
|---|---|---|
| `E2E_API` | `http://localhost:8081` | Dirección del backend de prueba |
| `E2E_WEB` | `http://localhost:5199` | Dirección de la web de prueba |
| `E2E_MVN` | `mvn` | Ruta de Maven |
| `E2E_NAVEGADOR` | `chrome` | Canal de Chrome; vacío = Chromium de Playwright |

Los puertos 8081 y 5199 deben estar libres (no chocan con la demostración local, que usa el 8080 y el 5174).

## Qué configuración usa cada suite

- `r1`, `r2` y `r3` encienden `WAMMA_CRM_ASIGNACION=true`: ejercitan «tomar» y «repartir», que están **apagados por defecto** (D-73) pero cuyo código se conserva. `r1` además pone `WAMMA_PROXIES_CONFIABLES=ninguno` para comprobar que una `X-Forwarded-For` inventada no cambia la IP.
- `ui` corre con la **configuración por defecto**, la que se entrega.

## Notas

- Las cuentas que crean las suites existen solo en esa base desechable. Las contraseñas y los códigos 2FA no se guardan en ningún archivo.
- Las suites repiten unas pocas funciones de apoyo (ingreso con 2FA, llamadas HTTP). Es a propósito: cada archivo se entiende y se corre solo. Si crecen, conviene moverlas a `lib/`.
- La base nace vacía, pero los datos de demostración (16 vehículos, tres prospectos y una solicitud) se siembran al arrancar; las suites los dan por existentes.
- En la CI corren como el trabajo **e2e** de `.github/workflows/ci.yml`.
