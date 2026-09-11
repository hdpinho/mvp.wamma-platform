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

## Paso 2 · Generar la maqueta

## Paso 2 · Levantar el frontend localmente

La maqueta cliente reside en `frontend-web/`:

```bash
cd frontend-web
npm install
npm run dev
```

Abre en tu navegador la URL que muestre la terminal (típicamente `http://localhost:5173`).

## Paso 3 · Levantar el backend localmente (Spring Boot)

El backend modular reside en `backend/`:

```bash
cd backend
mvn spring-boot:run
```

* Por defecto arranca con el perfil **`standalone`** (sin requerir base de datos activa) y expone `/api/health` en el puerto configurado.
* Para conectar con Supabase en desarrollo local, define las variables de entorno `SUPABASE_DB_URL`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD` y activa el perfil `SPRING_PROFILES_ACTIVE=supabase`.

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
