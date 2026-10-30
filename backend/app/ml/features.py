"""Single source of truth for model features. Training and serving both call `build_features`,
so feature definitions cannot diverge. All inputs are known before kickoff."""
import numpy as np
import pandas as pd

RAW = ["Division", "MatchDate", "HomeElo", "AwayElo", "Form3Home", "Form5Home", "Form3Away", "Form5Away",
       "OddHome", "OddDraw", "OddAway"]
FEATURES = ["Division_enc", "Month", "HomeElo", "AwayElo", "EloDiff", "Form3Home", "Form5Home", "Form3Away",
            "Form5Away", "FormDiff3", "FormDiff5", "OddHome", "OddDraw", "OddAway",
            "ImpProbHome", "ImpProbDraw", "ImpProbAway", "OddsMargin"]
REQUIRED_FOR_SERVING = ["OddHome", "OddDraw", "OddAway"]  # market odds are the core signal; refuse without them


def build_features(raw: pd.DataFrame, division_map: dict) -> pd.DataFrame:
    d = pd.DataFrame(index=raw.index)
    d["Division_enc"] = raw["Division"].map(division_map).fillna(-1).astype(float)
    d["Month"] = pd.to_datetime(raw["MatchDate"]).dt.month.astype(float)
    for c in ["HomeElo", "AwayElo", "Form3Home", "Form5Home", "Form3Away", "Form5Away", "OddHome", "OddDraw", "OddAway"]:
        d[c] = pd.to_numeric(raw[c], errors="coerce")
    d["EloDiff"] = d.HomeElo - d.AwayElo
    d["FormDiff3"] = d.Form3Home - d.Form3Away
    d["FormDiff5"] = d.Form5Home - d.Form5Away
    for k in ("Home", "Draw", "Away"):
        d["ImpProb" + k] = 1.0 / d["Odd" + k].where(d["Odd" + k] > 0)
    d["OddsMargin"] = d.ImpProbHome + d.ImpProbDraw + d.ImpProbAway - 1
    return d[FEATURES]
