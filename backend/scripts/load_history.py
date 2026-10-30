"""Load historical matches from Matches.csv into the database. Idempotent (duplicate-safe via the unique match key).
Usage: python -m scripts.load_history ../data/Matches.csv"""
import sys
import pandas as pd
from sqlalchemy import select
from app.db import Base, engine, SessionLocal
from app import models as M

NAMES = {"E0": ("English Premier League", "England", 1), "E1": ("English Championship", "England", 2), "E2": ("English League One", "England", 3),
         "E3": ("English League Two", "England", 4), "EC": ("English Conference", "England", 5), "SP1": ("Spanish La Liga", "Spain", 1),
         "SP2": ("Spanish Segunda", "Spain", 2), "D1": ("German Bundesliga", "Germany", 1), "D2": ("German 2. Bundesliga", "Germany", 2),
         "I1": ("Italian Serie A", "Italy", 1), "I2": ("Italian Serie B", "Italy", 2), "F1": ("French Ligue 1", "France", 1),
         "F2": ("French Ligue 2", "France", 2), "N1": ("Dutch Eredivisie", "Netherlands", 1), "B1": ("Belgian Pro League", "Belgium", 1),
         "P1": ("Portuguese Primeira Liga", "Portugal", 1), "T1": ("Turkish Super Lig", "Turkey", 1), "G1": ("Greek Super League", "Greece", 1),
         "SC0": ("Scottish Premiership", "Scotland", 1), "SC1": ("Scottish Championship", "Scotland", 2), "SC2": ("Scottish League One", "Scotland", 3),
         "SC3": ("Scottish League Two", "Scotland", 4)}
NN = lambda v: None if pd.isna(v) else float(v)


def season_label(d):
    y = d.year if d.month >= 7 else d.year - 1
    return f"{y}/{str(y + 1)[2:]}"


def main(path):
    Base.metadata.create_all(engine)
    df = pd.read_csv(path, parse_dates=["MatchDate"]).dropna(subset=["MatchDate", "FTResult", "FTHome", "FTAway"])
    df = df[df.Division.isin(NAMES)]
    with SessionLocal() as db:
        leagues = {l.code: l for l in db.scalars(select(M.League))}
        for c, (n, ctry, tier) in NAMES.items():
            if c not in leagues:
                leagues[c] = M.League(code=c, name=n, country=ctry, tier=tier, source="football-data.co.uk"); db.add(leagues[c])
        teams = {t.name: t for t in db.scalars(select(M.Team))}
        for n in set(df.HomeTeam) | set(df.AwayTeam):
            if n not in teams:
                teams[n] = M.Team(name=n, source="football-data.co.uk"); db.add(teams[n])
        seasons = {s.label: s for s in db.scalars(select(M.Season))}
        for d in df.MatchDate.dt.date.unique():
            l = season_label(d)
            if l not in seasons:
                y = int(l[:4]); seasons[l] = M.Season(label=l, start_date=pd.Timestamp(y, 7, 1).date(), end_date=pd.Timestamp(y + 1, 6, 30).date(), source="derived"); db.add(seasons[l])
        db.flush()
        existing = set(db.execute(select(M.Match.league_id, M.Match.match_date, M.Match.home_team_id, M.Match.away_team_id)).all())
        new = []
        for r in df.itertuples(index=False):
            d = r.MatchDate.date(); key = (leagues[r.Division].id, d, teams[r.HomeTeam].id, teams[r.AwayTeam].id)
            if key in existing:
                continue
            existing.add(key)
            new.append(M.Match(league_id=key[0], season_id=seasons[season_label(d)].id, match_date=d, home_team_id=key[2], away_team_id=key[3],
                               status="finished", home_goals=int(r.FTHome), away_goals=int(r.FTAway), result=r.FTResult,
                               home_elo=NN(r.HomeElo), away_elo=NN(r.AwayElo), form3_home=NN(r.Form3Home), form5_home=NN(r.Form5Home),
                               form3_away=NN(r.Form3Away), form5_away=NN(r.Form5Away), odd_home=NN(r.OddHome), odd_draw=NN(r.OddDraw),
                               odd_away=NN(r.OddAway), source="football-data.co.uk"))
        db.add_all(new); db.add(M.DataUpdate(source="history_csv", rows=len(new), detail=path)); db.commit()
        print(f"inserted {len(new)} matches, {len(teams)} teams")


if __name__ == "__main__":
    main(sys.argv[1])
