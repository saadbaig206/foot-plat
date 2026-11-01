"""Tests for Predictions, Inference, Standings, and Rankings (Phases 2, 4, 5)."""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from datetime import date
from app.db import execute, query_one
from app.ml.registry import register_v1_artifact, model_status
from app.services.prediction_service import get_model_service
from app.services.standings_calculator import compute_league_standings
from app.routers.predictions import list_predictions, match_prediction
from app.routers.rankings import golden_boot, ballon_dor
from app.routers.football import standings, results, fixtures
from app.routers.system import health, models_status


def setup_module():
    """Seed test league, teams, seasons, and matches."""
    execute("INSERT INTO leagues (code, name, country, tier, source) VALUES ('E0', 'Premier League', 'England', 1, 'test') ON CONFLICT DO NOTHING")
    execute("INSERT INTO seasons (label, start_date, end_date) VALUES ('2026/27', '2026-07-01', '2027-06-30') ON CONFLICT DO NOTHING")
    execute("INSERT INTO teams (name, country, source) VALUES ('Arsenal', 'England', 'test') ON CONFLICT DO NOTHING")
    execute("INSERT INTO teams (name, country, source) VALUES ('Chelsea', 'England', 'test') ON CONFLICT DO NOTHING")
    execute("INSERT INTO teams (name, country, source) VALUES ('Liverpool', 'England', 'test') ON CONFLICT DO NOTHING")

    lid = query_one("SELECT id FROM leagues WHERE code = 'E0'")["id"]
    sid = query_one("SELECT id FROM seasons WHERE label = '2026/27'")["id"]
    t1 = query_one("SELECT id FROM teams WHERE name = 'Arsenal'")["id"]
    t2 = query_one("SELECT id FROM teams WHERE name = 'Chelsea'")["id"]
    t3 = query_one("SELECT id FROM teams WHERE name = 'Liverpool'")["id"]

    # Finished matches for standings
    execute("""
        INSERT INTO matches (league_id, season_id, match_date, home_team_id, away_team_id, status, home_goals, away_goals, result, source)
        VALUES (%s, %s, '2026-08-15', %s, %s, 'finished', 3, 1, 'H', 'test')
        ON CONFLICT DO NOTHING
    """, (lid, sid, t1, t2))

    execute("""
        INSERT INTO matches (league_id, season_id, match_date, home_team_id, away_team_id, status, home_goals, away_goals, result, source)
        VALUES (%s, %s, '2026-08-22', %s, %s, 'finished', 2, 2, 'D', 'test')
        ON CONFLICT DO NOTHING
    """, (lid, sid, t2, t3))

    # Scheduled match for prediction
    execute("""
        INSERT INTO matches (league_id, season_id, match_date, home_team_id, away_team_id, status,
                             home_elo, away_elo, odd_home, odd_draw, odd_away, source)
        VALUES (%s, %s, '2026-11-05', %s, %s, 'scheduled', 1850.0, 1780.0, 2.10, 3.50, 3.40, 'test')
        ON CONFLICT DO NOTHING
    """, (lid, sid, t1, t3))


def test_model_registration():
    reg = register_v1_artifact("artifacts/v1")
    assert reg["status"] == "registered"
    assert reg["version"] == "v1"

    status = model_status()
    assert status["models_registered"] >= 1
    assert status["models_active"] >= 1
    assert status["ready_for_predictions"] is True


def test_prediction_inference_service():
    lid = query_one("SELECT id FROM leagues WHERE code = 'E0'")["id"]
    t1 = query_one("SELECT id FROM teams WHERE name = 'Arsenal'")["id"]
    t3 = query_one("SELECT id FROM teams WHERE name = 'Liverpool'")["id"]
    m = query_one("SELECT id FROM matches WHERE league_id = %s AND home_team_id = %s AND away_team_id = %s AND status = 'scheduled'", (lid, t1, t3))
    assert m is not None

    service = get_model_service()
    pred = service.predict_for_match(m["id"], persist=True)

    assert "probabilities" in pred
    assert "home" in pred["probabilities"]
    assert "draw" in pred["probabilities"]
    assert "away" in pred["probabilities"]
    total_p = pred["probabilities"]["home"] + pred["probabilities"]["draw"] + pred["probabilities"]["away"]
    assert 0.99 <= total_p <= 1.01

    assert "predicted_goals" in pred
    assert pred["predicted_goals"]["home"] > 0
    assert pred["predicted_goals"]["away"] > 0

    assert "predicted_score" in pred
    assert len(pred["top_scorelines"]) == 5
    assert pred["confidence"] > 0
    assert "explanation" in pred
    assert "disclaimer" in pred


def test_predictions_api_endpoints():
    data = list_predictions()
    assert isinstance(data, list)
    assert len(data) >= 1
    p = data[0]
    assert "p_home" in p
    assert "predicted_score" in p
    assert "disclaimer" in p

    mid = p["match_id"]
    single = match_prediction(mid)
    assert single["match_id"] == mid
    assert "probabilities" in single
    assert "explanation" in single


def test_standings_computation():
    res = compute_league_standings()
    assert res["standings_rows"] >= 2
    assert res["performance_rows"] >= 2

    # Query standings endpoint function
    st = standings(league="E0", season="2026/27")
    assert len(st) >= 2
    arsenal_row = next((r for r in st if r["team"] in ("Arsenal", "Arsenal FC")), None)
    assert arsenal_row is not None
    assert arsenal_row["points"] >= 3


def test_rankings_api():
    # Insert dummy player & stats
    execute("INSERT INTO players (name, nationality, position, source) VALUES ('Bukayo Saka', 'England', 'Forward', 'test') ON CONFLICT DO NOTHING")
    pid = query_one("SELECT id FROM players WHERE name = 'Bukayo Saka'")["id"]
    lid = query_one("SELECT id FROM leagues WHERE code = 'E0'")["id"]
    sid = query_one("SELECT id FROM seasons WHERE label = '2026/27'")["id"]
    tid = query_one("SELECT id FROM teams WHERE name = 'Arsenal'")["id"]

    execute("""
        INSERT INTO player_stats (player_id, league_id, season_id, team_id, appearances, minutes, goals, assists, source)
        VALUES (%s, %s, %s, %s, 10, 850, 8, 5, 'test')
        ON CONFLICT DO NOTHING
    """, (pid, lid, sid, tid))

    boot_data = golden_boot(limit=100)
    assert len(boot_data) >= 1
    saka_boot = next((r for r in boot_data if r["player_name"] == "Bukayo Saka"), None)
    assert saka_boot is not None
    assert saka_boot["goals"] >= 1

    ballon_data = ballon_dor(limit=100)
    assert len(ballon_data) >= 1
    saka_ballon = next((r for r in ballon_data if r["player_name"] == "Bukayo Saka"), None)
    assert saka_ballon is not None
    assert "composite_rating" in saka_ballon


if __name__ == "__main__":
    print("Running setup_module...")
    setup_module()
    print("Running test_model_registration...")
    test_model_registration()
    print("Running test_prediction_inference_service...")
    test_prediction_inference_service()
    print("Running test_predictions_api_endpoints...")
    test_predictions_api_endpoints()
    print("Running test_standings_computation...")
    test_standings_computation()
    print("Running test_rankings_api...")
    test_rankings_api()
    print("All tests passed successfully!")
