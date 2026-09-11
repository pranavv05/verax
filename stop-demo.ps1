# ---------------------------------------------------------------------------
# Safe Verax demo shutdown.
#
# Only stops what start-demo.ps1 started (tracked via PID files in
# .verax-run\), plus the ca-postgres/ca-redis containers (stopped, NEVER
# removed -- the postgres_data volume is untouched, so demo data survives).
#
# Does NOT: kill all node.exe/python.exe, touch unrelated Docker containers,
# or delete any volume.
# ---------------------------------------------------------------------------

. (Join-Path $PSScriptRoot "demo-env-common.ps1")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " STOPPING VERAX" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Stop-TrackedProcess {
    param([Parameter(Mandatory)][string]$Name)
    $procId = Get-SavedPid -Name $Name
    $pidFile = Join-Path $RunDir "$Name.pid"
    if ($procId) {
        Write-Host "Stopping $Name (pid $procId, and its child processes)..."
        taskkill /PID $procId /T /F *> $null
        Write-Host "  done."
    } else {
        Write-Host "$Name -- no tracked process (nothing to stop, or already stopped)."
    }
    if (Test-Path $pidFile) { Remove-Item $pidFile -Force }
}

Stop-TrackedProcess -Name "frontend"
Stop-TrackedProcess -Name "worker"
Stop-TrackedProcess -Name "backend"
Stop-TrackedProcess -Name "ai-service"

Write-Host ""
Write-Host "Stopping Docker containers (data volumes are preserved)..."
foreach ($name in @($PgContainer, $RedisContainer)) {
    $state = Get-ContainerState -Name $name
    if ($state -eq "running") {
        docker stop $name *> $null
        Write-Host "  $name stopped."
    } else {
        Write-Host "  $name was not running."
    }
}

Write-Host ""
Write-Host "Verax stopped. Postgres data volume was not touched -- your demo data is intact." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
