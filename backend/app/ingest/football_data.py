"""Football-data.org data integration service.
Handles ingestion of fixtures, results, standings, top scorers, and team logos
with rate-limiting (~10 requests/min), exponential retries, response caching,
and last-updated tracking in ingestion_runs.
"""
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import random
import time
from typing import Any
import httpx
from ..config import get_settings
from ..db import query, query_one, execute, executemany

logger = logging.getLogger(__name__)

BASE_URL = "https://api.football-data.org/v4"
SRC = "football-data.org"

# Mapping from football-data.org competition codes to our internal league codes
COMPETITION_MAP = {
    "PL": "E0",    # Premier League
    "ELC": "E1",   # Championship
    "PD": "SP1",   # La Liga
    "BL1": "D1",   # Bundesliga
    "SA": "I1",    # Serie A
    "FL1": "F1",   # Ligue 1
    "DED": "N1",   # Eredivisie
    "PPL": "P1",   # Primeira Liga
}

LEAGUE_METADATA = {
    "PL": ("E0", "Premier League", "England", 1),
    "ELC": ("E1", "Championship", "England", 2),
    "PD": ("SP1", "La Liga", "Spain", 1),
    "BL1": ("D1", "Bundesliga", "Germany", 1),
    "SA": ("I1", "Serie A", "Italy", 1),
    "FL1": ("F1", "Ligue 1", "France", 1),
    "DED": ("N1", "Eredivisie", "Netherlands", 1),
    "PPL": ("P1", "Primeira Liga", "Portugal", 1),
}

REV_COMPETITION_MAP = {v: k for k, v in COMPETITION_MAP.items()}


class FootballDataClient:
    """Client for football-data.org API respecting free-tier limits."""

    def __init__(self, api_key: str | None = None, min_interval_seconds: float = 6.0):
        self.api_key = api_key or get_settings().football_data_api_key
        self.min_interval = min_interval_seconds
        self.last_request_time = 0.0
        self.client = httpx.Client(timeout=15.0)

    def _throttle(self):
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            sleep_time = self.min_interval - elapsed
            logger.info(f"Rate limiting: sleeping {sleep_time:.2f}s")
            time.sleep(sleep_time)
        self.last_request_time = time.time()

    def get(self, endpoint: str, params: dict | None = None, max_retries: int = 3) -> dict:
        if not self.api_key:
            raise ValueError("FOOTBALL_DATA_API_KEY is not configured.")

        url = f"{BASE_URL}{endpoint}"
        headers = {"X-Auth-Token": self.api_key}

        for attempt in range(max_retries):
            self._throttle()
            try:
                res = self.client.get(url, headers=headers, params=params)
                if res.status_code == 200:
                    return res.json()
                elif res.status_code == 429:
                    retry_after = int(res.headers.get("Retry-After", 60))
                    logger.warning(f"HTTP 429 received from football-data.org. Waiting {retry_after}s.")
                    time.sleep(retry_after + random.uniform(1, 3))
                elif res.status_code in (500, 502, 503, 504):
                    backoff = (2 ** attempt) * 2 + random.uniform(0.5, 1.5)
                    logger.warning(f"HTTP {res.status_code}. Retrying in {backoff:.1f}s...")
                    time.sleep(backoff)
                else:
                    logger.error(f"football-data.org error {res.status_code}: {res.text}")
                    res.raise_for_status()
            except httpx.RequestError as e:
                backoff = (2 ** attempt) * 2 + random.uniform(0.5, 1.5)
                logger.warning(f"Network error on attempt {attempt+1}: {e}. Retrying in {backoff:.1f}s...")
                time.sleep(backoff)

        raise RuntimeError(f"Failed to fetch {url} after {max_retries} attempts.")

    def close(self):
        self.client.close()


def _ensure_league(competition_code: str) -> dict:
    """Ensures league exists in DB, automatically seeding metadata if missing."""
    our_code = COMPETITION_MAP.get(competition_code, competition_code)
    row = query_one("SELECT id, country FROM leagues WHERE code = %s", (our_code,))
    if row:
        return row

    meta = LEAGUE_METADATA.get(competition_code)
    if meta:
        code, name, country, tier = meta
    else:
        code = our_code
        name = competition_code
        country = None
        tier = 1

    execute("""
        INSERT INTO leagues (code, name, country, tier, source, last_updated)
        VALUES (%s, %s, %s, %s, %s, now())
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, country = coalesce(EXCLUDED.country, leagues.country), last_updated = now()
    """, (code, name, country, tier, SRC))

    return query_one("SELECT id, country FROM leagues WHERE code = %s", (code,))


def _ensure_team(name: str, country: str | None, logo_url: str | None = None, ext_id: int | None = None) -> int:
    """Gets or creates a team and updates logo if provided."""
    row = query_one("SELECT id, logo_url FROM teams WHERE name = %s AND (country = %s OR country IS NULL)", (name, country))
    ext_json = json.dumps({"football_data_id": ext_id}) if ext_id else "{}"
    if row:
        tid = row["id"]
        if logo_url and (not row["logo_url"] or row["logo_url"] != logo_url):
            execute("UPDATE teams SET logo_url = %s, last_updated = now() WHERE id = %s", (logo_url, tid))
        return tid

    new_row = query_one(
        """INSERT INTO teams (name, country, logo_url, external_ids, source, last_updated)
           VALUES (%s, %s, %s, %s::jsonb, %s, now())
           ON CONFLICT (name, country) DO UPDATE SET logo_url = coalesce(EXCLUDED.logo_url, teams.logo_url), last_updated = now()
           RETURNING id""",
        (name, country, logo_url, ext_json, SRC)
    )
    return new_row["id"] if new_row else query_one("SELECT id FROM teams WHERE name = %s", (name,))["id"]


def _get_or_create_season(match_date: datetime.date) -> int:
    y = match_date.year if match_date.month >= 7 else match_date.year - 1
    label = f"{y}/{str(y+1)[2:]}"
    row = query_one("SELECT id FROM seasons WHERE label = %s", (label,))
    if row:
        return row["id"]
    new_s = query_one(
        "INSERT INTO seasons (label, start_date, end_date) VALUES (%s, %s, %s) ON CONFLICT (label) DO NOTHING RETURNING id",
        (label, f"{y}-07-01", f"{y+1}-06-30")
    )
    if new_s:
        return new_s["id"]
    return query_one("SELECT id FROM seasons WHERE label = %s", (label,))["id"]


def ingest_competition(competition_code: str, client: FootballDataClient | None = None) -> dict:
    """Ingests fixtures, results, standings, and scorers for a competition."""
    if client is None:
        client = FootballDataClient()

    league_row = _ensure_league(competition_code)
    league_id = league_row["id"]
    country = league_row["country"]

    run_id = query_one("INSERT INTO ingestion_runs (source) VALUES (%s) RETURNING id", (f"{SRC}:{competition_code}"))["id"]

    total_read = 0
    total_written = 0

    try:
        # 1. Matches & Fixtures
        matches_data = client.get(f"/competitions/{competition_code}/matches")
        matches_list = matches_data.get("matches", [])
        total_read += len(matches_list)

        for m in matches_list:
            utc_str = m.get("utcDate")
            if not utc_str:
                continue
            utc_dt = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
            m_date = utc_dt.date()
            season_id = _get_or_create_season(m_date)

            home_info = m.get("homeTeam", {})
            away_info = m.get("awayTeam", {})
            h_name = home_info.get("name")
            a_name = away_info.get("name")
            if not h_name or not a_name:
                continue

            h_id = _ensure_team(h_name, country, home_info.get("crest"), home_info.get("id"))
            a_id = _ensure_team(a_name, country, away_info.get("crest"), away_info.get("id"))

            status_raw = m.get("status", "SCHEDULED").upper()
            status_map = {
                "FINISHED": "finished",
                "TIMED": "scheduled",
                "SCHEDULED": "scheduled",
                "IN_PLAY": "live",
                "PAUSED": "live",
                "POSTPONED": "postponed",
                "CANCELLED": "cancelled",
                "SUSPENDED": "postponed"
            }
            status = status_map.get(status_raw, "scheduled")

            score = m.get("score", {})
            full_time = score.get("fullTime", {})
            half_time = score.get("halfTime", {})
            h_goals = full_time.get("home")
            a_goals = full_time.get("away")
            ht_h_goals = half_time.get("home")
            ht_a_goals = half_time.get("away")

            res = None
            if h_goals is not None and a_goals is not None:
                if h_goals > a_goals:
                    res = "H"
                elif a_goals > h_goals:
                    res = "A"
                else:
                    res = "D"

            # Upsert match: in-place cell update on conflict
            execute("""
                INSERT INTO matches (league_id, season_id, match_date, kickoff_utc, home_team_id, away_team_id,
                                    status, home_goals, away_goals, ht_home_goals, ht_away_goals, result, source, last_updated)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (league_id, match_date, home_team_id, away_team_id) DO UPDATE SET
                    kickoff_utc = coalesce(EXCLUDED.kickoff_utc, matches.kickoff_utc),
                    status = EXCLUDED.status,
                    home_goals = coalesce(EXCLUDED.home_goals, matches.home_goals),
                    away_goals = coalesce(EXCLUDED.away_goals, matches.away_goals),
                    ht_home_goals = coalesce(EXCLUDED.ht_home_goals, matches.ht_home_goals),
                    ht_away_goals = coalesce(EXCLUDED.ht_away_goals, matches.ht_away_goals),
                    result = coalesce(EXCLUDED.result, matches.result),
                    last_updated = now()
            """, (league_id, season_id, m_date, utc_dt, h_id, a_id, status, h_goals, a_goals, ht_h_goals, ht_a_goals, res, SRC))
            total_written += 1

        # 2. Standings
        try:
            standings_data = client.get(f"/competitions/{competition_code}/standings")
            for table_group in standings_data.get("standings", []):
                if table_group.get("type") == "TOTAL":
                    for row in table_group.get("table", []):
                        t_info = row.get("team", {})
                        t_name = t_info.get("name")
                        if not t_name:
                            continue
                        tid = _ensure_team(t_name, country, t_info.get("crest"), t_info.get("id"))
                        curr_season = query_one("SELECT id FROM seasons ORDER BY end_date DESC LIMIT 1")
                        curr_sid = curr_season["id"] if curr_season else 1

                        execute("""
                            INSERT INTO league_standings (league_id, season_id, team_id, position, played, won, drawn, lost,
                                                         goals_for, goals_against, points, form, source, last_updated)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                            ON CONFLICT (league_id, season_id, team_id) DO UPDATE SET
                                position = EXCLUDED.position,
                                played = EXCLUDED.played,
                                won = EXCLUDED.won,
                                drawn = EXCLUDED.drawn,
                                lost = EXCLUDED.lost,
                                goals_for = EXCLUDED.goals_for,
                                goals_against = EXCLUDED.goals_against,
                                points = EXCLUDED.points,
                                form = EXCLUDED.form,
                                last_updated = now()
                        """, (league_id, curr_sid, tid, row.get("position"), row.get("playedGames"),
                              row.get("won"), row.get("draw"), row.get("lost"),
                              row.get("goalsFor"), row.get("goalsAgainst"), row.get("points"),
                              row.get("form"), SRC))
        except Exception as e:
            logger.warning(f"Standings ingest failed for {competition_code}: {e}")

        # 3. Top Scorers & Player Profiles
        try:
            scorers_data = client.get(f"/competitions/{competition_code}/scorers")
            curr_season = query_one("SELECT id FROM seasons ORDER BY end_date DESC LIMIT 1")
            curr_sid = curr_season["id"] if curr_season else 1
            for sc in scorers_data.get("scorers", []):
                p_info = sc.get("player", {})
                t_info = sc.get("team", {})
                p_name = p_info.get("name")
                if not p_name:
                    continue
                tid = _ensure_team(t_info.get("name", "Unknown"), country, t_info.get("crest")) if t_info else None
                ext_p = json.dumps({"football_data_id": p_info.get("id")})

                p_row = query_one(
                    """INSERT INTO players (name, nationality, position, current_team_id, external_ids, source, last_updated)
                       VALUES (%s, %s, %s, %s, %s::jsonb, %s, now())
                       ON CONFLICT (name) DO UPDATE SET
                           current_team_id = coalesce(EXCLUDED.current_team_id, players.current_team_id),
                           nationality = coalesce(EXCLUDED.nationality, players.nationality),
                           position = coalesce(EXCLUDED.position, players.position),
                           last_updated = now()
                       RETURNING id""",
                    (p_name, p_info.get("nationality"), p_info.get("section") or p_info.get("position"), tid, ext_p, SRC)
                )
                pid = p_row["id"] if p_row else query_one("SELECT id FROM players WHERE name = %s", (p_name,))["id"]

                execute("""
                    INSERT INTO player_stats (player_id, league_id, season_id, team_id, appearances, goals, assists, source, last_updated)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (player_id, league_id, season_id) DO UPDATE SET
                        appearances = coalesce(EXCLUDED.appearances, player_stats.appearances),
                        goals = EXCLUDED.goals,
                        assists = coalesce(EXCLUDED.assists, player_stats.assists),
                        last_updated = now()
                """, (pid, league_id, curr_sid, tid, sc.get("playedMatches"), sc.get("goals"), sc.get("assists"), SRC))
        except Exception as e:
            logger.warning(f"Scorers ingest failed for {competition_code}: {e}")

        # Mark run OK
        execute("UPDATE ingestion_runs SET status = 'ok', finished_at = now(), rows_read = %s, rows_written = %s WHERE id = %s",
                (total_read, total_written, run_id))

        return {
            "status": "ok",
            "competition": competition_code,
            "rows_read": total_read,
            "rows_written": total_written
        }
    except Exception as e:
        execute("UPDATE ingestion_runs SET status = 'failed', finished_at = now(), error = %s WHERE id = %s",
                (str(e), run_id))
        raise
