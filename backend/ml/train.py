"""Train and evaluate all match models on a chronological split; write a versioned artifact.

Usage: python -m ml.train --matches ../data/Matches.csv --version v1
Models (each a single sklearn Pipeline: median imputer -> scaler -> HistGradientBoosting, fit on TRAIN only):
  fav_avoids_defeat : binary, "bookmaker favourite wins or draws" (the notebook's original target)
  outcome_1x2       : three-class home/draw/away
  goals_home/away   : expected goals regressors (model-predicted goals; NOT xG)
"""
import argparse, json, warnings
from datetime import datetime, timezone
from pathlib import Path
import joblib, numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier as HGC, HistGradientBoostingRegressor as HGR
from sklearn.impute import SimpleImputer
from sklearn.metrics import (accuracy_score, brier_score_loss, log_loss, roc_auc_score, precision_score,
                             recall_score, f1_score, confusion_matrix, mean_absolute_error, mean_squared_error)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from .features import build_features, FEATURES

warnings.simplefilter("ignore")
STALE = ['ARG', 'BRA', 'CHN', 'DEN', 'FIN', 'IRL', 'JAP', 'MEX', 'NOR', 'POL', 'ROM', 'RUS', 'SUI', 'SWE', 'USA', 'AUT']
TEST_START = "2025-01-01"  # same chronological boundary as the original notebook


def pipe(est):
    return Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", est)])


def fav_target(df):
    home_fav = (df.ImpProbHome >= df.ImpProbAway).values
    ok = np.where(home_fav, df.FTResult.isin(["H", "D"]), df.FTResult.isin(["A", "D"]))
    return home_fav, ok.astype(int)


def main(a):
    df = pd.read_csv(a.matches, parse_dates=["MatchDate"])
    df = df.dropna(subset=["FTResult", "MatchDate", "FTHome", "FTAway", "OddHome", "OddDraw", "OddAway"])
    df = df[~df.Division.isin(STALE)].sort_values("MatchDate").reset_index(drop=True)
    divisions = sorted(df.Division.unique())
    dmap = {d: i for i, d in enumerate(divisions)}
    X = build_features(df, dmap)
    X["ImpProbHome"], X["ImpProbAway"]  # sanity: present
    tr = (df.MatchDate < TEST_START).values
    te = ~tr
    Xtr, Xte = X[tr], X[te]
    home_fav, y_fav = fav_target(pd.concat([df[["FTResult"]], X[["ImpProbHome", "ImpProbAway"]]], axis=1))
    y3 = df.FTResult.map({"A": 0, "D": 1, "H": 2}).values
    m = {}

    fav = pipe(HGC(max_iter=150, max_leaf_nodes=31, learning_rate=0.08, random_state=42)).fit(Xtr, y_fav[tr])
    p = fav.predict_proba(Xte)[:, 1]; y = y_fav[te]
    imp = Xte[["ImpProbHome", "ImpProbDraw", "ImpProbAway"]].values
    imp = imp / imp.sum(1, keepdims=True)
    pbk = np.where(home_fav[te], 1 - imp[:, 2], 1 - imp[:, 0])
    pred = (p >= .5).astype(int)
    cov = {}
    for t in (0.6, 0.7, 0.8, 0.85, 0.9):
        k = p >= t
        cov[str(t)] = {"coverage": round(float(k.mean()), 4), "n": int(k.sum()), "accuracy": round(float(y[k].mean()), 4) if k.any() else None}
    m["fav_avoids_defeat"] = {
        "n_test": int(len(y)), "base_rate": round(float(y.mean()), 4), "accuracy": round(accuracy_score(y, pred), 4),
        "precision_succeeds": round(precision_score(y, pred, zero_division=0), 4), "recall_succeeds": round(recall_score(y, pred, zero_division=0), 4),
        "f1": round(f1_score(y, pred, zero_division=0), 4), "roc_auc": round(roc_auc_score(y, p), 4),
        "bookmaker_roc_auc": round(roc_auc_score(y, pbk), 4), "brier": round(brier_score_loss(y, p), 4),
        "bookmaker_brier": round(brier_score_loss(y, pbk), 4), "log_loss": round(log_loss(y, p), 4),
        "confusion_matrix": confusion_matrix(y, pred).tolist(), "coverage_by_threshold": cov,
        "calibration": [{"bin": f"{lo:.1f}-{hi:.1f}", "n": int(((p >= lo) & (p < hi)).sum()),
                         "mean_pred": round(float(p[(p >= lo) & (p < hi)].mean()), 3), "actual": round(float(y[(p >= lo) & (p < hi)].mean()), 3)}
                        for lo, hi in [(.5, .6), (.6, .7), (.7, .8), (.8, .9), (.9, 1.01)] if ((p >= lo) & (p < hi)).sum() > 20],
        "note": "Accuracy inside high-confidence tiers reflects selection of lopsided fixtures; the model matches bookmaker-implied AUC/Brier, it does not beat them."}

    o3 = pipe(HGC(max_iter=150, learning_rate=0.05, max_leaf_nodes=15, random_state=42)).fit(Xtr, y3[tr])
    P = o3.predict_proba(Xte); bk = imp[:, [2, 1, 0]]; yt = y3[te]
    m["outcome_1x2"] = {"n_test": int(len(yt)), "accuracy": round(accuracy_score(yt, P.argmax(1)), 4),
                        "log_loss": round(log_loss(yt, P), 4), "bookmaker_accuracy": round(accuracy_score(yt, bk.argmax(1)), 4),
                        "bookmaker_log_loss": round(log_loss(yt, bk), 4), "always_home_accuracy": round(float((yt == 2).mean()), 4),
                        "brier_multiclass": round(float(((P - np.eye(3)[yt]) ** 2).sum(1).mean()), 4),
                        "bookmaker_brier_multiclass": round(float(((bk - np.eye(3)[yt]) ** 2).sum(1).mean()), 4),
                        "confusion_matrix_A_D_H": confusion_matrix(yt, P.argmax(1)).tolist()}

    regs = {}
    for col, nm in (("FTHome", "goals_home"), ("FTAway", "goals_away")):
        r = pipe(HGR(max_iter=120, max_leaf_nodes=31, random_state=42)).fit(Xtr, df.loc[tr, col])
        pr = r.predict(Xte); yy = df.loc[te, col].values; base = np.full(len(yy), df.loc[tr, col].mean())
        regs[nm] = r
        m[nm] = {"mae": round(mean_absolute_error(yy, pr), 3), "rmse": round(mean_squared_error(yy, pr) ** .5, 3),
                 "baseline_mae": round(mean_absolute_error(yy, base), 3), "baseline_rmse": round(mean_squared_error(yy, base) ** .5, 3),
                 "label": "predicted goals (model output), not xG"}

    out = Path(a.out) / a.version; out.mkdir(parents=True, exist_ok=True)
    meta = {"version": a.version, "trained_at": datetime.now(timezone.utc).isoformat(),
            "train_range": f"{df.MatchDate[tr].min().date()}..{df.MatchDate[tr].max().date()}",
            "test_range": f"{df.MatchDate[te].min().date()}..{df.MatchDate[te].max().date()}",
            "n_train": int(tr.sum()), "n_test": int(te.sum()), "features": FEATURES, "divisions": divisions, "metrics": m,
            "caveats": ["Elo after 2025-06-15 in the source dataset is provisional.", "Models match bookmaker-implied probabilities; they do not beat the market.",
                        "Requires pre-match market odds as input."]}
    joblib.dump({"fav": fav, "outcome": o3, "goals_home": regs["goals_home"], "goals_away": regs["goals_away"],
                 "division_map": dmap, "meta": meta}, out / "model.joblib")
    (out / "metrics.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(m, indent=1)[:3500]); print("saved", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--matches", required=True); ap.add_argument("--version", default="v1")
    ap.add_argument("--out", default="artifacts"); main(ap.parse_args())
