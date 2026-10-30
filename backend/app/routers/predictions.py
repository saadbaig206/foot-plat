"""Predictions router (/api/predictions/*).
Exposes endpoints for retrieving, inspecting, and generating match predictions.
"""
from datetime import date
import json
from typing import Any
from fastapi import APIRouter, HTTPException, Query
from ..db import query, query_one
from ..services.prediction_service import get_model_service

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("")
def list_predictions(
    league: str | None = None,
    team_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """List recent and upcoming predictions."""
    where_clauses = ["1=1"]
    limit_val = int(limit) if isinstance(limit, (int, str)) else (getattr(limit, "default", 25) or 25)
    offset_val = int(offset) if isinstance(offset, (int, str)) else (getattr(offset, "default", 0) or 0)
    params = {"limit": limit_val, "offset": offset_val}

    if league:
        where_clauses.append("l.code = %(league)s")
        params["league"] = league
    if team_id:
        where_clauses.append("(m.home_team_id = %(team)s OR m.away_team_id = %(team)s)")
        params["team"] = team_id
    if date_from:
        where_clauses.append("m.match_date >= %(date_from)s")
        params["date_from"] = date_from
    if date_to:
        where_clauses.append("m.match_date <= %(date_to)s")
        params["date_to"] = date_to

    where_sql = " AND ".join(where_clauses)
    sql = f"""
        SELECT p.id AS prediction_id, p.match_id, p.generated_at,
               p.p_home, p.p_draw, p.p_away, p.p_fav_avoids_defeat, p.favourite_side,
               p.exp_home_goals, p.exp_away_goals, p.predicted_score, p.confidence,
               mv.version AS model_version,
               m.match_date, m.status, m.home_goals, m.away_goals, m.result,
               l.code AS league_code, l.name AS league_name,
               ht.id AS home_team_id, ht.name AS home_team, ht.logo_url AS home_logo,
               at.id AS away_team_id, at.name AS away_team, at.logo_url AS away_logo
        FROM predictions p
        JOIN model_versions mv ON mv.id = p.model_version_id
        JOIN matches m ON m.id = p.match_id
        JOIN leagues l ON l.id = m.league_id
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE {where_sql}
        ORDER BY m.match_date DESC, p.generated_at DESC
        LIMIT %(limit)s OFFSET %(offset)s
    """
    rows = query(sql, params)
    for r in rows:
        r["disclaimer"] = "Probabilistic estimates, not guaranteed outcomes. Accuracy is at bookmaker-implied level."
        r["probabilities"] = {
            "home": round(r["p_home"], 4) if r.get("p_home") is not None else None,
            "draw": round(r["p_draw"], 4) if r.get("p_draw") is not None else None,
            "away": round(r["p_away"], 4) if r.get("p_away") is not None else None,
        }
    return rows


@router.get("/match/{match_id}")
def match_prediction(match_id: int):
    """Retrieve or generate in real-time the prediction for a specific match."""
    # Check if match exists
    m = query_one("SELECT id FROM matches WHERE id = %s", (match_id,))
    if not m:
        raise HTTPException(status_code=404, detail="Match not found.")

    try:
        service = get_model_service()
        pred = service.predict_for_match(match_id, persist=True)
        return pred
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")


@router.post("/generate")
def generate_upcoming_predictions(limit: int = Query(50, ge=1, le=200)):
    """Batch generate predictions for scheduled fixtures without recent predictions."""
    sql = """
        SELECT m.id
        FROM matches m
        LEFT JOIN predictions p ON p.match_id = m.id
        WHERE m.status IN ('scheduled', 'live')
          AND p.id IS NULL
        ORDER BY m.match_date ASC
        LIMIT %s
    """
    rows = query(sql, (limit,))
    if not rows:
        return {"status": "ok", "generated": 0, "message": "No unpredicted scheduled matches found."}

    service = get_model_service()
    generated = 0
    errors = []

    for r in rows:
        mid = r["id"]
        try:
            service.predict_for_match(mid, persist=True)
            generated += 1
        except Exception as e:
            errors.append({"match_id": mid, "error": str(e)})

    return {
        "status": "ok",
        "generated": generated,
        "failed": len(errors),
        "errors": errors[:5]
    }
