# Apaga el entorno local persistente de WAMMA: la web (5174) y el backend (8080).
# La base de datos PostgreSQL local en localhost:5432 NO se apaga ni se toca: sus datos quedan intactos.
foreach ($puerto in 5174, 8080) {
  $conexion = Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conexion) {
    Stop-Process -Id $conexion.OwningProcess -Force -ErrorAction SilentlyContinue
    "Detenido el proceso del puerto $puerto."
  }
}
Start-Sleep -Seconds 2
"Listo. Backend y frontend detenidos. La base de datos persistente 'wamma' en PostgreSQL sigue intacta."
