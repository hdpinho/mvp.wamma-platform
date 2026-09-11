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

La carpeta `frontend-web/` **aún no existe**: la genera el agente a partir de los specs.

- **Antigravity:** *Open Workspace* → selecciona la carpeta → escribe `/maqueta-cliente`.
- **Claude Code:** abre la terminal en la raíz (`cd ...\wamma-platform`), ejecuta `claude` y pega el prompt de arranque (o pídele que siga `.agents/workflows/maqueta-cliente.md`).

El agente debe **mostrarte primero el plan**, implementar en orden (tokens → componentes → mocks → pantallas → rutas) y luego **navegar la maqueta y capturar pantallas** para tu revisión.

## Paso 3 · Levantar el frontend

Una vez generado `frontend-web/`:

```
cd frontend-web
npm install
npm run dev
```

Abre la URL que muestre la terminal (típicamente `http://localhost:5173` si el agente usa Vite). Confirma el comando exacto en los *scripts* de `frontend-web/package.json`.

## Paso 4 · Levantar el backend (cuando se active)

El backend Spring Boot está en `backend/`. Para arrancarlo:

```
cd backend
mvn spring-boot:run
```

Requiere las variables de entorno de conexión a Supabase y Redis configuradas (ver `backend/README.md`). En esta etapa de maquetas **no es necesario** arrancar el backend.

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
