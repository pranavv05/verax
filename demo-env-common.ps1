# ---------------------------------------------------------------------------
# Shared helpers for start-demo.ps1 / stop-demo.ps1 / verify-demo-environment.ps1
# Dot-sourced by all three — keep this file side-effect-free (no started
# processes, no docker commands) except for the constants below.
# ---------------------------------------------------------------------------

$RepoRoot     = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir   = Join-Path $RepoRoot "backend"
$AiServiceDir = Join-Path $RepoRoot "ai-service"
$FrontendDir  = Join-Path $RepoRoot "frontend"
$RunDir       = Join-Path $RepoRoot ".verax-run"

$PgContainer    = "ca-postgres"
$RedisContainer = "ca-redis"
$BackendPort    = 3000
$AiServicePort  = 8000
$FrontendPort   = 5173

if (-not (Test-Path $RunDir)) {
    New-Item -ItemType Directory -Path $RunDir -Force | Out-Null
}

function Get-EnvValue {
    param(
        [Parameter(Mandatory)][string]$Key,
        [string[]]$Files = @((Join-Path $BackendDir ".env"), (Join-Path $RepoRoot ".env"))
    )
    # Same precedence as backend/src/config/env.js: first file that defines the
    # key wins.
    foreach ($file in $Files) {
        if (-not (Test-Path $file)) { continue }
        $line = Select-String -Path $file -Pattern "^\s*$Key\s*=" -SimpleMatch:$false | Select-Object -First 1
        if ($line) {
            $value = $line.Line -replace "^\s*$Key\s*=", ""
            return $value.Trim()
        }
    }
    return $null
}

function Test-DockerAvailable {
    try {
        docker info *> $null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Get-ContainerState {
    param([Parameter(Mandatory)][string]$Name)
    # Returns "running", "stopped", or "missing"
    $running = docker ps --filter "name=^/$Name$" --format "{{.Names}}" 2>$null
    if ($running -eq $Name) { return "running" }
    $all = docker ps -a --filter "name=^/$Name$" --format "{{.Names}}" 2>$null
    if ($all -eq $Name) { return "stopped" }
    return "missing"
}

function Get-PortOwner {
    param([Parameter(Mandatory)][int]$Port)
    # Returns $null if nothing is listening, else an object with Pid/Name/CommandLine.
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) { return $null }
    $procId = $conn.OwningProcess
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
    [PSCustomObject]@{
        ProcessId   = $procId
        Name        = if ($proc) { $proc.Name } else { "unknown" }
        CommandLine = if ($proc) { $proc.CommandLine } else { "" }
    }
}

function Test-HttpHealth {
    param(
        [Parameter(Mandatory)][string]$Url,
        [int]$TimeoutSec = 3
    )
    try {
        $resp = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        return @{ Ok = ($resp.StatusCode -eq 200); StatusCode = $resp.StatusCode; Body = $resp.Content }
    } catch {
        return @{ Ok = $false; StatusCode = $null; Body = $null }
    }
}

function Wait-ForHealth {
    param(
        [Parameter(Mandatory)][string]$Url,
        [int]$TimeoutSec = 30,
        [int]$PollSec = 2
    )
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        $result = Test-HttpHealth -Url $Url -TimeoutSec 3
        if ($result.Ok) { return $true }
        Start-Sleep -Seconds $PollSec
        $elapsed += $PollSec
    }
    return $false
}

function Test-PostgresReady {
    param([int]$TimeoutSec = 30)
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        docker exec $PgContainer pg_isready -U (Get-EnvValue -Key "POSTGRES_USER") *> $null
        if ($LASTEXITCODE -eq 0) { return $true }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    return $false
}

function Test-PostgresAuth {
    # Verifies the credentials in .env actually authenticate against the real
    # data volume — catches the "role does not exist" class of failure instead
    # of just checking the server accepts *some* connection.
    $user = Get-EnvValue -Key "POSTGRES_USER"
    $pass = Get-EnvValue -Key "POSTGRES_PASSWORD"
    $db   = Get-EnvValue -Key "POSTGRES_DB"
    docker exec -e PGPASSWORD=$pass $PgContainer psql -h 127.0.0.1 -U $user -d $db -c "SELECT 1" *> $null
    return ($LASTEXITCODE -eq 0)
}

function Test-RedisReady {
    param([int]$TimeoutSec = 20)
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        $pong = docker exec $RedisContainer redis-cli ping 2>$null
        if ($pong -eq "PONG") { return $true }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    return $false
}

function Get-EnvFileDatabaseUrls {
    # There are three files that can define DATABASE_URL (root .env, backend/.env,
    # ai-service/.env) with different, file-specific load-order rules per process.
    # They drifting out of sync silently is exactly what caused the
    # "password authentication failed" bug this tooling exists to catch --
    # ai-service/.env is easy to miss because it's a dotfile `ls` hides by default.
    $files = @{
        "root .env"        = (Join-Path $RepoRoot ".env")
        "backend/.env"     = (Join-Path $BackendDir ".env")
        "ai-service/.env"  = (Join-Path $AiServiceDir ".env")
    }
    $result = @{}
    foreach ($label in $files.Keys) {
        $file = $files[$label]
        if (Test-Path $file) {
            $value = Get-EnvValue -Key "DATABASE_URL" -Files @($file)
            if ($value) { $result[$label] = $value }
        }
    }
    return $result
}

function Get-PoppplerAvailable {
    $cmd = Get-Command pdftoppm.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "C:\Program Files\poppler\Library\bin\pdftoppm.exe",
        "C:\Program Files (x86)\poppler\Library\bin\pdftoppm.exe",
        "C:\poppler\Library\bin\pdftoppm.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    $globs = @("C:\Program Files\poppler*\Library\bin\pdftoppm.exe", "C:\poppler*\Library\bin\pdftoppm.exe")
    foreach ($g in $globs) {
        $hit = Get-ChildItem -Path $g -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    return $null
}

function Write-StatusLine {
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][bool]$Ok,
        [string]$Detail = ""
    )
    $tag = if ($Ok) { "[OK]" } else { "[FAIL]" }
    $color = if ($Ok) { "Green" } else { "Red" }
    $line = "{0,-24} {1}" -f $Label, $tag
    if ($Detail) { $line += "  $Detail" }
    Write-Host $line -ForegroundColor $color
}

function Save-Pid {
    param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][int]$ProcessId)
    Set-Content -Path (Join-Path $RunDir "$Name.pid") -Value $ProcessId
}

function Get-SavedPid {
    param([Parameter(Mandatory)][string]$Name)
    $file = Join-Path $RunDir "$Name.pid"
    if (-not (Test-Path $file)) { return $null }
    $raw = (Get-Content $file -ErrorAction SilentlyContinue | Select-Object -First 1)
    if (-not $raw) { return $null }
    $procId = 0
    if ([int]::TryParse($raw.Trim(), [ref]$procId)) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) { return $procId }
    }
    return $null
}
