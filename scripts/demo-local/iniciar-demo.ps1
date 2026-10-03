# Levanta la demostración local de WAMMA: backend (PostgreSQL embebido y desechable) en el 8080, un usuario por rol con
# su segundo factor listo, y la web en el 5174. Cada arranque parte de una base nueva.
#
# Uso (PowerShell, desde cualquier carpeta):   .\scripts\demo-local\iniciar-demo.ps1
# Para apagar:                                   .\scripts\demo-local\detener-demo.ps1
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$salida = Join-Path $raiz 'scratch\demo'
New-Item -ItemType Directory -Force $salida | Out-Null

if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Users\hdpinho\dev-tools\jdk-21.0.12.1+1' }
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$mvn = if (Get-Command mvn.cmd -ErrorAction SilentlyContinue) { 'mvn.cmd' } else { 'C:\Users\hdpinho\dev-tools\apache-maven-3.9.16\bin\mvn.cmd' }

# No se pisa lo que ya esté corriendo en esos puertos: puede ser el trabajo de otra persona.
foreach ($puerto in 8080, 5174) {
  if (Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue) {
    throw "El puerto $puerto ya está en uso. Si es una demostración anterior, apágala con detener-demo.ps1."
  }
}

$logBackend = Join-Path $salida 'backend.log'
"Arrancando el backend (tarda unos segundos)…"
Start-Process -FilePath $mvn -WorkingDirectory (Join-Path $raiz 'backend') -WindowStyle Hidden `
  -RedirectStandardOutput $logBackend -RedirectStandardError "$logBackend.err" `
  -ArgumentList @('-B', '-q', 'spring-boot:test-run', '-Dspring-boot.run.main-class=com.wamma.support.LocalDevServer')

$limite = (Get-Date).AddMinutes(5)
$listo = $false
while ((Get-Date) -lt $limite) {
  if (Test-Path $logBackend) {
    if (Select-String -Path $logBackend -Pattern 'Application run failed|APPLICATION FAILED' -Quiet) { throw "El backend no arrancó. Revisa $logBackend" }
    if (Select-String -Path $logBackend -Pattern 'SOLICITUD DE CR.DITO SEMBRADA|Advertencia al sembrar' -Quiet) { $listo = $true; break }
  }
  Start-Sleep -Seconds 3
}
if (-not $listo) { throw "El backend no terminó de arrancar en 5 minutos. Revisa $logBackend" }

"Creando los usuarios de la demostración…"
node (Join-Path $PSScriptRoot 'preparar-demo.mjs')
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar los usuarios.' }

"Arrancando la web…"
$env:VITE_API_URL = 'http://localhost:8080'
Start-Process -FilePath 'node' -WorkingDirectory (Join-Path $raiz 'frontend-web') -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $salida 'web.log') -RedirectStandardError (Join-Path $salida 'web.err') `
  -ArgumentList @('node_modules\vite\bin\vite.js', '--port', '5174', '--strictPort', '--host', 'localhost')
$limite = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $limite) {
  try { Invoke-WebRequest -Uri 'http://localhost:5174/' -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Seconds 2 }
}

"`nListo.`n  Vitrina:    http://localhost:5174`n  Backoffice: http://localhost:5174/admin/ingresar`n  Código 2FA: node scripts/demo-local/codigo-2fa.mjs demo.analista`n  Guion:      scripts/demo-local/README.md"
