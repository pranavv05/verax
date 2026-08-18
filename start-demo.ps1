# ---------------------------------------------------------------------------
# One-command Verax demo startup.
#
# Topology (matches the root .env comment): postgres + redis run in Docker,
# containers ca-postgres / ca-redis, using the named volumes verax_postgres_data
# / verax_redis_data so demo data survives restarts. backend, worker, ai-service
# and frontend run natively on the Windows host (not Dockerized) — this avoids
# rebuilding the ai-service Docker image (paddleocr/torch, ~GB, behind a
# TLS-inspecting proxy) on demo morning.
#
# Every step below is a real health check, not "the process started". If a
# step can't be verified healthy, the script stops and tells you exactly what
# failed instead of pressing on and producing a demo that looks up but isn't.
# ---------------------------------------------------------------------------

. (Join-Path $PSScriptRoot "demo-env-common.ps1")

$ErrorActionPreference = "Stop"
$overallOk = $true

function Fail($msg) {
    Write-Host ""
    Write-Host "STARTUP FAILED: $msg" -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " VERAX LOCAL ENVIRONMENT - STARTING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Docker -------------------------------------------------------------
Write-Host "Checking Docker..."
if (-not (Test-DockerAvailable)) {
    Fail "Docker is not available. Start Docker Desktop and re-run this script."
}
Write-StatusLine "Docker" $true

# --- 2/3. Postgres + Redis containers --------------------------------------
Write-Host ""
Write-Host "Starting PostgreSQL..."
$pgState = Get-ContainerState -Name $PgContainer
if ($pgState -eq "running") {
    Write-Host "  $PgContainer already running."
} elseif ($pgState -eq "stopped") {
    docker start $PgContainer *> $null
} else {
    Push-Location $RepoRoot
    docker compose up -d postgres *> $null
    Pop-Location
}

Write-Host "Starting Redis..."
$redisState = Get-ContainerState -Name $RedisContainer
if ($redisState -eq "running") {
    Write-Host "  $RedisContainer already running."
} elseif ($redisState -eq "stopped") {
    docker start $RedisContainer *> $null
} else {
    Push-Location $RepoRoot
    docker compose up -d redis *> $null
    Pop-Location
}

# --- 4. Wait for Postgres ready ---------------------------------------------
Write-Host "Waiting for PostgreSQL to accept connections..."
$pgReady = Test-PostgresReady -TimeoutSec 30
Write-StatusLine "PostgreSQL" $pgReady
if (-not $pgReady) {
    $overallOk = $false
    Fail "PostgreSQL did not become ready within 30s. Run 'docker logs $PgContainer' to see why."
}

# --- 5. Wait for Redis ready -------------------------------------------------
Write-Host "Waiting for Redis to accept connections..."
$redisReady = Test-RedisReady -TimeoutSec 20
Write-StatusLine "Redis" $redisReady
if (-not $redisReady) {
    Fail "Redis did not become ready within 20s. Run 'docker logs $RedisContainer' to see why."
}

# --- 6. Verify DB credentials -------------------------------------------------
Write-Host "Verifying database credentials against .env..."
$authOk = Test-PostgresAuth
Write-StatusLine "DB credentials" $authOk
if (-not $authOk) {
    Fail (
        "The credentials in .env / backend/.env do not authenticate against the " +
        "$PgContainer container. This does NOT mean the database needs to be reset " +
        "-- it means .env's DATABASE_URL/POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB " +
        "don't match what the volume was actually initialized with. Check: " +
        "docker exec $PgContainer psql -U <user> -d <db> -- and never delete the " +
        "postgres_data volume to 'fix' this."
    )
}

# --- 7. Backend --------------------------------------------------------------
Write-Host ""
Write-Host "Checking backend (port $BackendPort)..."
$backendHealthUrl = "http://localhost:$BackendPort/health"
$existingOwner = Get-PortOwner -Port $BackendPort
$backendRunning = $false

if ($existingOwner) {
    $health = Test-HttpHealth -Url $backendHealthUrl
    if ($health.Ok) {
        Write-Host "  Healthy Verax backend already running (pid $($existingOwner.ProcessId)) -- not starting a duplicate."
        $backendRunning = $true
    } else {
        Fail (
            "Port $BackendPort is occupied by a process that is NOT answering " +
            "$backendHealthUrl with 200:`n" +
            "    PID $($existingOwner.ProcessId)  $($existingOwner.Name)`n" +
            "    $($existingOwner.CommandLine)`n" +
            "This is likely a stale/crashed process. Stop it yourself with:`n" +
            "    taskkill /PID $($existingOwner.ProcessId) /T /F`n" +
            "then re-run this script. (Not doing this automatically on purpose.)"
        )
    }
} else {
    Write-Host "  Starting backend..."
    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm run dev > `"$RunDir\backend.log`" 2>&1" `
        -WorkingDirectory $BackendDir -WindowStyle Minimized -PassThru
    Save-Pid -Name "backend" -ProcessId $p.Id
    $backendRunning = Wait-ForHealth -Url $backendHealthUrl -TimeoutSec 40
}
Write-StatusLine "Backend :$BackendPort" $backendRunning
if (-not $backendRunning) {
    Fail "Backend did not become healthy within 40s. Check $RunDir\backend.log"
}

# --- 8. AI service ------------------------------------------------------------
Write-Host ""
Write-Host "Checking AI service (port $AiServicePort)..."
$aiHealthUrl = "http://localhost:$AiServicePort/health"
$existingAiOwner = Get-PortOwner -Port $AiServicePort
$aiRunning = $false

if ($existingAiOwner) {
    $health = Test-HttpHealth -Url $aiHealthUrl
    if ($health.Ok) {
        Write-Host "  Healthy AI service already running (pid $($existingAiOwner.ProcessId)) -- not starting a duplicate."
        $aiRunning = $true
    } else {
        Fail (
            "Port $AiServicePort is occupied by a process that is NOT answering " +
            "$aiHealthUrl with 200:`n" +
            "    PID $($existingAiOwner.ProcessId)  $($existingAiOwner.Name)`n" +
            "    $($existingAiOwner.CommandLine)`n" +
            "Stop it yourself with: taskkill /PID $($existingAiOwner.ProcessId) /T /F`n" +
            "then re-run this script."
        )
    }
} else {
    $uvicornExe = Join-Path $AiServiceDir "venv\Scripts\uvicorn.exe"
    if (-not (Test-Path $uvicornExe)) {
        Fail "ai-service venv not found at $uvicornExe. Create it: cd ai-service && python -m venv venv && venv\Scripts\pip install -r requirements.txt"
    }
    Write-Host "  Starting AI service..."
    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "`"$uvicornExe`" app.main:app --host 0.0.0.0 --port $AiServicePort > `"$RunDir\ai-service.log`" 2>&1" `
        -WorkingDirectory $AiServiceDir -WindowStyle Minimized -PassThru
    Save-Pid -Name "ai-service" -ProcessId $p.Id
    $aiRunning = Wait-ForHealth -Url $aiHealthUrl -TimeoutSec 60
}
Write-StatusLine "AI Service :$AiServicePort" $aiRunning
if (-not $aiRunning) {
    Fail "AI service did not become healthy within 60s. Check $RunDir\ai-service.log (common cause: GROQ_API_KEY / DATABASE_URL missing from repo-root .env)."
}

# Poppler is required for scanned bank-statement PDFs specifically -- warn, don't block.
$poppler = Get-PoppplerAvailable
if ($poppler) {
    Write-Host "  Poppler found: $poppler"
} else {
    Write-Host "  WARNING: Poppler not found on PATH. Scanned (image-only) bank statement PDFs will fail with a clear error; text-layer PDFs and images are unaffected. Install poppler or set POPPLER_PATH." -ForegroundColor Yellow
}

# --- 9. Worker -----------------------------------------------------------------
Write-Host ""
Write-Host "Checking document-processing worker..."
$workerPid = Get-SavedPid -Name "worker"
if (-not $workerPid) {
    # No PID file (e.g. started outside this script, or a prior crash lost it)
    # -- scan for one by command line before assuming none is running, so we
    # never end up with two workers racing each other on the same queue.
    $existingWorker = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*document-processing.worker.js*" } | Select-Object -First 1
    if ($existingWorker) {
        $workerPid = $existingWorker.ProcessId
        Save-Pid -Name "worker" -ProcessId $workerPid
    }
}
$workerRunning = $false
if ($workerPid) {
    Write-Host "  Worker already running (pid $workerPid) -- not starting a duplicate."
    $workerRunning = $true
} else {
    Write-Host "  Starting worker..."
    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm run worker:documents:dev > `"$RunDir\worker.log`" 2>&1" `
        -WorkingDirectory $BackendDir -WindowStyle Minimized -PassThru
    Save-Pid -Name "worker" -ProcessId $p.Id
    Start-Sleep -Seconds 5
    $workerRunning = (Get-Process -Id $p.Id -ErrorAction SilentlyContinue) -ne $null
}
Write-StatusLine "Worker" $workerRunning "(best-effort: process-alive check -- see $RunDir\worker.log for job-level errors)"
if (-not $workerRunning) {
    $overallOk = $false
}

# --- 10. Frontend (convenience, not health-checked -- Vite has no /health) ---
Write-Host ""
Write-Host "Checking frontend (port $FrontendPort)..."
$frontendOwner = Get-PortOwner -Port $FrontendPort
if ($frontendOwner) {
    Write-Host "  Something is already listening on $FrontendPort -- assuming it's the frontend dev server."
} else {
    Write-Host "  Starting frontend..."
    $p = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm run dev > `"$RunDir\frontend.log`" 2>&1" `
        -WorkingDirectory $FrontendDir -WindowStyle Minimized -PassThru
    Save-Pid -Name "frontend" -ProcessId $p.Id
    Start-Sleep -Seconds 3
}

# --- Final report ---------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " VERAX LOCAL ENVIRONMENT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-StatusLine "PostgreSQL"          $pgReady
Write-StatusLine "Redis"               $redisReady
Write-StatusLine "Backend :$BackendPort"     $backendRunning
Write-StatusLine "AI Service :$AiServicePort" $aiRunning
Write-StatusLine "Worker"              $workerRunning
Write-Host ""

if ($backendRunning -and $aiRunning -and $pgReady -and $redisReady -and $workerRunning) {
    Write-Host "Verax is ready." -ForegroundColor Green
} else {
    Write-Host "Verax started with problems -- see failing rows above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Frontend: http://localhost:$FrontendPort"
Write-Host "Backend:  http://localhost:$BackendPort"
Write-Host "========================================" -ForegroundColor Cyan
