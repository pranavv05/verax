@echo off
echo Starting Verax...

echo Starting Docker services...
docker start pg
docker start ca-redis
timeout /t 5

echo Starting AI service...
start "AI Service" cmd /k "cd ai-service && venv\Scripts\uvicorn.exe app.main:app --reload --port 8000"
timeout /t 10

echo Starting Backend...
start "Backend" cmd /k "cd backend && npm run dev"
timeout /t 5

echo Starting Document Worker...
start "Worker" cmd /k "cd backend && npm run worker:documents:dev"
timeout /t 3

echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo All services starting...
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000
echo AI Service: http://localhost:8000
echo.
echo Login: admin@demo.com / Demo@123456
