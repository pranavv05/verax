# ---------------------------------------------------------------------------
# Read-only diagnostic for the Verax local demo environment.
# Does not start, stop, or modify anything -- safe to run any time.
# ---------------------------------------------------------------------------

. (Join-Path $PSScriptRoot "demo-env-common.ps1")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " VERAX DEMO ENVIRONMENT CHECK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$failures = @()
function Check {
    param([string]$Label, [bool]$Ok, [string]$Detail = "")
    Write-StatusLine -Label $Label -Ok $Ok -Detail $Detail
    if (-not $Ok) { $script:failures += $Label }
}

# Docker
$dockerOk = Test-DockerAvailable
Check "Docker available" $dockerOk

# Postgres container
$pgState = if ($dockerOk) { Get-ContainerState -Name $PgContainer } else { "unknown" }
Check "Postgres container running" ($pgState -eq "running") "state=$pgState"

# Postgres accepting connections
$pgReady = $false
if ($pgState -eq "running") { $pgReady = Test-PostgresReady -TimeoutSec 8 }
Check "Postgres accepting connections" $pgReady

# DB credentials valid
$authOk = $false
if ($pgReady) { $authOk = Test-PostgresAuth }
$authDetail = ""
if (-not $authOk -and $pgReady) { $authDetail = "role/password in .env does not match the postgres_data volume" }
Check "Database credentials valid" $authOk $authDetail

# Redis
$redisState = if ($dockerOk) { Get-ContainerState -Name $RedisContainer } else { "unknown" }
$redisReady = $false
if ($redisState -eq "running") { $redisReady = Test-RedisReady -TimeoutSec 8 }
Check "Redis running" $redisReady "state=$redisState"

# Backend
$backendOwner = Get-PortOwner -Port $BackendPort
$backendHealth = Test-HttpHealth -Url "http://localhost:$BackendPort/health"
Check "Backend port $BackendPort in use" ($backendOwner -ne $null)
Check "Backend /health = 200" $backendHealth.Ok

# AI service
$aiOwner = Get-PortOwner -Port $AiServicePort
$aiHealth = Test-HttpHealth -Url "http://localhost:$AiServicePort/health"
Check "AI service port $AiServicePort in use" ($aiOwner -ne $null)
Check "AI service /health = 200" $aiHealth.Ok ($(if ($aiHealth.Ok) { $aiHealth.Body } else { "" }))

# Worker
$workerPid = Get-SavedPid -Name "worker"
$workerAlive = $workerPid -ne $null
if (-not $workerAlive) {
    # Fall back to a command-line scan in case it wasn't started by start-demo.ps1
    $match = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*document-processing.worker.js*" } | Select-Object -First 1
    $workerAlive = $match -ne $null
}
Check "Worker process running" $workerAlive "(process-alive only -- this does not confirm jobs are succeeding)"

# Poppler
$poppler = Get-PoppplerAvailable
Check "Poppler available" ($poppler -ne $null) $poppler

# DATABASE_URL consistency across the 3 files that can define it (root .env,
# backend/.env, ai-service/.env) -- catches silent config drift like the
# hidden ai-service/.env that caused the original "password auth failed" bug.
$dbUrls = Get-EnvFileDatabaseUrls
$distinctUrls = $dbUrls.Values | Select-Object -Unique
$dbUrlsConsistent = ($distinctUrls.Count -le 1)
$dbUrlDetail = ""
if (-not $dbUrlsConsistent) {
    $parts = $dbUrls.Keys | ForEach-Object { "$_=$($dbUrls[$_])" }
    $dbUrlDetail = ($parts -join " | ")
}
Check "DATABASE_URL consistent across .env files" $dbUrlsConsistent $dbUrlDetail

# Required env vars
$requiredVars = @("DATABASE_URL", "REDIS_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "CLIENT_JWT_SECRET", "AI_SERVICE_URL", "AI_SERVICE_API_KEY", "GROQ_API_KEY")
$missingVars = @()
foreach ($v in $requiredVars) {
    if (-not (Get-EnvValue -Key $v)) { $missingVars += $v }
}
Check "Required environment variables present" ($missingVars.Count -eq 0) ($(if ($missingVars.Count -gt 0) { "missing: " + ($missingVars -join ", ") } else { "" }))

# Python deps (ai-service venv)
$venvPython = Join-Path $AiServiceDir "venv\Scripts\python.exe"
$pyDepsOk = $false
$pyDepsDetail = ""
if (Test-Path $venvPython) {
    & $venvPython -c "import fastapi, uvicorn, paddleocr, groq, psycopg2" 2> $null
    $pyDepsOk = ($LASTEXITCODE -eq 0)
} else {
    $pyDepsDetail = "venv missing at $venvPython"
}
Check "ai-service Python dependencies installed" $pyDepsOk $pyDepsDetail

# Node deps
$backendDepsOk = Test-Path (Join-Path $BackendDir "node_modules\express")
$frontendDepsOk = Test-Path (Join-Path $FrontendDir "node_modules\.package-lock.json")
Check "backend Node dependencies installed" $backendDepsOk
Check "frontend Node dependencies installed" $frontendDepsOk

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($failures.Count -eq 0) {
    Write-Host "VERAX DEMO ENVIRONMENT: READY" -ForegroundColor Green
} else {
    Write-Host "VERAX DEMO ENVIRONMENT: NOT READY" -ForegroundColor Red
    Write-Host ""
    Write-Host "Failing checks:"
    foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
}
Write-Host "========================================" -ForegroundColor Cyan
