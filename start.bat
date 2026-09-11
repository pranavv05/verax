@echo off
setlocal enabledelayedexpansion

set "PG_CONTAINER=pg"
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
docker start %PG_CONTAINER% >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not start container "%PG_CONTAINER%".
    echo Check that it exists with: docker ps -a
    pause
    exit /b 1
)
echo       Started %PG_CONTAINER%.

docker start %REDIS_CONTAINER% >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Could not start container "%REDIS_CONTAINER%".
    echo Check that it exists with: docker ps -a
    pause
    exit /b 1
)
echo       Started %REDIS_CONTAINER%.
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
if /i "%PG_CONTAINER%"=="pg" (
    echo       Postgres container is "pg" -^> reachable at localhost:5432
) else (
    echo       Postgres container "%PG_CONTAINER%" is ready.
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
