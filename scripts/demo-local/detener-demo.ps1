# Apaga la demostración local: la web (5174), el backend (8080) y su PostgreSQL embebido.
foreach ($puerto in 5174, 8080) {
  $conexion = Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conexion) {
    Stop-Process -Id $conexion.OwningProcess -Force -ErrorAction SilentlyContinue
    "Detenido el proceso del puerto $puerto."
  }
}
Start-Sleep -Seconds 2
# PostgreSQL embebidos que quedaron sin ningún cliente conectado.
$pgs = Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.CommandLine -match ' -D ' -and $_.CommandLine -match 'embedded-pg' }
foreach ($p in $pgs) {
  $puerto = (Get-NetTCPConnection -State Listen -OwningProcess $p.ProcessId -ErrorAction SilentlyContinue | Select-Object -First 1).LocalPort
  $clientes = if ($puerto) { @(Get-NetTCPConnection -RemotePort $puerto -ErrorAction SilentlyContinue).Count } else { 0 }
  if ($clientes -eq 0) {
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$($p.ProcessId)" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    "Detenida una base embebida sin uso ($($p.ProcessId))."
  }
}
"Listo."
