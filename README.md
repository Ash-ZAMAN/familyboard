# Family Board — Tableau de Bord Familial (Kiosk / Smart Display)

Application web complète inspirée de **Family Board**, personnalisée avec un module d'**Horaires de prière** (API Aladhan avec mise en évidence dynamique) et conçue selon une architecture **100 % locale et strictement isolée ("Zero Trace")**.

---

## Architecture & Confinement "Zero Trace"

Tout est strictement confiné dans ce répertoire unique (`familyboard/`) :
- `./.venv/` : Environnement virtuel Python local contenant `fastapi`, `uvicorn`, `pydantic`, `httpx`.
- `./data/familyboard.db` : Base de données SQLite locale auto-initialisée avec les données de démonstration (*Seed Data*).
- `./backend/` : Serveur API FastAPI ([main.py](file:///c:/Users/ashra/projet/familyboard/backend/main.py) & [database.py](file:///c:/Users/ashra/projet/familyboard/backend/database.py)).
- `./frontend/` : Interface React + Vite + TypeScript + Tailwind CSS (`node_modules` 100 % local).
- `./.cache/` : Cache local isolé pour `uv` / `npm`.

---

## Démarrage Rapide

### Option 1 : Script unifié Bash (`start.sh`)
```bash
chmod +x start.sh clean.sh
./start.sh
```

### Option 2 : Script PowerShell sous Windows (`start.ps1`)
```powershell
.\start.ps1
```

### Accès à l'application
- **Tableau de bord (Kiosque Paysage)** : http://localhost:5173
- **Documentation API FastAPI (Swagger)** : http://127.0.0.1:8000/docs
- **Code PIN Parent par défaut** : `1234`

---

## Arrêt & Suppression Propre ("Zero Trace")

Pour arrêter tous les serveurs et supprimer intégralement le projet sans laisser aucune trace sur votre système hôte :

```bash
# Arrêter les processus et nettoyer les caches/environnements locaux :
./clean.sh --all

# Ou supprimer directement le dossier racine du projet :
cd ..
rm -rf familyboard
```
Sous Windows PowerShell :
```powershell
cd ..
Remove-Item -Recurse -Force .\familyboard
```

