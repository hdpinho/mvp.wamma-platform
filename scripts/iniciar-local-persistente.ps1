# Levanta WAMMA sobre la base PostgreSQL local PERSISTENTE (localhost:5432 / wamma), que es el
# entorno de trabajo desde D-85. Todo queda guardado: usuarios, claves, códigos 2FA, citas,
# oportunidades, expedientes de crédito, fotos y recaudos. NADA se borra al reiniciar.
#
# Requisitos: el servicio 'postgresql-x64-18' en marcha y backend/.env con la contraseña de la base
# y las claves WAMMA_CLAVE_CIFRADO y WAMMA_CLAVE_INDICE (D-86: nunca en el repositorio).
#
# Uso (PowerShell):   .\scripts\iniciar-local-persistente.ps1
# Para detener:       .\scripts\detener-local-persistente.ps1
#
# La tasa BCV y la publicación de vehículos se hacen desde el backoffice (D-87).

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

# Cargar la configuración de backend/.env. Una variable ya definida en la sesión manda sobre el archivo.
$envFile = Join-Path $raiz 'backend\.env'
if (Test-Path $envFile) {
  Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$' } | ForEach-Object {
    $k = $Matches[1].Trim()
    $v = $Matches[2].Trim()
    if (-not [System.Environment]::GetEnvironmentVariable($k)) {
      [System.Environment]::SetEnvironmentVariable($k, $v)
    }
  }
}

# Solo la base local (D-85): perfil `local` aunque el .env diga otra cosa, y sin las credenciales de
# Supabase ni de su almacenamiento, que no se usan hasta el despliegue.
$env:SPRING_PROFILES_ACTIVE = 'local'
Get-ChildItem Env: | Where-Object { $_.Name -like 'SUPABASE_*' -or $_.Name -like 'FLYWAY_DB_*' -or $_.Name -like 'WAMMA_S3_*' } |
  ForEach-Object { Remove-Item "Env:$($_.Name)" }
$env:WAMMA_FOTOS_ALMACEN = 'disco'
$env:WAMMA_RECAUDOS_ALMACEN = 'disco'

# Sin datos de demostración (D-85): ni vehículos ni personas ficticias en el CRM.
$env:WAMMA_DEMO_CARGAR_INVENTARIO = 'false'

# Base de datos y secretos (D-86): la contraseña y las claves no tienen valor por defecto.
if (-not $env:SPRING_DATASOURCE_URL) { $env:SPRING_DATASOURCE_URL = 'jdbc:postgresql://localhost:5432/wamma' }
if (-not $env:SPRING_DATASOURCE_USERNAME) { $env:SPRING_DATASOURCE_USERNAME = 'postgres' }
if (-not $env:SPRING_DATASOURCE_PASSWORD) {
  $segura = Read-Host -Prompt "Contraseña de PostgreSQL ($env:SPRING_DATASOURCE_USERNAME)" -AsSecureString
  $env:SPRING_DATASOURCE_PASSWORD = [System.Net.NetworkCredential]::new('', $segura).Password
}
foreach ($clave in 'WAMMA_CLAVE_CIFRADO', 'WAMMA_CLAVE_INDICE') {
  if (-not [System.Environment]::GetEnvironmentVariable($clave)) { throw "Falta $clave. Defínela en backend/.env." }
}
$env:FLYWAY_ENABLED = 'true'
$env:WAMMA_CORS_ORIGINS = 'http://localhost:5173,http://localhost:5174'

# Fotos y recaudos en una carpeta persistente, fuera del repositorio y de OneDrive. Sin esto el backend
# usa la carpeta temporal de Windows, que el sistema puede vaciar. Lo que ya hubiera allí se copia
# (solo los archivos que falten; el origen no se toca).
$datos = Join-Path $env:LOCALAPPDATA 'WAMMA'
if (-not $env:WAMMA_FOTOS_CARPETA) { $env:WAMMA_FOTOS_CARPETA = Join-Path $datos 'fotos' }
if (-not $env:WAMMA_RECAUDOS_CARPETA) { $env:WAMMA_RECAUDOS_CARPETA = Join-Path $datos 'recaudos' }
foreach ($par in @(@('wamma-fotos', $env:WAMMA_FOTOS_CARPETA), @('wamma-recaudos', $env:WAMMA_RECAUDOS_CARPETA))) {
  New-Item -ItemType Directory -Force $par[1] | Out-Null
  $anterior = Join-Path $env:TEMP $par[0]
  if (Test-Path $anterior) {
    robocopy $anterior $par[1] /E /XC /XN /XO /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "No se pudieron copiar los archivos de $anterior a $($par[1])." }
  }
}

$logBackend = Join-Path $salida 'backend.log'
"Arrancando el backend contra PostgreSQL (localhost:5432/wamma)…"
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
"  Fotos/recaudos:   $datos"
"  Para apagar:      .\scripts\detener-local-persistente.ps1"
"=================================================================`n"
