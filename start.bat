@echo off
TITLE Bunker Full-Stack Launcher
COLOR 0A

echo ============================================================
echo           🚀 Starting Bunker Full-Stack System             
echo ============================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

:: -----------------------------------------------------------------------------
:: 1. Environment Files Check
:: -----------------------------------------------------------------------------
echo [1/4] Checking environment configurations...

if not exist ".env.local" (
    if exist ".env.example" (
        echo  -^> .env.local not found. Copying from .env.example...
        copy .env.example .env.local >nul
    ) else (
        echo  -^> Warning: .env.local and .env.example missing.
    )
)

if not exist "backend\.env" (
    if exist "backend\.env.example" (
        echo  -^> backend\.env not found. Copying from backend\.env.example...
        copy backend\.env.example backend\.env >nul
    ) else (
        echo  -^> Warning: backend\.env missing.
    )
)

echo  ✓ Environment files verified.
echo.

:: -----------------------------------------------------------------------------
:: 2. Database & Cache Services (Docker / Local)
:: -----------------------------------------------------------------------------
echo [2/4] Starting Database & Redis services...

docker info >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  -^> Docker daemon detected. Starting PostgreSQL (pgvector) & Redis...
    docker compose up -d db redis >nul 2>&1 || docker-compose up -d db redis >nul 2>&1
    echo  ✓ Docker containers started.
) else (
    echo  -^> Docker not running or not found. Assuming local Postgres & Redis services are active on ports 5432 & 6379.
)
echo.

:: -----------------------------------------------------------------------------
:: 3. Backend Setup & Migrations
:: -----------------------------------------------------------------------------
echo [3/4] Preparing FastAPI Backend...

cd /d "%ROOT_DIR%backend"

set VENV_PATH=
if exist ".venv" (
    set VENV_PATH=.venv
) else if exist "venv" (
    set VENV_PATH=venv
) else (
    echo  -^> Creating Python virtual environment in backend\.venv...
    python -m venv .venv
    set VENV_PATH=.venv
)

call %VENV_PATH%\Scripts\activate.bat

if exist "requirements.txt" (
    python -c "import fastapi, uvicorn, alembic" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo  ✓ Python dependencies already installed.
    ) else (
        echo  -^> Installing Python dependencies...
        pip install -r requirements.txt
    )
)

echo  -^> Running Alembic database migrations...
alembic upgrade head >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  ✓ Database schema updated.
) else (
    echo  -^> Note: Alembic migration warning (check DB connection). Continuing setup...
)

echo  -^> Launching FastAPI server window on http://localhost:8000 ...
start "Bunker Backend API" cmd /k "cd /d %ROOT_DIR%backend && call %VENV_PATH%\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

cd /d "%ROOT_DIR%"
echo  ✓ FastAPI Backend launched.
echo.

:: -----------------------------------------------------------------------------
:: 4. Frontend Setup & Launch
:: -----------------------------------------------------------------------------
echo [4/4] Preparing Next.js Frontend...

where bun >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PKG_CMD=bun
) else (
    set PKG_CMD=npm
)

if not exist "node_modules" (
    echo  -^> node_modules not found. Installing dependencies using %PKG_CMD%...
    call %PKG_CMD% install
)

echo.
echo ============================================================
echo   🎉 All components initialized!
echo   - Backend API:    http://localhost:8000
echo   - API Docs:       http://localhost:8000/docs
echo   - Next.js Web:    http://localhost:3000
echo ============================================================
echo.

echo  -^> Launching Next.js development server...
if "%PKG_CMD%"=="bun" (
    bun dev
) else (
    npm run dev
)
