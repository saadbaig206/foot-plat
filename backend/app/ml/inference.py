"""Inference service. Loads a versioned artifact and produces predictions from raw pre-match inputs
using the same `build_features` as training."""
from pathlib import Path
import joblib, numpy as np, pandas as pd
from scipy.stats import poisson
from .features import build_features, REQUIRED_FOR_SERVING
from .compat import apply_numpy_compat

apply_numpy_compat()


class MissingInputs(ValueError):
    pass


class Predictor:
    def __init__(self, artifacts_dir: Path, version: str | None = None):
        dirs = sorted(p for p in Path(artifacts_dir).glob("v*") if (p / "model.joblib").exists())
        if not dirs:
            raise FileNotFoundError("no trained model artifacts; run `python -m ml.train`")
        d = (Path(artifacts_dir) / version) if version else dirs[-1]
        self.a = joblib.load(d / "model.joblib")
        self.meta = self.a["meta"]
        self.version = self.meta["version"]

    def predict(self, raw: dict) -> dict:
        missing = [c for c in REQUIRED_FOR_SERVING if not raw.get(c)]
        if missing:
            raise MissingInputs(f"market odds required, missing: {missing}")
        X = build_features(pd.DataFrame([raw]), self.a["division_map"])
        pA, pD, pH = [float(x) for x in self.a["outcome"].predict_proba(X)[0]]
        lh = max(float(self.a["goals_home"].predict(X)[0]), 0.05)
        la = max(float(self.a["goals_away"].predict(X)[0]), 0.05)
        grid = np.outer(poisson.pmf(range(7), lh), poisson.pmf(range(7), la))
        grid /= grid.sum()
        
        likely = {"H": pH, "D": pD, "A": pA}
        most_likely = max(likely, key=likely.get)

        # Rank scorelines
        ranked = []
        for i in range(7):
            for j in range(7):
                ranked.append(((i, j), grid[i, j]))
        ranked.sort(key=lambda x: x[1], reverse=True)

        if most_likely == "H":
            cands = [x for x in ranked if x[0][0] > x[0][1]]
        elif most_likely == "A":
            cands = [x for x in ranked if x[0][0] < x[0][1]]
        else:
            cands = [x for x in ranked if x[0][0] == x[0][1]]

        top_choice = cands[0][0] if cands else ranked[0][0]

        home_fav = X.ImpProbHome.iloc[0] >= X.ImpProbAway.iloc[0]
        p_fav_ok = float(self.a["fav"].predict_proba(X)[0, 1])
        return {
            "model_version": self.version,
            "outcome_probabilities": {"home": pH, "draw": pD, "away": pA},
            "most_likely_outcome": most_likely,
            "bookmaker_favourite": "home" if home_fav else "away",
            "favourite_avoids_defeat_probability": p_fav_ok,
            "favourite_wins_probability": pH if home_fav else pA,
            "predicted_goals": {"home": lh, "away": la, "label": "model-predicted goals, not xG"},
            "scoreline_most_likely": f"{top_choice[0]}-{top_choice[1]}",
            "alternative_scorelines": [{"score": f"{x[0][0]}-{x[0][1]}", "probability": float(x[1])} for x in ranked[:5]],
            "confidence": max(pH, pD, pA),
            "disclaimer": "Probabilistic estimates, not guaranteed outcomes. Accuracy is at bookmaker-implied level.",
        }
