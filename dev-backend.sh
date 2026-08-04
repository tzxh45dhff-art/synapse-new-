#!/usr/bin/env bash

# Exit immediately if any command fails
set -e

# Color codes
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}   🚀 Starting Laptop Backend + Ngrok Tunnel               ${NC}"
echo -e "${CYAN}============================================================${NC}"

# Cleanup spawned child processes on exit
cleanup() {
    echo -e "\n${YELLOW}[Shutdown] Stopping backend and tunnel...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$TUNNEL_PID" ]; then
        kill "$TUNNEL_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}[Shutdown] Done.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Start Backend
echo -e "${GREEN}[1/2] Launching FastAPI Backend on port 8000...${NC}"
cd "$ROOT_DIR/backend"

if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# Ensure port 8000 is free before starting
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo -e "${GREEN} ✓ Backend started (PID: $BACKEND_PID)${NC}"

# 2. Start Ngrok Tunnel
echo -e "${GREEN}[2/2] Connecting Ngrok Tunnel to Vercel...${NC}"
cd "$ROOT_DIR"
npx ngrok http --url=nimbly-unroasted-gaffe.ngrok-free.dev 8000 &
TUNNEL_PID=$!

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN} 🎉 Bunker Backend & Tunnel are live!                        ${NC}"
echo -e "${CYAN} URL: https://nimbly-unroasted-gaffe.ngrok-free.dev        ${NC}"
echo -e "${CYAN} Press Ctrl+C anytime to stop.                             ${NC}"
echo -e "${CYAN}============================================================${NC}"

wait $BACKEND_PID $TUNNEL_PID
