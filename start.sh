#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status unless handled
set -e

# Color codes for visual formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "============================================================"
echo "          🚀 Starting Bunker Full-Stack System             "
echo "============================================================"
echo -e "${NC}"

# Get the root project directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Cleanup function to kill spawned child processes on exit
cleanup() {
    echo -e "\n${YELLOW}[Shutdown] Stopping all services...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        echo -e "${YELLOW}[Shutdown] Terminating FastAPI Backend (PID: $BACKEND_PID)...${NC}"
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        echo -e "${YELLOW}[Shutdown] Terminating Next.js Frontend (PID: $FRONTEND_PID)...${NC}"
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}[Shutdown] Clean exit completed.${NC}"
    exit 0
}

# Trap signals for graceful shutdown
trap cleanup SIGINT SIGTERM EXIT

# -----------------------------------------------------------------------------
# 1. Environment Files Check
# -----------------------------------------------------------------------------
echo -e "${BLUE}[1/4] Checking environment configurations...${NC}"

if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW} -> .env.local not found. Copying from .env.example...${NC}"
        cp .env.example .env.local
    else
        echo -e "${YELLOW} -> Warning: .env.local and .env.example missing.${NC}"
    fi
fi

if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        echo -e "${YELLOW} -> backend/.env not found. Copying from backend/.env.example...${NC}"
        cp backend/.env.example backend/.env
    else
        echo -e "${YELLOW} -> Warning: backend/.env missing.${NC}"
    fi
fi

echo -e "${GREEN} ✓ Environment files verified.${NC}\n"

# -----------------------------------------------------------------------------
# 2. Database & Cache Services (Docker / System)
# -----------------------------------------------------------------------------
echo -e "${BLUE}[2/4] Starting Database & Redis services...${NC}"

if command -v docker &>/dev/null && docker info &>/dev/null; then
    echo -e "${CYAN} -> Docker daemon detected. Spinning up PostgreSQL (pgvector) & Redis containers...${NC}"
    if command -v docker-compose &>/dev/null; then
        docker-compose up -d db redis
    else
        docker compose up -d db redis
    fi
    echo -e "${GREEN} ✓ Docker services up and running.${NC}\n"
else
    echo -e "${YELLOW} -> Docker not running or not found. Assuming local Postgres & Redis services are running on ports 5432 & 6379.${NC}\n"
fi

# -----------------------------------------------------------------------------
# 3. Backend Setup & Start
# -----------------------------------------------------------------------------
echo -e "${BLUE}[3/4] Preparing and starting FastAPI Backend...${NC}"

cd "$ROOT_DIR/backend"

PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo -e "${RED}[ERROR] Python is required but not installed or not in PATH.${NC}"
    exit 1
fi

# Setup Virtual Environment if it doesn't exist
VENV_DIR=""
if [ -d ".venv" ]; then
    VENV_DIR=".venv"
elif [ -d "venv" ]; then
    VENV_DIR="venv"
else
    echo -e "${YELLOW} -> Virtual environment not found. Creating backend/.venv...${NC}"
    $PYTHON_CMD -m venv .venv
    VENV_DIR=".venv"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Check dependencies
if [ -f "requirements.txt" ]; then
    if python -c "import fastapi, uvicorn, alembic" &>/dev/null; then
        echo -e "${GREEN} ✓ Python dependencies already installed.${NC}"
    else
        echo -e "${CYAN} -> Installing Python dependencies...${NC}"
        pip install -r requirements.txt
    fi
fi

# Run Database Migrations
echo -e "${CYAN} -> Running Alembic database migrations...${NC}"
if alembic upgrade head 2>/dev/null; then
    echo -e "${GREEN} ✓ Database schema updated.${NC}"
else
    echo -e "${YELLOW} -> Note: Alembic migration encountered an issue (is Postgres reachable?). Continuing to start server...${NC}"
fi

# Start FastAPI in background
echo -e "${CYAN} -> Launching FastAPI server on http://localhost:8000 ...${NC}"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd "$ROOT_DIR"
echo -e "${GREEN} ✓ FastAPI Backend launched (PID: $BACKEND_PID).${NC}\n"

# -----------------------------------------------------------------------------
# 4. Frontend Setup & Start
# -----------------------------------------------------------------------------
echo -e "${BLUE}[4/4] Preparing and starting Next.js Frontend...${NC}"

# Determine JS Package Manager
PKG_MGR=""
if command -v bun &>/dev/null; then
    PKG_MGR="bun"
elif command -v npm &>/dev/null; then
    PKG_MGR="npm"
else
    echo -e "${RED}[ERROR] Neither bun nor npm was found in PATH.${NC}"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW} -> node_modules not found. Installing frontend dependencies using $PKG_MGR...${NC}"
    $PKG_MGR install
fi

echo -e "${GREEN}"
echo "============================================================"
echo "  🎉 All components initialized!"
echo "  - Backend API:    http://localhost:8000"
echo "  - API Docs:       http://localhost:8000/docs"
echo "  - Next.js Web:    http://localhost:3000"
echo "============================================================"
echo -e "${NC}"

echo -e "${CYAN} -> Starting Next.js development server...${NC}"
if [ "$PKG_MGR" = "bun" ]; then
    bun dev &
    FRONTEND_PID=$!
else
    npm run dev &
    FRONTEND_PID=$!
fi

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
