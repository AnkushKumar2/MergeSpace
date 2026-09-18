param(
  [ValidateRange(1, 65535)]
  [int]$Port = 3002
)

$envFile = Join-Path $PSScriptRoot ".env.local"
if (-not (Test-Path -LiteralPath $envFile)) {
  throw "Missing .env.local. Add your InsForge public URL and anonymous key before starting Docker."
}

$env:MERGESPACE_PORT = $Port
docker compose --env-file $envFile -f (Join-Path $PSScriptRoot "docker-compose.yml") up --build --detach --force-recreate
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "MergeSpace is running at http://localhost:$Port"
Write-Host "Check health at http://localhost:$Port/health"
