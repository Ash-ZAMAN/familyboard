#!/usr/bin/env bash
# =============================================================================
# Family Board — Script de Démarrage Isolé ("Zero Trace")
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  FAMILY BOARD — Démarrage de l'environnement local isolé"
echo "============================================================"

# 1. Création ou activation du .venv local
if [ ! -d ".venv" ]; then
  echo "[1/3] Initialisation de l'environnement virtuel Python (.venv)..."
  python3 -m venv .venv || python -m venv .venv
fi

if [ -f ".venv/bin/activate" ]; then
  source .venv/bin/activate
  PYTHON_BIN="$SCRIPT_DIR/.venv/bin/python"
elif [ -f ".venv/Scripts/activate" ]; then
  source .venv/Scripts/activate
  PYTHON_BIN="$SCRIPT_DIR/.venv/Scripts/python.exe"
fi

# 2. Lancement du Backend FastAPI (Port 8000)
echo "[2/3] Démarrage du Backend FastAPI + SQLite (./data/familyboard.db)..."
(
  cd "$SCRIPT_DIR/backend"
  "$PYTHON_BIN" -m uvicorn main:app --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

# 3. Lancement du Frontend Vite (Port 5173)
echo "[3/3] Démarrage du Frontend React + Vite (http://localhost:5173)..."
(
  cd "$SCRIPT_DIR/frontend"
  npm run dev -- --host 127.0.0.1 --port 5173
) &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "Arrêt propre des serveurs Family Board..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
echo "✅ Family Board est prêt :"
echo "   👉 Interface Kiosque : http://localhost:5173"
echo "   👉 Documentation API : http://127.0.0.1:8000/docs"
echo "   👉 Code PIN Parent   : 1234"
echo "Appuyez sur Ctrl+C pour arrêter les serveurs."

wait

