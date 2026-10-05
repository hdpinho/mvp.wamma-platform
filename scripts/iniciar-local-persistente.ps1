# Levanta WAMMA con Base de Datos PostgreSQL local PERSISTENTE (localhost:5432 / wamma).
# Todo queda guardado de verdad en el PostgreSQL de tu máquina: usuarios, claves, códigos 2FA,
# citas, oportunidades y expedientes de crédito. NADA se borra al reiniciar.
#
# Uso (PowerShell):   .\scripts\iniciar-local-persistente.ps1
# Para detener:       .\scripts\detener-local-persistente.ps1

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$salida = Join-Path $raiz 'scratch\local-persistente'
New-Item -ItemType Directory -Force $salida | Out-Null

if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Users\hdpinho\dev-tools\jdk-21.0.12.1+1' }
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$mvn = if (Get-Command mvn.cmd -ErrorAction SilentlyContinue) { 'mvn.cmd' } else { 'C:\Users\hdpinho\dev-tools\apache-maven-3.9.16\bin\mvn.cmd' }

# Comprobar que PostgreSQL local esté escuchando en el puerto 5432
if (-not (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue)) {
  throw "PostgreSQL no está corriendo en el puerto 5432. Inicia el servicio 'postgresql-x64-18' antes de arrancar."
}

# Comprobar puertos
foreach ($puerto in 8080, 5174) {
  if (Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue) {
    throw "El puerto $puerto ya está en uso. Si hay una sesión previa, apágala con: .\scripts\detener-local-persistente.ps1"
  }
}

# Cargar configuración desde backend/.env si existe
$envFile = Join-Path $raiz 'backend\.env'
if (Test-Path $envFile) {
  Get-Content $envFile | Where-Object { $_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$' } | ForEach-Object {
    $k = $Matches[1].Trim()
    $v = $Matches[2].Trim()
    if (-not [System.Environment]::GetEnvironmentVariable($k)) {
      [System.Environment]::SetEnvironmentVariable($k, $v)
    }
  }
}

# Valores por defecto para desarrollo local si no se suministraron en el entorno
if (-not $env:SPRING_DATASOURCE_URL) { $env:SPRING_DATASOURCE_URL = "jdbc:postgresql://localhost:5432/wamma" }
if (-not $env:SPRING_DATASOURCE_USERNAME) { $env:SPRING_DATASOURCE_USERNAME = "postgres" }
if (-not $env:SPRING_DATASOURCE_PASSWORD) {
  $env:SPRING_DATASOURCE_PASSWORD = Read-Host -Prompt "Ingresa la contraseña de PostgreSQL (postgres)" -AsSecureString
  $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($env:SPRING_DATASOURCE_PASSWORD)
  $env:SPRING_DATASOURCE_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}
$env:FLYWAY_ENABLED = "true"
foreach ($clave in 'WAMMA_CLAVE_CIFRADO', 'WAMMA_CLAVE_INDICE') {
  if (-not [System.Environment]::GetEnvironmentVariable($clave)) { throw "Falta $clave. Defínela en backend/.env." }
}
if (-not $env:WAMMA_ADMIN_USUARIO) { $env:WAMMA_ADMIN_USUARIO = "hdpinho" }
if (-not $env:WAMMA_ADMIN_NOMBRE) { $env:WAMMA_ADMIN_NOMBRE = "Héctor" }
if (-not $env:WAMMA_ADMIN_APELLIDO) { $env:WAMMA_ADMIN_APELLIDO = "De Pinho" }
if (-not $env:WAMMA_DEMO_CARGAR_INVENTARIO) { $env:WAMMA_DEMO_CARGAR_INVENTARIO = "true" }
$env:WAMMA_CORS_ORIGINS = "http://localhost:5173,http://localhost:5174"

$logBackend = Join-Path $salida 'backend.log'
"Arrancando backend persistente contra PostgreSQL (localhost:5432/wamma)…"
Start-Process -FilePath $mvn -WorkingDirectory (Join-Path $raiz 'backend') -WindowStyle Hidden `
  -RedirectStandardOutput $logBackend -RedirectStandardError "$logBackend.err" `
  -ArgumentList @('-B', '-q', 'spring-boot:run')

$limite = (Get-Date).AddMinutes(3)
$listo = $false
while ((Get-Date) -lt $limite) {
  if (Test-Path $logBackend) {
    if (Select-String -Path $logBackend -Pattern 'Application run failed|APPLICATION FAILED' -Quiet) { throw "El backend no arrancó. Revisa $logBackend" }
    if (Select-String -Path $logBackend -Pattern 'Started WammaApplication' -Quiet) { $listo = $true; break }
  }
  Start-Sleep -Seconds 2
}
if (-not $listo) { throw "El backend no terminó de arrancar en 3 minutos. Revisa $logBackend" }

# Asegurar tasa BCV y publicación de los 9 vehículos autorizados en PostgreSQL
try {
  $env:PGPASSWORD = $env:SPRING_DATASOURCE_PASSWORD
  $psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
  if (Test-Path $psql) {
    & $psql -U $env:SPRING_DATASOURCE_USERNAME -d wamma -q -c "
      INSERT INTO tasa_cambio_bcv (fecha, tasa_ves, fuente, capturado_en, moneda)
      VALUES (CURRENT_DATE, 54.25000000, 'BCV', NOW(), 'EUR')
      ON CONFLICT (fecha, moneda) DO NOTHING;

      UPDATE publicacion p
      SET estado = 'publicado',
          tasa_bcv = 54.25000000,
          fecha_tasa = CURRENT_DATE,
          publicado_en = COALESCE(publicado_en, NOW())
      FROM vehiculo v
      WHERE p.vehiculo_id = v.id
        AND p.estado = 'borrador'
        AND v.codigo IN ('veh-001', 'veh-002', 'veh-003', 'veh-004', 'veh-005', 'veh-006', 'veh-007', 'veh-009', 'veh-011');
    " 2>$null
  }
} catch {
  # Continuar normalmente
}

"Arrancando frontend web…"
$env:VITE_API_URL = 'http://localhost:8080'
Start-Process -FilePath 'node' -WorkingDirectory (Join-Path $raiz 'frontend-web') -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $salida 'web.log') -RedirectStandardError (Join-Path $salida 'web.err') `
  -ArgumentList @('node_modules\vite\bin\vite.js', '--port', '5174', '--strictPort', '--host', 'localhost')

$limite = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $limite) {
  try { Invoke-WebRequest -Uri 'http://localhost:5174/' -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Seconds 1 }
}

"`n================================================================="
"  WAMMA PLATFORM (ENTORNO LOCAL PERSISTENTE - POSTGRESQL REAL)   "
"================================================================="
"  Vitrina pública:  http://localhost:5174"
"  Backoffice:       http://localhost:5174/admin/ingresar"
"  Base de datos:    PostgreSQL localhost:5432 / wamma"
"  Para apagar:      .\scripts\detener-local-persistente.ps1"
"=================================================================`n"
