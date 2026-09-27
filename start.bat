@echo off
setlocal
cd /d "%~dp0"

REM Container names come from docker-compose.yml (container_name:).
set "PG_CONTAINER=ca-postgres"
set "REDIS_CONTAINER=ca-redis"
set "DOCKER_TIMEOUT=60"
set "PG_TIMEOUT=60"

echo ========================================
echo   Starting Verax Development Environment
echo ========================================
echo.

REM --- Step 1: Make sure Docker Desktop is running ---
echo [1/5] Checking Docker Desktop...
docker info >nul 2>&1
if %errorlevel%==0 goto docker_ready

echo       Docker Desktop is not running. Starting it now...
set "DOCKER_DESKTOP_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not exist "%DOCKER_DESKTOP_EXE%" (
    echo.
    echo ERROR: Could not find Docker Desktop at:
    echo   "%DOCKER_DESKTOP_EXE%"
    echo Start Docker Desktop manually and re-run this script.
    pause
    exit /b 1
)
start "" "%DOCKER_DESKTOP_EXE%"

set /a DOCKER_ELAPSED=0
:wait_docker
docker info >nul 2>&1
if %errorlevel%==0 goto docker_ready
if %DOCKER_ELAPSED% geq %DOCKER_TIMEOUT% (
    echo.
    echo ERROR: Docker Desktop did not become ready within %DOCKER_TIMEOUT% seconds.
    echo Open Docker Desktop, wait for it to finish starting, then re-run this script.
    pause
    exit /b 1
)
echo       Waiting for Docker engine... ^(%DOCKER_ELAPSED%s / %DOCKER_TIMEOUT%s^)
timeout /t 2 /nobreak >nul
set /a DOCKER_ELAPSED+=2
goto wait_docker

:docker_ready
echo       Docker engine is ready.
echo.

REM --- Step 2: Start postgres and redis containers ---
echo [2/5] Starting containers...
REM "docker compose up" creates the containers on first run and just starts
REM them afterwards, so this also works on a fresh machine.
docker compose up -d postgres redis
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not start the postgres/redis containers.
    echo Check the output above, and "docker ps -a" for port conflicts on 5432/6379.
    pause
    exit /b 1
)
echo.

echo       Running containers:
docker ps --filter "name=^%PG_CONTAINER%$" --filter "name=^%REDIS_CONTAINER%$" --format "         {{.Names}}  -  {{.Status}}"
echo.

REM --- Step 3: Wait for postgres to accept connections ---
echo [3/5] Waiting for PostgreSQL to accept connections...
set /a PG_ELAPSED=0
:wait_pg
docker exec %PG_CONTAINER% pg_isready >nul 2>&1
if %errorlevel%==0 goto pg_ready
if %PG_ELAPSED% geq %PG_TIMEOUT% (
    echo.
    echo ERROR: PostgreSQL in container "%PG_CONTAINER%" did not accept connections
    echo within %PG_TIMEOUT% seconds. Check the container logs with:
    echo   docker logs %PG_CONTAINER%
    pause
    exit /b 1
)
echo       Waiting for postgres... ^(%PG_ELAPSED%s / %PG_TIMEOUT%s^)
timeout /t 2 /nobreak >nul
set /a PG_ELAPSED+=2
goto wait_pg

:pg_ready
echo       PostgreSQL is ready at localhost:5432.
echo.

REM The repo-root .env uses docker-network hostnames (postgres, redis,
REM ai-service) for the compose setup. The services below run on this machine,
REM so point them at localhost instead. dotenv never overrides a variable that
REM is already set, so these win over .env without editing it.
set "POSTGRES_USER=ca_user"
set "POSTGRES_PASSWORD=ca_password"
set "POSTGRES_DB=ca_saas"
REM Same dev default the ca_app migration falls back to.
set "APP_DB_PASSWORD=ca_app_dev_password_change_me"
if exist ".env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
        if /i "%%A"=="POSTGRES_USER" set "POSTGRES_USER=%%B"
        if /i "%%A"=="POSTGRES_PASSWORD" set "POSTGRES_PASSWORD=%%B"
        if /i "%%A"=="POSTGRES_DB" set "POSTGRES_DB=%%B"
        if /i "%%A"=="APP_DB_PASSWORD" set "APP_DB_PASSWORD=%%B"
    )
)
REM DATABASE_URL is the superuser, used only for migrations. The backend and
REM worker refuse to run queries as a superuser (RLS would be bypassed), so
REM they connect as the least-privilege ca_app role via APP_DATABASE_URL.
set "DATABASE_URL=postgresql://%POSTGRES_USER%:%POSTGRES_PASSWORD%@localhost:5432/%POSTGRES_DB%"
set "APP_DATABASE_URL=postgresql://ca_app:%APP_DB_PASSWORD%@localhost:5432/%POSTGRES_DB%"
set "REDIS_URL=redis://localhost:6379"
set "AI_SERVICE_URL=http://localhost:8000"
set "AI_SERVICE_PORT=8000"
REM The backend always writes uploads to backend\local-storage; the AI service
REM must read from the same folder.
set "LOCAL_STORAGE_PATH=%CD%\backend\local-storage"

if not exist "ai-service\venv\Scripts\uvicorn.exe" (
    echo ERROR: AI service virtualenv not found. Create it once with:
    echo   cd ai-service
    echo   py -3.12 -m venv venv
    echo   venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

REM Apply any pending migrations (a no-op when up to date). The ca_app role
REM the backend connects as is itself created by a migration.
echo       Applying database migrations...
pushd backend
call npm run migrate:latest
set "MIGRATE_RESULT=%errorlevel%"
popd
if not "%MIGRATE_RESULT%"=="0" (
    echo.
    echo ERROR: Database migrations failed. See the output above.
    pause
    exit /b 1
)
echo.

REM --- Step 4: Start application services ---
echo [4/5] Starting AI service...
start "AI Service" cmd /k "cd ai-service && venv\Scripts\uvicorn.exe app.main:app --reload --port 8000"
timeout /t 10 /nobreak >nul

echo       Starting Backend...
start "Backend" cmd /k "cd backend && npm run dev"
timeout /t 5 /nobreak >nul

echo       Starting Document Worker...
start "Worker" cmd /k "cd backend && npm run worker:documents:dev"
timeout /t 3 /nobreak >nul

echo [5/5] Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo   All services starting
echo ========================================
echo Frontend:    http://localhost:5173
echo Backend:     http://localhost:3000
echo AI Service:  http://localhost:8000
echo Postgres:    localhost:5432  ^(container: %PG_CONTAINER%^)
echo Redis:       localhost:6379  ^(container: %REDIS_CONTAINER%^)
echo.
echo Login: admin@demo.com / Demo@123456
echo.

endlocal
