import sys
from pathlib import Path
import pytest
from fastapi import HTTPException

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.routers.system import health, models_status, data_last_updated
from app.routers.football import leagues, seasons, results, fixtures, teams, team, stats_summary


def test_health():
    h = health()
    assert h["status"] == "ok"
    assert h["database"] == "up"


def test_models_status_reports_honestly():
    j = models_status()
    assert "ready_for_predictions" in j
    assert "models_active" in j


def test_leagues_and_seasons():
    l_list = leagues()
    assert isinstance(l_list, list)
    if l_list:
        assert any("code" in l for l in l_list)

    s_list = seasons()
    assert isinstance(s_list, list)


def test_results_and_fixtures():
    res = results(limit=5)
    assert isinstance(res, list)

    fix = fixtures()
    assert isinstance(fix, list)


def test_404_and_validation():
    with pytest.raises(HTTPException) as exc_info:
        team(99999999)
    assert exc_info.value.status_code == 404


def test_last_updated():
    j = data_last_updated()
    assert isinstance(j, dict)


def test_summary():
    s = stats_summary()
    assert isinstance(s, dict)
    assert "matches" in s
    assert "goals" in s
