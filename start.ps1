# =============================================================================
# Family Board — Script de Démarrage PowerShell (Windows)
# =============================================================================
$ErrorActionPreference = "Continue"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

$env:PATH = "C:\Program Files\nodejs;" + $env:PATH

Write-Host "============================================================" -ForegroundColor Amber
Write-Host "  FAMILY BOARD — Démarrage Local Isolé (Zero Trace)" -ForegroundColor Cyan
Write-Host "============================================================"

Write-Host "[1/2] Lancement du Backend FastAPI sur http://127.0.0.1:8000 ..."
$BackendProc = Start-Process -FilePath "$RootDir\.venv\Scripts\python.exe" `
  -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port 8000" `
  -WorkingDirectory "$RootDir\backend" -PassThru -NoNewWindow

Write-Host "[2/2] Lancement du Frontend Vite sur http://localhost:5173 ..."
$FrontendProc = Start-Process -FilePath "C:\Program Files\nodejs\npm.cmd" `
  -ArgumentList "run dev -- --host 127.0.0.1 --port 5173" `
  -WorkingDirectory "$RootDir\frontend" -PassThru -NoNewWindow

Write-Host ""
Write-Host "✅ Family Board est actif :" -ForegroundColor Green
Write-Host "   👉 Tableau de Bord : http://localhost:5173"
Write-Host "   👉 API FastAPI     : http://127.0.0.1:8000/docs"
Write-Host "   👉 Code PIN Parent : 1234"
Write-Host ""
Write-Host "Appuyez sur Entrée pour arrêter les serveurs..."
Read-Host
Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $FrontendProc.Id -Force -ErrorAction SilentlyContinue

