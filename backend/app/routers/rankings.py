"""Player rankings router (/api/rankings/*) — Phase 5.
Computes Golden Boot and Ballon d'Or / Player of the Season rankings.
"""
from fastapi import APIRouter, Query
from ..db import query

router = APIRouter(prefix="/api/rankings", tags=["rankings"])


@router.get("/golden-boot")
def golden_boot(
    league: str | None = None,
    season: str | None = None,
    limit: int = Query(25, ge=1, le=100)
):
    """Golden Boot top scorer rankings."""
    limit_val = int(limit) if isinstance(limit, (int, str)) else (getattr(limit, "default", 25) or 25)
    where_clauses = ["ps.goals > 0"]
    params = {"limit": limit_val}

    if league:
        where_clauses.append("l.code = %(league)s")
        params["league"] = league
    if season:
        where_clauses.append("se.label = %(season)s")
        params["season"] = season

    where_sql = " AND ".join(where_clauses)
    sql = f"""
        SELECT p.id AS player_id, p.name AS player_name, p.nationality, p.position, p.photo_url,
               t.id AS team_id, t.name AS team_name, t.logo_url AS team_logo,
               l.code AS league_code, l.name AS league_name,
               se.label AS season,
               ps.appearances, ps.minutes, ps.goals, ps.assists,
               (ps.goals + coalesce(ps.assists, 0)) AS total_contributions,
               round(CASE WHEN ps.goals > 0 AND ps.minutes > 0 THEN (ps.minutes::numeric / ps.goals) ELSE NULL END, 1) AS minutes_per_goal
        FROM player_stats ps
        JOIN players p ON p.id = ps.player_id
        LEFT JOIN teams t ON t.id = ps.team_id
        JOIN leagues l ON l.id = ps.league_id
        JOIN seasons se ON se.id = ps.season_id
        WHERE {where_sql}
        ORDER BY ps.goals DESC, ps.assists DESC NULLS LAST, ps.minutes ASC NULLS LAST
        LIMIT %(limit)s
    """
    rows = query(sql, params)
    for idx, r in enumerate(rows, start=1):
        r["rank"] = idx
    return rows


@router.get("/ballon-dor")
def ballon_dor(
    season: str | None = None,
    limit: int = Query(25, ge=1, le=100)
):
    """Ballon d'Or composite player rankings based on individual & team performance."""
    limit_val = int(limit) if isinstance(limit, (int, str)) else (getattr(limit, "default", 25) or 25)
    params = {"limit": limit_val}
    where_season = ""
    if season:
        where_season = "AND se.label = %(season)s"
        params["season"] = season

    sql = f"""
        SELECT p.id AS player_id, p.name AS player_name, p.nationality, p.position, p.photo_url,
               t.id AS team_id, t.name AS team_name, t.logo_url AS team_logo,
               l.name AS league_name, se.label AS season,
               ps.appearances, ps.minutes, ps.goals, ps.assists,
               coalesce(ls.points, 0) AS team_points,
               coalesce(ls.position, 10) AS team_league_position,
               round(
                   (
                       (ps.goals * 4.0) +
                       (coalesce(ps.assists, 0) * 2.5) +
                       (coalesce(ps.appearances, 0) * 0.8) +
                       (CASE WHEN ls.position = 1 THEN 20.0
                             WHEN ls.position = 2 THEN 14.0
                             WHEN ls.position = 3 THEN 10.0
                             WHEN ls.position <= 5 THEN 6.0
                             ELSE 0.0 END)
                   )::numeric, 1
               ) AS composite_rating
        FROM player_stats ps
        JOIN players p ON p.id = ps.player_id
        LEFT JOIN teams t ON t.id = ps.team_id
        JOIN leagues l ON l.id = ps.league_id
        JOIN seasons se ON se.id = ps.season_id
        LEFT JOIN league_standings ls ON ls.team_id = t.id AND ls.season_id = se.id
        WHERE ps.appearances > 3 {where_season}
        ORDER BY composite_rating DESC, ps.goals DESC
        LIMIT %(limit)s
    """
    rows = query(sql, params)
    for idx, r in enumerate(rows, start=1):
        r["rank"] = idx
    return rows
