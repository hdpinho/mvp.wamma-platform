# Arranque — Maqueta visual WAMMA

**Clasificación:** Confidencial · **Rev.:** 2 · **Septiembre 2026**

Guía corta para levantar la **maqueta visual** del MVP. Recuerda: es solo visual, con **datos simulados** y **sin lógica de negocio** ni backend conectado. La definición del proyecto está en `README.md`; los principios en `.specify/memory/constitution.md`.

## Requisitos previos

- **Node.js** LTS reciente (20 o superior) y **npm**.
- **JDK 21** (para el backend Spring Boot, cuando se active).
- **Maven 3.9+** (para el backend).
- **Git**.
- **Antigravity** y/o **Claude Code** instalados.

## Paso 1 · Colocar el repositorio

Descomprime `wamma-platform` en su propia carpeta raíz (p. ej. `C:\Users\hdpinho\wamma-platform`). Verifica que existan las carpetas ocultas `.agents`, `.specify` y `.claude` (en Windows: *Vista → Elementos ocultos*).

Inicializa Git desde la raíz:

```
git init
git add .
git commit -m "chore: estructura SDD inicial de WAMMA"
```

> El remoto debe ser la **organización de WAMMA** en GitHub, no una cuenta personal (Constitución, Principio III).

## Paso 2 · Levantar el backend localmente (Spring Boot)

El backend arranca sobre un **PostgreSQL embebido y desechable**, sin tocar la base
compartida. Cada arranque parte de una base vacía: Flyway aplica todas las migraciones y
se crea el administrador local.

```bash
cd backend
mvn spring-boot:test-run -Dspring-boot.run.main-class=com.wamma.support.LocalDevServer
```

Queda escuchando en `http://localhost:8080`, con `/api/health` para comprobarlo.

> **No uses `mvn spring-boot:run`.** Desde el spec 011 el perfil por defecto es `local` y no
> define origen de datos: ese comando falla al arrancar, a propósito. Arrancar sin
> configurar entorno no puede acabar apuntando a la base compartida.
>
> Para trabajar contra Supabase hace falta activarlo explícitamente
> (`SPRING_PROFILES_ACTIVE=supabase`) con todas sus variables definidas; el servidor las
> nombra todas juntas si falta alguna. Ojo: Flyway migraría esa base al arrancar, así que
> `FLYWAY_ENABLED` viene en `false` salvo que el entorno lo active.

## Paso 3 · Levantar el frontend localmente

La maqueta cliente reside en `frontend-web/`:

```bash
cd frontend-web
npm install
echo "VITE_API_URL=http://localhost:8080" > .env.local   # sin esto, arranca en modo maqueta
npm run dev
```

| Para qué | URL |
|---|---|
| Vitrina pública | `http://localhost:5173` |
| **Ingreso al backoffice** | `http://localhost:5173/admin/ingresar` |
| Salud del backend | `http://localhost:8080/api/health` |

**Credenciales locales** (solo sirven para esa base desechable; están en
`LocalDevServer.java`, no son secretos):

* Usuario: `admin.local`
* Contraseña inicial: `Clave local de desarrollo 2026`

En el primer ingreso pedirá cambiar la contraseña y activar el segundo factor (TOTP) con
una app autenticadora.

> Sin `VITE_API_URL` el frontend funciona en **modo maqueta**: muestra datos de ejemplo del
> navegador y no hay ingreso. El backend solo admite peticiones desde `localhost:5173` y
> `localhost:5174`, que es lo que fija `LocalDevServer`.

---

## Despliegue en la Nube y CI/CD

El proyecto cuenta con integración y despliegue continuo automatizado conectado a GitHub:

* **Repositorio Central:** [https://github.com/hdpinho/mvp.wamma-platform](https://github.com/hdpinho/mvp.wamma-platform) (rama `main`).
* **Frontend en Vercel:**
  * URL Pública: [https://wamma-mvp.vercel.app](https://wamma-mvp.vercel.app)
  * Directorio raíz: `frontend-web`
  * Despliegue: Automático en cada `git push origin main` mediante integración Git de Vercel.
* **Backend en Render:**
  * Servicio: `wamma-backend` (Web Service con contenedor Docker multi-stage Java 21)
  * Manifiesto: [`render.yaml`](./render.yaml)
  * Health check: `/api/health`
  * Despliegue: Automático en cada `git push origin main`.


## Estructura esperada de `frontend-web/`

```
frontend-web/src/
├── tokens/        # colores (#D17438, etc.), tipografía Montserrat, espaciado
├── components/    # biblioteca base reusable
├── screens/       # pantallas C0…C10
├── mocks/         # datos simulados (sin red)
└── routes/        # navegación (sin guards de negocio)
```

## Estructura del backend (`backend/`)

```
backend/
├── pom.xml                          # Maven — Spring Boot 3.3, JDK 21
├── src/main/java/com/wamma/        # Código fuente por dominio
├── src/main/resources/
│   ├── application.yml              # Config (secretos en variables de entorno)
│   └── db/migration/               # Migraciones Flyway
└── _legacy-go/                      # Código Go archivado (referencia)
```

## Recordatorios

- **No** hay backend conectado a la maqueta: todo simulado y rotulado.
- Marca: naranja `#D17438`, Montserrat (Regular/Bold). Assets del logo en `frontend-web/public/marca/`; manual en `docs/marca/`. Sobre fondo negro sólido va la versión **blanca** del logo.
- Secretos fuera del repositorio (ya cubierto por `.gitignore`).

---
*WAMMA · Confidencial · Rev. 2 · No constituye asesoría legal ni financiera.*
