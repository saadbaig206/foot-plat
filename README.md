# PitchsideIQ — football analytics & prediction platform

Status: **Phase 1 complete** (foundation). Phases 2–6 pending; see `docs/`.

## Run locally
```bash
cp .env.example .env
docker compose up -d db                      # Postgres 16 + schema from db/schema.sql
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.ingest.load_history /path/to/Club-Football-Match-Data-main/data
.venv/bin/uvicorn app.main:app --port 8000   # API docs at /docs
.venv/bin/python -m pytest -q tests          # needs the DB loaded
cd ../frontend && npm install && npm run build && npm start   # http://localhost:3000
```

## What exists
- `db/schema.sql` — 13 tables (leagues … predictions, model_versions, ingestion_runs); source + timestamp on every row.
- `backend/` — FastAPI: health, models/status, data/last-updated, leagues, seasons, teams, players, fixtures,
  results, matches, standings, stats/summary. Idempotent CSV history loader (184,378 matches).
- `frontend/` — Next.js 16 + Tailwind: sidebar navigation, 7 pages, loading/error/empty states, mobile layout,
  Tableau embed component (activates when `NEXT_PUBLIC_TABLEAU_VIZ_URL` is set).

## Honest status
- No trained model is registered; /predictions says so. No upcoming fixtures until a feed key is added.
- `backend/scripts/model_audit.py` reproduces the model audit: the notebook's favourite model is well calibrated
  but equals bookmaker odds (AUC 0.626 vs 0.628); the 86–91% tiers reflect match selection, not edge.
- `models/model.pkl` from the notebook must NOT be served as-is: its scaler is a second pass over features that
  were already standardised by a scaler that was never saved.

Data: Football-Data.co.uk results/odds and ClubElo (MIT compilation by xgabora). Elo after 15 Jun 2025 is provisional.
