from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)


def test_health():
    r = c.get("/api/health"); assert r.status_code == 200 and r.json()["database"] == "up"


def test_models_status_reports_no_models_honestly():
    j = c.get("/api/models/status").json()
    assert j["ready_for_predictions"] is False and j["models_active"] == 0


def test_leagues_and_seasons():
    assert any(l["code"] == "E0" for l in c.get("/api/leagues").json())
    assert c.get("/api/seasons").json()[0]["label"] >= "2025/26"


def test_results_filters():
    r = c.get("/api/results", params={"league": "SP1", "limit": 5}).json()
    assert len(r) == 5 and all(x["league_code"] == "SP1" and x["status"] == "finished" for x in r)
    assert r[0]["match_date"] >= r[-1]["match_date"]
    team = r[0]["home_team_id"]
    t = c.get("/api/results", params={"team_id": team, "limit": 10}).json()
    assert all(team in (x["home_team_id"], x["away_team_id"]) for x in t)


def test_fixtures_empty_until_feed_connected():
    assert c.get("/api/fixtures").json() == []


def test_404_and_validation():
    assert c.get("/api/teams/99999999").status_code == 404
    assert c.get("/api/results", params={"limit": 0}).status_code == 422


def test_last_updated():
    j = c.get("/api/data/last-updated").json()
    assert j["latest_result_date"] is not None


def test_summary_matches_database():
    j = c.get("/api/stats/summary").json()
    assert j["matches"] > 180000 and 2.4 < float(j["goals_per_match"]) < 3.0
    s = c.get("/api/stats/summary", params={"season": "2024/25"}).json()
    assert 0 < s["matches"] < j["matches"]
