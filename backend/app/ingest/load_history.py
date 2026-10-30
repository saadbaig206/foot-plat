"""Load the Club-Football-Match-Data CSVs (MIT, Football-Data.co.uk + ClubElo) into Postgres.

Idempotent: re-running upserts on the matches unique key, so no duplicates.
Usage: python -m app.ingest.load_history /path/to/data
"""
import sys
from pathlib import Path
import pandas as pd
import psycopg
from ..config import get_settings

SRC = "club-football-match-data (Football-Data.co.uk/ClubElo, MIT)"
# Division code -> (name, country, tier). Only divisions present after stale-league filtering.
LEAGUES = {
    "E0": ("Premier League", "England", 1), "E1": ("Championship", "England", 2),
    "E2": ("League One", "England", 3), "E3": ("League Two", "England", 4), "EC": ("National League", "England", 5),
    "SP1": ("La Liga", "Spain", 1), "SP2": ("La Liga 2", "Spain", 2),
    "D1": ("Bundesliga", "Germany", 1), "D2": ("2. Bundesliga", "Germany", 2),
    "I1": ("Serie A", "Italy", 1), "I2": ("Serie B", "Italy", 2),
    "F1": ("Ligue 1", "France", 1), "F2": ("Ligue 2", "France", 2),
    "N1": ("Eredivisie", "Netherlands", 1), "B1": ("Pro League", "Belgium", 1),
    "P1": ("Primeira Liga", "Portugal", 1), "T1": ("Super Lig", "Turkey", 1), "G1": ("Super League", "Greece", 1),
    "SC0": ("Scottish Premiership", "Scotland", 1), "SC1": ("Scottish Championship", "Scotland", 2),
    "SC2": ("Scottish League One", "Scotland", 3), "SC3": ("Scottish League Two", "Scotland", 4),
}
STALE = {'ARG','BRA','CHN','DEN','FIN','IRL','JAP','MEX','NOR','POL','ROM','RUS','SUI','SWE','USA','AUT'}


def season_label(d: pd.Timestamp) -> str:
    y = d.year if d.month >= 7 else d.year - 1
    return f"{y}/{str(y + 1)[2:]}"


def n(v):
    return None if pd.isna(v) else v


def main(data_dir: str):
    df = pd.read_csv(Path(data_dir) / "Matches.csv", parse_dates=["MatchDate"], low_memory=False)
    df = df[~df.Division.isin(STALE)].dropna(subset=["MatchDate", "FTResult"])  # no label/date -> unusable
    df = df[df.Division.isin(LEAGUES)].copy()
    df["season"] = df.MatchDate.map(season_label)
    with psycopg.connect(get_settings().database_url) as c:
        run = c.execute("INSERT INTO ingestion_runs(source,rows_read) VALUES (%s,%s) RETURNING id", (SRC, len(df))).fetchone()[0]
        for code, (name, country, tier) in LEAGUES.items():
            c.execute("""INSERT INTO leagues(code,name,country,tier,source) VALUES (%s,%s,%s,%s,%s)
                         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, last_updated=now()""", (code, name, country, tier, SRC))
        for lab in sorted(df.season.unique()):
            y = int(lab[:4])
            c.execute("INSERT INTO seasons(label,start_date,end_date) VALUES (%s,%s,%s) ON CONFLICT (label) DO NOTHING",
                      (lab, f"{y}-07-01", f"{y+1}-06-30"))
        lid = {r[0]: r[1] for r in c.execute("SELECT code,id FROM leagues")}
        sid = {r[0]: r[1] for r in c.execute("SELECT label,id FROM seasons")}
        # teams: a club name appears under one country (via its division)
        tdf = pd.concat([df[["HomeTeam", "Division"]].rename(columns={"HomeTeam": "t"}),
                         df[["AwayTeam", "Division"]].rename(columns={"AwayTeam": "t"})])
        tdf["country"] = tdf.Division.map(lambda d: LEAGUES[d][1])
        tdf = tdf.groupby("t").country.agg(lambda s: s.mode().iat[0]).reset_index()
        with c.cursor() as cur:
            cur.executemany("INSERT INTO teams(name,country,source) VALUES (%s,%s,%s) ON CONFLICT (name,country) DO NOTHING",
                            [(r.t, r.country, SRC) for r in tdf.itertuples()])
        tid = {(r[0], r[1]): r[2] for r in c.execute("SELECT name,country,id FROM teams")}
        rows = []
        for r in df.itertuples():
            ctry = LEAGUES[r.Division][1]
            h, a = tid.get((r.HomeTeam, ctry)), tid.get((r.AwayTeam, ctry))
            if h is None or a is None:  # cross-country club: fall back to any team with that name
                h = h or next(v for (nm, _), v in tid.items() if nm == r.HomeTeam)
                a = a or next(v for (nm, _), v in tid.items() if nm == r.AwayTeam)
            rows.append((lid[r.Division], sid[r.season], r.MatchDate.date(), h, a, "finished",
                         int(r.FTHome), int(r.FTAway), n(r.HTHome), n(r.HTAway), r.FTResult,
                         n(r.HomeElo), n(r.AwayElo), n(r.Form3Home), n(r.Form5Home), n(r.Form3Away), n(r.Form5Away),
                         n(r.OddHome), n(r.OddDraw), n(r.OddAway), SRC))
        with c.cursor() as cur:
            cur.executemany("""INSERT INTO matches(league_id,season_id,match_date,home_team_id,away_team_id,status,
                  home_goals,away_goals,ht_home_goals,ht_away_goals,result,home_elo,away_elo,form3_home,form5_home,
                  form3_away,form5_away,odd_home,odd_draw,odd_away,source)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (league_id,match_date,home_team_id,away_team_id) DO NOTHING""", rows)
        written = c.execute("SELECT count(*) FROM matches").fetchone()[0]
        c.execute("UPDATE ingestion_runs SET finished_at=now(), status='ok', rows_written=%s WHERE id=%s", (written, run))
    print(f"read {len(df):,} rows; matches table now holds {written:,}")


if __name__ == "__main__":
    main(sys.argv[1])
