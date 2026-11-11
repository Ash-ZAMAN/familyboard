#!/usr/bin/env bash
# =============================================================================
# Family Board — Script d'Arrêt & Nettoyage ("Zero Trace")
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  FAMILY BOARD — Arrêt des services et nettoyage local"
echo "============================================================"

# Arrêt des processus locaux éventuels
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

if [ "$1" == "--all" ]; then
  echo "Suppression des environnements locaux (.venv, frontend/node_modules, .cache, data)..."
  rm -rf .venv frontend/node_modules frontend/dist .cache data
  echo "✅ Nettoyage complet effectué. Vous pouvez maintenant supprimer le dossier racine."
else
  echo "✅ Processus arrêtés."
  echo "💡 Pour supprimer les dépendances et la base SQLite : ./clean.sh --all"
  echo "💡 Pour supprimer tout le projet sans laisser aucune trace sur le système hôte :"
  echo "   cd .. && rm -rf familyboard"
fi

