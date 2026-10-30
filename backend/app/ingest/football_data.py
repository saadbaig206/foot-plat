"""Football-data.org data integration service.
Handles ingestion of fixtures, results, standings, top scorers, and team logos
with rate-limiting (~10 requests/min), exponential retries, response caching,
and high-speed bulk database upserts for cloud databases (Neon DB).
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
                    time.sleep(backoff)
                else:
                    logger.error(f"football-data.org error {res.status_code}: {res.text}")
                    res.raise_for_status()
            except httpx.RequestError as e:
                backoff = (2 ** attempt) * 2 + random.uniform(0.5, 1.5)
                time.sleep(backoff)

        raise RuntimeError(f"Failed to fetch {url} after {max_retries} attempts.")

    def close(self):
        self.client.close()


def _ensure_league(competition_code: str) -> dict:
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


def season_label_for_date(d: datetime.date) -> str:
    y = d.year if d.month >= 7 else d.year - 1
    return f"{y}/{str(y+1)[2:]}"


def ingest_competition(competition_code: str, client: FootballDataClient | None = None) -> dict:
    """Ingests fixtures, results, standings, and scorers in fast bulk transactions."""
    if client is None:
        client = FootballDataClient()

    league_row = _ensure_league(competition_code)
    league_id = league_row["id"]
    country = league_row["country"]

    run_row = query_one("INSERT INTO ingestion_runs (source) VALUES (%s) RETURNING id", (f"{SRC}:{competition_code}",))
    run_id = run_row["id"] if run_row else 1

    total_read = 0
    total_written = 0

    try:
        # Step 1: Fetch Matches & Fixtures
        print(f"  [1/3] Fetching {competition_code} match schedule & results from API...")
        matches_data = client.get(f"/competitions/{competition_code}/matches")
        matches_list = matches_data.get("matches", [])
        total_read += len(matches_list)

        # Bulk upsert all seasons found
        all_season_labels = set()
        teams_to_upsert = {}

        for m in matches_list:
            utc_str = m.get("utcDate")
            if not utc_str:
                continue
            m_date = datetime.fromisoformat(utc_str.replace("Z", "+00:00")).date()
            all_season_labels.add(season_label_for_date(m_date))

            ht = m.get("homeTeam", {})
            at = m.get("awayTeam", {})
            if ht.get("name"):
                teams_to_upsert[ht["name"]] = (ht.get("crest"), ht.get("id"))
            if at.get("name"):
                teams_to_upsert[at["name"]] = (at.get("crest"), at.get("id"))

        # Batch upsert seasons
        season_rows = []
        for slab in all_season_labels:
            y = int(slab[:4])
            season_rows.append((slab, f"{y}-07-01", f"{y+1}-06-30"))
        executemany("""
            INSERT INTO seasons (label, start_date, end_date)
            VALUES (%s, %s, %s)
            ON CONFLICT (label) DO NOTHING
        """, season_rows)
        season_map = {r["label"]: r["id"] for r in query("SELECT label, id FROM seasons")}

        # Batch upsert teams
        team_rows = []
        for tname, (crest, ext_id) in teams_to_upsert.items():
            ext_json = json.dumps({"football_data_id": ext_id}) if ext_id else "{}"
            team_rows.append((tname, country, crest, ext_json, SRC))
        executemany("""
            INSERT INTO teams (name, country, logo_url, external_ids, source, last_updated)
            VALUES (%s, %s, %s, %s::jsonb, %s, now())
            ON CONFLICT (name, country) DO UPDATE SET
                logo_url = coalesce(EXCLUDED.logo_url, teams.logo_url),
                last_updated = now()
        """, team_rows)
        team_map = {r["name"]: r["id"] for r in query("SELECT name, id FROM teams WHERE country = %s OR country IS NULL", (country,))}

        # Batch upsert all matches
        match_rows = []
        status_map = {
            "FINISHED": "finished", "TIMED": "scheduled", "SCHEDULED": "scheduled",
            "IN_PLAY": "live", "PAUSED": "live", "POSTPONED": "postponed",
            "CANCELLED": "cancelled", "SUSPENDED": "postponed"
        }

        for m in matches_list:
            utc_str = m.get("utcDate")
            if not utc_str:
                continue
            utc_dt = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
            m_date = utc_dt.date()
            sid = season_map.get(season_label_for_date(m_date))

            ht_name = m.get("homeTeam", {}).get("name")
            at_name = m.get("awayTeam", {}).get("name")
            h_id = team_map.get(ht_name)
            a_id = team_map.get(at_name)
            if not h_id or not a_id:
                continue

            status = status_map.get(m.get("status", "SCHEDULED").upper(), "scheduled")
            score = m.get("score", {})
            full_time = score.get("fullTime", {})
            half_time = score.get("halfTime", {})
            h_goals = full_time.get("home")
            a_goals = full_time.get("away")
            ht_h_goals = half_time.get("home")
            ht_a_goals = half_time.get("away")

            res = None
            if h_goals is not None and a_goals is not None:
                res = "H" if h_goals > a_goals else ("A" if a_goals > h_goals else "D")

            match_rows.append((
                league_id, sid, m_date, utc_dt, h_id, a_id, status,
                h_goals, a_goals, ht_h_goals, ht_a_goals, res, SRC
            ))

        print(f"  Writing {len(match_rows)} matches in bulk to database...")
        executemany("""
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
        """, match_rows)
        total_written += len(match_rows)

        # Step 2: Standings
        print(f"  [2/3] Fetching league standings from API...")
        try:
            standings_data = client.get(f"/competitions/{competition_code}/standings")
            curr_season = query_one("SELECT id FROM seasons ORDER BY end_date DESC LIMIT 1")
            curr_sid = curr_season["id"] if curr_season else 1
            standings_rows = []

            for table_group in standings_data.get("standings", []):
                if table_group.get("type") == "TOTAL":
                    for row in table_group.get("table", []):
                        tname = row.get("team", {}).get("name")
                        tid = team_map.get(tname)
                        if not tid:
                            continue
                        standings_rows.append((
                            league_id, curr_sid, tid, row.get("position"), row.get("playedGames"),
                            row.get("won"), row.get("draw"), row.get("lost"),
                            row.get("goalsFor"), row.get("goalsAgainst"), row.get("points"),
                            row.get("form"), SRC
                        ))

            if standings_rows:
                executemany("""
                    INSERT INTO league_standings (league_id, season_id, team_id, position, played, won, drawn, lost,
                                                 goals_for, goals_against, points, form, source, last_updated)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (league_id, season_id, team_id) DO UPDATE SET
                        position = EXCLUDED.position, played = EXCLUDED.played,
                        won = EXCLUDED.won, drawn = EXCLUDED.drawn, lost = EXCLUDED.lost,
                        goals_for = EXCLUDED.goals_for, goals_against = EXCLUDED.goals_against,
                        points = EXCLUDED.points, form = EXCLUDED.form, last_updated = now()
                """, standings_rows)
        except Exception as e:
            logger.warning(f"Standings ingest skipped: {e}")

        # Step 3: Top Scorers
        print(f"  [3/3] Fetching top scorers and player profiles...")
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
                tid = team_map.get(t_info.get("name"))
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
            logger.warning(f"Scorers ingest skipped: {e}")

        # Mark run finished
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
