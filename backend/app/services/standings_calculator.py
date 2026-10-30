"""Standings and Team Performance calculator.
Computes league standings, form guides, and home/away team performance metrics
from stored finished matches and persists them to league_standings and team_performance.
"""
from collections import defaultdict
from datetime import datetime, timezone
import logging
from ..db import query, query_one, executemany, execute

logger = logging.getLogger(__name__)


def compute_league_standings(league_id: int | None = None, season_id: int | None = None) -> dict:
    """Computes standings and team performance for a given league/season or all leagues/seasons."""
    where_clauses = ["m.status = 'finished'", "m.home_goals IS NOT NULL", "m.away_goals IS NOT NULL"]
    params = {}
    if league_id is not None:
        where_clauses.append("m.league_id = %(lid)s")
        params["lid"] = league_id
    if season_id is not None:
        where_clauses.append("m.season_id = %(sid)s")
        params["sid"] = season_id

    where_sql = " AND ".join(where_clauses)
    sql = f"""
        SELECT m.id, m.league_id, m.season_id, m.match_date,
               m.home_team_id, ht.name AS home_name,
               m.away_team_id, at.name AS away_name,
               m.home_goals, m.away_goals, m.result
        FROM matches m
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE {where_sql}
        ORDER BY m.match_date ASC, m.id ASC
    """
    matches = query(sql, params)
    if not matches:
        return {"leagues_computed": 0, "standings_rows": 0, "performance_rows": 0}

    # Group matches by (league_id, season_id)
    groups = defaultdict(list)
    for m in matches:
        if m["season_id"] is not None:
            groups[(m["league_id"], m["season_id"])].append(m)

    standings_rows = []
    perf_rows = []

    for (lid, sid), group_matches in groups.items():
        teams_data = defaultdict(lambda: {
            "name": "",
            "home_played": 0, "home_won": 0, "home_drawn": 0, "home_lost": 0, "home_gf": 0, "home_ga": 0,
            "away_played": 0, "away_won": 0, "away_drawn": 0, "away_lost": 0, "away_gf": 0, "away_ga": 0,
            "form": []
        })

        for m in group_matches:
            hid = m["home_team_id"]
            aid = m["away_team_id"]
            hg = int(m["home_goals"])
            ag = int(m["away_goals"])
            res = m["result"]

            teams_data[hid]["name"] = m["home_name"]
            teams_data[aid]["name"] = m["away_name"]

            teams_data[hid]["home_played"] += 1
            teams_data[hid]["home_gf"] += hg
            teams_data[hid]["home_ga"] += ag

            teams_data[aid]["away_played"] += 1
            teams_data[aid]["away_gf"] += ag
            teams_data[aid]["away_ga"] += hg

            if res == "H" or hg > ag:
                teams_data[hid]["home_won"] += 1
                teams_data[aid]["away_lost"] += 1
                teams_data[hid]["form"].append("W")
                teams_data[aid]["form"].append("L")
            elif res == "A" or ag > hg:
                teams_data[hid]["home_lost"] += 1
                teams_data[aid]["away_won"] += 1
                teams_data[hid]["form"].append("L")
                teams_data[aid]["form"].append("W")
            else:
                teams_data[hid]["home_drawn"] += 1
                teams_data[aid]["away_drawn"] += 1
                teams_data[hid]["form"].append("D")
                teams_data[aid]["form"].append("D")

        # Compile summaries for sorting
        standings_list = []
        for tid, data in teams_data.items():
            played = data["home_played"] + data["away_played"]
            won = data["home_won"] + data["away_won"]
            drawn = data["home_drawn"] + data["away_drawn"]
            lost = data["home_lost"] + data["away_lost"]
            gf = data["home_gf"] + data["away_gf"]
            ga = data["home_ga"] + data["away_ga"]
            pts = (won * 3) + drawn
            gd = gf - ga
            # Last 5 matches form string (e.g. 'WWDLD')
            last5 = "".join(data["form"][-5:])

            standings_list.append({
                "team_id": tid,
                "team_name": data["name"],
                "played": played,
                "won": won,
                "drawn": drawn,
                "lost": lost,
                "gf": gf,
                "ga": ga,
                "gd": gd,
                "pts": pts,
                "form": last5,
                "data": data,
            })

        # Sort: points DESC, GD DESC, GF DESC, name ASC
        standings_list.sort(key=lambda x: (-x["pts"], -x["gd"], -x["gf"], x["team_name"]))

        for pos, item in enumerate(standings_list, start=1):
            standings_rows.append((
                lid, sid, item["team_id"], pos, item["played"], item["won"], item["drawn"], item["lost"],
                item["gf"], item["ga"], item["pts"], item["form"], "computed_from_matches"
            ))

            d = item["data"]
            perf_rows.append((
                item["team_id"], lid, sid,
                d["home_played"], d["home_won"], d["home_drawn"], d["home_lost"], d["home_gf"], d["home_ga"],
                d["away_played"], d["away_won"], d["away_drawn"], d["away_lost"], d["away_gf"], d["away_ga"]
            ))

    # Persist in DB
    if standings_rows:
        upsert_standings_sql = """
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
                source = EXCLUDED.source,
                last_updated = now()
        """
        executemany(upsert_standings_sql, standings_rows)

    if perf_rows:
        upsert_perf_sql = """
            INSERT INTO team_performance (team_id, league_id, season_id,
                                         home_played, home_won, home_drawn, home_lost, home_gf, home_ga,
                                         away_played, away_won, away_drawn, away_lost, away_gf, away_ga,
                                         last_updated)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (team_id, league_id, season_id) DO UPDATE SET
                home_played = EXCLUDED.home_played,
                home_won = EXCLUDED.home_won,
                home_drawn = EXCLUDED.home_drawn,
                home_lost = EXCLUDED.home_lost,
                home_gf = EXCLUDED.home_gf,
                home_ga = EXCLUDED.home_ga,
                away_played = EXCLUDED.away_played,
                away_won = EXCLUDED.away_won,
                away_drawn = EXCLUDED.away_drawn,
                away_lost = EXCLUDED.away_lost,
                away_gf = EXCLUDED.away_gf,
                away_ga = EXCLUDED.away_ga,
                last_updated = now()
        """
        executemany(upsert_perf_sql, perf_rows)

    return {
        "leagues_computed": len(groups),
        "standings_rows": len(standings_rows),
        "performance_rows": len(perf_rows)
    }
