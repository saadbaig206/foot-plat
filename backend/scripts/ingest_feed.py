"""CLI script for ingesting live/scheduled data from football-data.org.
Usage:
  python -m scripts.ingest_feed --competition PL
  python -m scripts.ingest_feed --all
"""
import argparse
import sys
from app.config import get_settings
from app.ingest.football_data import FootballDataClient, ingest_competition, COMPETITION_MAP


def main():
    parser = argparse.ArgumentParser(description="Ingest fixtures, results, standings from football-data.org")
    parser.add_argument("--competition", type=str, help="Competition code (e.g. PL, PD, BL1, SA, FL1)")
    parser.add_argument("--all", action="store_true", help="Ingest all mapped competitions")
    args = parser.parse_args()

    api_key = get_settings().football_data_api_key
    if not api_key:
        print("Error: FOOTBALL_DATA_API_KEY environment variable is not set in .env.")
        print("Please register a free key at https://www.football-data.org/client/register and add it to .env.")
        sys.exit(1)

    client = FootballDataClient(api_key=api_key)

    competitions = []
    if args.all:
        competitions = list(COMPETITION_MAP.keys())
    elif args.competition:
        competitions = [args.competition]
    else:
        print("Specify either --competition <CODE> (e.g. PL) or --all")
        sys.exit(1)

    print(f"Starting ingestion for {len(competitions)} competitions: {', '.join(competitions)}...")
    for code in competitions:
        try:
            print(f"Ingesting {code}...")
            res = ingest_competition(code, client=client)
            print(f"  {code} completed: read {res.get('rows_read', 0)}, written {res.get('rows_written', 0)}")
        except Exception as e:
            print(f"  Error ingesting {code}: {e}")

    client.close()
    print("Done!")


if __name__ == "__main__":
    main()
