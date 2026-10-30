"""CLI script to compute standings and team performance from stored matches.
Usage: python -m scripts.compute_standings [--league CODE] [--season LABEL]
"""
import argparse
import sys
from app.db import query_one
from app.services.standings_calculator import compute_league_standings


def main():
    parser = argparse.ArgumentParser(description="Compute league standings and team performance from match history.")
    parser.add_argument("--league", type=str, help="League code (e.g. E0, SP1)")
    parser.add_argument("--season", type=str, help="Season label (e.g. 2024/25)")
    args = parser.parse_args()

    lid = None
    sid = None
    if args.league:
        row = query_one("SELECT id FROM leagues WHERE code = %s", (args.league,))
        if not row:
            print(f"League code '{args.league}' not found.")
            sys.exit(1)
        lid = row["id"]

    if args.season:
        row = query_one("SELECT id FROM seasons WHERE label = %s", (args.season,))
        if not row:
            print(f"Season label '{args.season}' not found.")
            sys.exit(1)
        sid = row["id"]

    print("Computing standings and team performance...")
    result = compute_league_standings(league_id=lid, season_id=sid)
    print(f"Done! Leagues/seasons processed: {result['leagues_computed']}, "
          f"Standings rows: {result['standings_rows']:,}, "
          f"Performance rows: {result['performance_rows']:,}")


if __name__ == "__main__":
    main()
