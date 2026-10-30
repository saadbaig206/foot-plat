from datetime import date
from typing import Literal
from fastapi import APIRouter, HTTPException, Query
from ..db import query, query_one

router = APIRouter(prefix="/api", tags=["football"])


@router.get("/leagues")
def leagues():
    return query("""SELECT l.id, l.code, l.name, l.country, l.tier, l.kind,
                           count(m.id) AS matches, min(m.match_date) AS first_match, max(m.match_date) AS last_match
                    FROM leagues l LEFT JOIN matches m ON m.league_id = l.id
                    GROUP BY l.id ORDER BY l.country NULLS LAST, l.tier NULLS LAST, l.name""")


@router.get("/seasons")
def seasons():
    return query("SELECT id, label, start_date, end_date FROM seasons ORDER BY start_date DESC")


@router.get("/teams")
def teams(q: str | None = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return query("""SELECT id, name, short_name, country, logo_url FROM teams
                    WHERE (%(q)s::text IS NULL OR name ILIKE '%%' || %(q)s || '%%')
                    ORDER BY name LIMIT %(l)s OFFSET %(o)s""", {"q": q, "l": limit, "o": offset})


@router.get("/teams/{team_id}")
def team(team_id: int):
    row = query_one("SELECT id, name, short_name, country, logo_url, last_updated FROM teams WHERE id=%s", (team_id,))
    if not row:
        raise HTTPException(404, "team not found")
    return row


def _matches(status_sql: str, league: str | None, team_id: int | None, date_from: date | None,
             date_to: date | None, limit: int, order: str):
    return query(f"""
        SELECT m.id, l.code AS league_code, l.name AS league, m.match_date, m.kickoff_utc, m.status,
               m.home_team_id, ht.name AS home_team, ht.logo_url AS home_logo,
               m.away_team_id, at.name AS away_team, at.logo_url AS away_logo,
               m.home_goals, m.away_goals, m.result, m.source, m.last_updated
        FROM matches m
        JOIN leagues l ON l.id = m.league_id
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE {status_sql}
          AND (%(league)s::text IS NULL OR l.code = %(league)s)
          AND (%(team)s::int IS NULL OR m.home_team_id = %(team)s OR m.away_team_id = %(team)s)
          AND (%(df)s::date IS NULL OR m.match_date >= %(df)s)
          AND (%(dt)s::date IS NULL OR m.match_date <= %(dt)s)
        ORDER BY m.match_date {order}, m.id LIMIT %(limit)s""",
        {"league": league, "team": team_id, "df": date_from, "dt": date_to, "limit": limit})


@router.get("/fixtures")
def fixtures(league: str | None = None, team_id: int | None = None, date_from: date | None = None,
             date_to: date | None = None, limit: int = Query(50, ge=1, le=500)):
    return _matches("m.status IN ('scheduled','live','postponed')", league, team_id, date_from, date_to, limit, "ASC")


@router.get("/results")
def results(league: str | None = None, team_id: int | None = None, date_from: date | None = None,
            date_to: date | None = None, limit: int = Query(50, ge=1, le=500)):
    return _matches("m.status = 'finished'", league, team_id, date_from, date_to, limit, "DESC")


@router.get("/matches/{match_id}")
def match(match_id: int):
    rows = query(
        """SELECT m.*, l.name AS league, ht.name AS home_team, at.name AS away_team, s.*
           FROM matches m JOIN leagues l ON l.id=m.league_id
           JOIN teams ht ON ht.id=m.home_team_id JOIN teams at ON at.id=m.away_team_id
           LEFT JOIN match_stats s ON s.match_id=m.id WHERE m.id=%s""", (match_id,))
    if not rows:
        raise HTTPException(404, "match not found")
    return rows[0]


@router.get("/standings")
def standings(league: str, season: str):
    rows = query("""SELECT s.position, t.id AS team_id, t.name AS team, t.logo_url, s.played, s.won, s.drawn, s.lost,
                           s.goals_for, s.goals_against, s.goals_for - s.goals_against AS goal_difference,
                           s.points, s.form, s.last_updated
                    FROM league_standings s JOIN leagues l ON l.id=s.league_id
                    JOIN seasons se ON se.id=s.season_id JOIN teams t ON t.id=s.team_id
                    WHERE l.code=%s AND se.label=%s ORDER BY s.position""", (league, season))
    return rows


@router.get("/players")
def players(q: str | None = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return query("""SELECT id, name, nationality, position, photo_url, current_team_id FROM players
                    WHERE (%(q)s::text IS NULL OR name ILIKE '%%' || %(q)s || '%%')
                    ORDER BY name LIMIT %(l)s OFFSET %(o)s""", {"q": q, "l": limit, "o": offset})


@router.get("/players/{player_id}")
def player(player_id: int):
    row = query_one("SELECT * FROM players WHERE id=%s", (player_id,))
    if not row:
        raise HTTPException(404, "player not found")
    return row


@router.get("/stats/summary")
def stats_summary(season: str | None = None):
    """Headline numbers for the Overview page, computed from stored finished matches."""
    return query_one("""
        SELECT count(*) AS matches, coalesce(sum(home_goals + away_goals), 0) AS goals,
               round(avg(home_goals + away_goals)::numeric, 2) AS goals_per_match,
               count(DISTINCT m.league_id) AS leagues, max(m.match_date) AS latest_result_date
        FROM matches m LEFT JOIN seasons s ON s.id = m.season_id
        WHERE m.status = 'finished' AND (%(s)s::text IS NULL OR s.label = %(s)s)""", {"s": season})
