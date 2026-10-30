"""Export clean CSV extracts for Tableau Desktop / Tableau Public dashboards.
Usage: python -m scripts.export_tableau_data [--out ../data/tableau]
"""
import argparse
import os
from pathlib import Path
import pandas as pd
from app.db import query


def export_all(out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Exporting Tableau CSV extracts to {out_dir.resolve()}...")

    # 1. Overview Extract
    sql_overview = """
        SELECT l.id AS league_id, l.code AS league_code, l.name AS league_name, l.country, l.tier,
               s.id AS season_id, s.label AS season_label,
               count(m.id) AS total_matches,
               sum(CASE WHEN m.status = 'finished' THEN 1 ELSE 0 END) AS finished_matches,
               sum(CASE WHEN m.status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_matches,
               coalesce(sum(m.home_goals + m.away_goals), 0) AS total_goals,
               round(coalesce(avg(m.home_goals + m.away_goals)::numeric, 0), 2) AS avg_goals_per_match,
               round(coalesce(avg(m.home_goals)::numeric, 0), 2) AS avg_home_goals,
               round(coalesce(avg(m.away_goals)::numeric, 0), 2) AS avg_away_goals,
               count(DISTINCT m.home_team_id) AS total_teams
        FROM leagues l
        CROSS JOIN seasons s
        LEFT JOIN matches m ON m.league_id = l.id AND m.season_id = s.id
        GROUP BY l.id, l.code, l.name, l.country, l.tier, s.id, s.label
        HAVING count(m.id) > 0
        ORDER BY l.tier NULLS LAST, l.country, s.label DESC
    """
    rows_overview = query(sql_overview)
    df_overview = pd.DataFrame(rows_overview)
    df_overview.to_csv(out_dir / "tableau_overview.csv", index=False)
    print(f"  -> tableau_overview.csv ({len(df_overview):,} rows)")

    # 2. Standings Extract
    sql_standings = """
        SELECT l.code AS league_code, l.name AS league_name, l.country, l.tier,
               se.label AS season, s.position, t.name AS team, t.logo_url,
               s.played, s.won, s.drawn, s.lost, s.goals_for, s.goals_against,
               (s.goals_for - s.goals_against) AS goal_difference,
               s.points,
               round(CASE WHEN s.played > 0 THEN (s.points::numeric / s.played) ELSE 0 END, 2) AS points_per_match,
               s.form
        FROM league_standings s
        JOIN leagues l ON l.id = s.league_id
        JOIN seasons se ON se.id = s.season_id
        JOIN teams t ON t.id = s.team_id
        ORDER BY l.code, se.label DESC, s.position ASC
    """
    rows_standings = query(sql_standings)
    df_standings = pd.DataFrame(rows_standings)
    df_standings.to_csv(out_dir / "tableau_standings.csv", index=False)
    print(f"  -> tableau_standings.csv ({len(df_standings):,} rows)")

    # 3. Fixtures & Results Extract
    sql_matches = """
        SELECT m.id AS match_id, l.code AS league_code, l.name AS league_name, l.country,
               se.label AS season, m.match_date, m.status,
               ht.name AS home_team, at.name AS away_team,
               m.home_goals, m.away_goals,
               (m.home_goals + m.away_goals) AS total_goals,
               m.result,
               m.home_elo, m.away_elo,
               (m.home_elo - m.away_elo) AS elo_diff,
               m.odd_home, m.odd_draw, m.odd_away,
               round((1.0 / nullif(m.odd_home, 0))::numeric, 4) AS implied_prob_home,
               round((1.0 / nullif(m.odd_draw, 0))::numeric, 4) AS implied_prob_draw,
               round((1.0 / nullif(m.odd_away, 0))::numeric, 4) AS implied_prob_away
        FROM matches m
        JOIN leagues l ON l.id = m.league_id
        LEFT JOIN seasons se ON se.id = m.season_id
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        ORDER BY m.match_date DESC, m.id DESC
    """
    rows_matches = query(sql_matches)
    df_matches = pd.DataFrame(rows_matches)
    df_matches.to_csv(out_dir / "tableau_fixtures_results.csv", index=False)
    print(f"  -> tableau_fixtures_results.csv ({len(df_matches):,} rows)")

    # 4. Match Stats Extract
    sql_stats = """
        SELECT m.id AS match_id, l.code AS league_code, l.name AS league_name, m.match_date,
               ht.name AS home_team, at.name AS away_team,
               m.home_goals, m.away_goals,
               ms.home_shots, ms.away_shots,
               ms.home_shots_on_target, ms.away_shots_on_target,
               ms.home_corners, ms.away_corners,
               ms.home_fouls, ms.away_fouls,
               ms.home_yellow, ms.away_yellow,
               ms.home_red, ms.away_red,
               ms.home_possession, ms.away_possession,
               ms.home_xg, ms.away_xg
        FROM match_stats ms
        JOIN matches m ON m.id = ms.match_id
        JOIN leagues l ON l.id = m.league_id
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        ORDER BY m.match_date DESC
    """
    rows_stats = query(sql_stats)
    df_stats = pd.DataFrame(rows_stats)
    df_stats.to_csv(out_dir / "tableau_match_stats.csv", index=False)
    print(f"  -> tableau_match_stats.csv ({len(df_stats):,} rows)")

    # 5. Team Performance Extract
    sql_perf = """
        SELECT t.name AS team, l.code AS league_code, l.name AS league_name, se.label AS season,
               tp.home_played, tp.home_won, tp.home_drawn, tp.home_lost, tp.home_gf, tp.home_ga,
               tp.away_played, tp.away_won, tp.away_drawn, tp.away_lost, tp.away_gf, tp.away_ga,
               (tp.home_played + tp.away_played) AS total_played,
               (tp.home_won + tp.away_won) AS total_won,
               (tp.home_drawn + tp.away_drawn) AS total_drawn,
               (tp.home_lost + tp.away_lost) AS total_lost,
               (tp.home_gf + tp.away_gf) AS total_gf,
               (tp.home_ga + tp.away_ga) AS total_ga,
               ((tp.home_gf + tp.away_gf) - (tp.home_ga + tp.away_ga)) AS total_gd,
               ((tp.home_won + tp.away_won) * 3 + (tp.home_drawn + tp.away_drawn)) AS total_pts,
               round((CASE WHEN (tp.home_played + tp.away_played) > 0
                     THEN (tp.home_won + tp.away_won)::numeric / (tp.home_played + tp.away_played) * 100
                     ELSE 0 END), 1) AS overall_win_rate_pct,
               round((CASE WHEN tp.home_played > 0 THEN tp.home_won::numeric / tp.home_played * 100 ELSE 0 END), 1) AS home_win_rate_pct,
               round((CASE WHEN tp.away_played > 0 THEN tp.away_won::numeric / tp.away_played * 100 ELSE 0 END), 1) AS away_win_rate_pct
        FROM team_performance tp
        JOIN teams t ON t.id = tp.team_id
        JOIN leagues l ON l.id = tp.league_id
        JOIN seasons se ON se.id = tp.season_id
        ORDER BY l.code, se.label DESC, total_pts DESC
    """
    rows_perf = query(sql_perf)
    df_perf = pd.DataFrame(rows_perf)
    df_perf.to_csv(out_dir / "tableau_team_performance.csv", index=False)
    print(f"  -> tableau_team_performance.csv ({len(df_perf):,} rows)")

    # 6. Player Stats Extract
    sql_players = """
        SELECT p.name AS player_name, p.nationality, p.position,
               t.name AS team, l.code AS league_code, l.name AS league_name, se.label AS season,
               ps.appearances, ps.minutes, ps.goals, ps.assists,
               (ps.goals + ps.assists) AS goal_contributions,
               round(CASE WHEN ps.goals > 0 AND ps.minutes > 0 THEN (ps.minutes::numeric / ps.goals) ELSE NULL END, 1) AS mins_per_goal
        FROM player_stats ps
        JOIN players p ON p.id = ps.player_id
        LEFT JOIN teams t ON t.id = ps.team_id
        JOIN leagues l ON l.id = ps.league_id
        JOIN seasons se ON se.id = ps.season_id
        ORDER BY ps.goals DESC NULLS LAST, ps.assists DESC NULLS LAST
    """
    rows_players = query(sql_players)
    df_players = pd.DataFrame(rows_players)
    df_players.to_csv(out_dir / "tableau_player_stats.csv", index=False)
    print(f"  -> tableau_player_stats.csv ({len(df_players):,} rows)")

    # 7. Important Matches Extract (derbies, clashes, major upsets, high-scoring)
    sql_important = """
        SELECT m.id AS match_id, l.code AS league_code, l.name AS league_name, se.label AS season,
               m.match_date, ht.name AS home_team, at.name AS away_team,
               m.home_goals, m.away_goals, m.result,
               m.home_elo, m.away_elo,
               (coalesce(m.home_elo, 0) + coalesce(m.away_elo, 0)) AS combined_elo,
               abs(coalesce(m.home_elo, 0) - coalesce(m.away_elo, 0)) AS elo_gap,
               m.odd_home, m.odd_draw, m.odd_away,
               (m.home_goals + m.away_goals) AS total_goals,
               CASE
                   WHEN (m.home_goals + m.away_goals) >= 6 THEN 'High-Scoring Thriller'
                   WHEN (m.result = 'A' AND m.odd_away >= 4.5) OR (m.result = 'H' AND m.odd_home >= 4.5) THEN 'Major Upset'
                   WHEN (coalesce(m.home_elo, 0) >= 1800 AND coalesce(m.away_elo, 0) >= 1800) THEN 'Elite Clash'
                   WHEN abs(coalesce(m.home_elo, 0) - coalesce(m.away_elo, 0)) <= 30 AND (coalesce(m.home_elo, 0) >= 1650) THEN 'Tight Derby'
                   ELSE 'Standard Match'
               END AS match_category
        FROM matches m
        JOIN leagues l ON l.id = m.league_id
        LEFT JOIN seasons se ON se.id = m.season_id
        JOIN teams ht ON ht.id = m.home_team_id
        JOIN teams at ON at.id = m.away_team_id
        WHERE m.status = 'finished'
          AND (
            (m.home_goals + m.away_goals) >= 5
            OR (m.result = 'A' AND m.odd_away >= 3.8)
            OR (m.result = 'H' AND m.odd_home >= 3.8)
            OR (coalesce(m.home_elo, 0) >= 1750 AND coalesce(m.away_elo, 0) >= 1750)
          )
        ORDER BY m.match_date DESC
        LIMIT 10000
    """
    rows_important = query(sql_important)
    df_important = pd.DataFrame(rows_important)
    df_important.to_csv(out_dir / "tableau_important_matches.csv", index=False)
    print(f"  -> tableau_important_matches.csv ({len(df_important):,} rows)")

    print("All 7 Tableau CSV extracts successfully generated!")


def main():
    parser = argparse.ArgumentParser(description="Export CSV extracts for Tableau Public dashboards.")
    parser.add_argument("--out", type=str, default="data/tableau", help="Output directory")
    args = parser.parse_args()
    export_all(Path(args.out))


if __name__ == "__main__":
    main()

