from fastapi import APIRouter, HTTPException
from ..db import query, query_one
from ..ml.registry import model_status

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health")
def health():
    try:
        query_one("SELECT 1 AS ok")
        return {"status": "ok", "database": "up"}
    except Exception as e:  # report, don't hide
        raise HTTPException(status_code=503, detail=f"database unavailable: {type(e).__name__}")


@router.get("/models/status")
def models_status():
    return model_status()


@router.get("/data/last-updated")
def data_last_updated():
    row = query_one(
        """SELECT (SELECT max(last_updated) FROM matches)        AS matches,
                  (SELECT max(last_updated) FROM league_standings) AS standings,
                  (SELECT max(last_updated) FROM player_stats)    AS player_stats,
                  (SELECT max(match_date)   FROM matches WHERE status='finished') AS latest_result_date,
                  (SELECT max(finished_at)  FROM ingestion_runs WHERE status='ok') AS last_successful_ingest"""
    )
    return row
