"""Prediction Service (Phase 4 & Phase 5).
Builds leak-free pre-match features from the database, loads the registered v1 ensemble artifact,
computes 1X2 probabilities, Poisson scoreline matrix, and data-grounded explanations,
and saves predictions with timestamps and feature provenance to the database.
"""
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from scipy.stats import poisson
from ..config import get_settings
from ..db import query, query_one, execute
from ..ml.features import build_features, FEATURES
from ..ml.compat import apply_numpy_compat

apply_numpy_compat()

logger = logging.getLogger(__name__)

_predictor_instance = None


class ModelService:
    def __init__(self, artifact_path: Path | str | None = None):
        if artifact_path is None:
            # Look in backend/artifacts/v1 or ../models or artifacts/v1
            candidates = [
                Path("artifacts/v1"),
                Path("backend/artifacts/v1"),
                Path("../artifacts/v1"),
                Path("models"),
            ]
            for c in candidates:
                if (c / "model.joblib").exists():
                    artifact_path = c / "model.joblib"
                    break

        if not artifact_path or not Path(artifact_path).exists():
            raise FileNotFoundError(f"Model artifact not found. Checked: {artifact_path}")

        logger.info(f"Loading model artifact from {artifact_path}")
        self.artifact = joblib.load(artifact_path)
        self.meta = self.artifact.get("meta", {})
        self.version = self.meta.get("version", "v1")
        self.division_map = self.artifact.get("division_map", {})
        self.fav_model = self.artifact["fav"]
        self.outcome_model = self.artifact["outcome"]
        self.goals_home_model = self.artifact["goals_home"]
        self.goals_away_model = self.artifact["goals_away"]

    def _compute_team_form(self, team_id: int, before_date: datetime.date, n_matches: int) -> int:
        """Calculates points gained in the last n matches before the specified date."""
        sql = """
            SELECT home_team_id, away_team_id, home_goals, away_goals, result
            FROM matches
            WHERE status = 'finished'
              AND match_date < %s
              AND (home_team_id = %s OR away_team_id = %s)
            ORDER BY match_date DESC
            LIMIT %s
        """
        rows = query(sql, (before_date, team_id, team_id, n_matches))
        points = 0
        for r in rows:
            res = r["result"]
            if res is None and r["home_goals"] is not None and r["away_goals"] is not None:
                if r["home_goals"] > r["away_goals"]:
                    res = "H"
                elif r["away_goals"] > r["home_goals"]:
                    res = "A"
                else:
                    res = "D"

            if r["home_team_id"] == team_id:
                if res == "H":
                    points += 3
                elif res == "D":
                    points += 1
            else:
                if res == "A":
                    points += 3
                elif res == "D":
                    points += 1
        return points

    def _get_team_elo(self, team_id: int) -> float:
        """Retrieves or dynamically computes a team's rating from latest standings/performance."""
        row = query_one("SELECT elo FROM elo_ratings WHERE team_id = %s ORDER BY as_of DESC LIMIT 1", (team_id,))
        if row and row.get("elo"):
            return float(row["elo"])

        row = query_one("""
            SELECT played, won, drawn, lost, goals_for, goals_against, points
            FROM league_standings
            WHERE team_id = %s
            ORDER BY last_updated DESC LIMIT 1
        """, (team_id,))
        if row and row.get("played", 0) > 0:
            gp = row["played"]
            pts = row["points"]
            gd = row["goals_for"] - row["goals_against"]
            ppg = pts / gp
            gd_pg = gd / gp
            elo = 1500.0 + (ppg - 1.35) * 190.0 + (gd_pg) * 35.0
            return max(1200.0, min(1950.0, round(elo, 1)))

        return 1500.0

    def _estimate_odds_from_elo(self, elo_diff: float) -> tuple[float, float, float]:
        """Fallback when live bookmaker odds are unavailable: calculates Elo-based odds."""
        # Elo expected score with +65 home advantage
        dr = elo_diff + 65.0
        p_home = 1.0 / (1.0 + 10.0 ** (-dr / 400.0))
        # Empirical draw probability in domestic leagues is ~25-28%
        p_draw = max(0.20, min(0.30, 0.28 - 0.08 * (abs(elo_diff) / 400.0)))
        p_home_adj = max(0.08, min(0.85, p_home * (1.0 - p_draw)))
        p_away_adj = max(0.05, 1.0 - p_home_adj - p_draw)
        # Add 5% bookmaker overround
        margin = 1.05
        return (
            round(margin / p_home_adj, 2),
            round(margin / p_draw, 2),
            round(margin / p_away_adj, 2)
        )

    def generate_explanation(self, p_home: float, p_draw: float, p_away: float,
                             home_name: str, away_name: str,
                             elo_diff: float, scoreline: str,
                             odd_home: float, odd_away: float,
                             form_h: int, form_a: int) -> str:
        """Generates qualitative, data-grounded explanation for the prediction."""
        fav = home_name if p_home > p_away else away_name
        fav_prob = max(p_home, p_away)
        elo_str = f"{abs(elo_diff):.0f} Elo points"
        advantage = f"{home_name} holds a {elo_str} rating advantage" if elo_diff > 25 else (
            f"{away_name} holds a {elo_str} rating advantage" if elo_diff < -25 else "Both sides are closely matched on Elo"
        )

        form_str = f"In recent form, {home_name} has taken {form_h} pts vs {away_name}'s {form_a} pts."
        prob_str = f"The model assigns a {fav_prob*100:.1f}% probability to {fav} winning, with {scoreline} as the most probable scoreline."

        return f"{advantage}. {form_str} {prob_str}"

    def predict_for_match(self, match_id: int, persist: bool = True) -> dict:
        """Generates a complete prediction payload for a specific match."""
        sql = """
            SELECT m.*, l.code AS league_code, l.name AS league_name,
                   ht.name AS home_name, ht.logo_url AS home_logo,
                   at.name AS away_name, at.logo_url AS away_logo
            FROM matches m
            JOIN leagues l ON l.id = m.league_id
            JOIN teams ht ON ht.id = m.home_team_id
            JOIN teams at ON at.id = m.away_team_id
            WHERE m.id = %s
        """
        m = query_one(sql, (match_id,))
        if not m:
            raise ValueError(f"Match {match_id} not found.")

        m_date = m["match_date"]
        division = m["league_code"]
        h_id = m["home_team_id"]
        a_id = m["away_team_id"]

        # Elo: use match pre-match value if available, else dynamically compute from current season standings
        h_elo = float(m["home_elo"]) if m.get("home_elo") is not None else self._get_team_elo(h_id)
        a_elo = float(m["away_elo"]) if m.get("away_elo") is not None else self._get_team_elo(a_id)
        elo_diff = h_elo - a_elo

        # Form
        f3h = m["form3_home"] if m["form3_home"] is not None else self._compute_team_form(h_id, m_date, 3)
        f5h = m["form5_home"] if m["form5_home"] is not None else self._compute_team_form(h_id, m_date, 5)
        f3a = m["form3_away"] if m["form3_away"] is not None else self._compute_team_form(a_id, m_date, 3)
        f5a = m["form5_away"] if m["form5_away"] is not None else self._compute_team_form(a_id, m_date, 5)

        # Odds (real market odds or Elo-estimated fallback)
        o_h = m["odd_home"]
        o_d = m["odd_draw"]
        o_a = m["odd_away"]
        odds_estimated = False

        if not o_h or not o_d or not o_a:
            o_h, o_d, o_a = self._estimate_odds_from_elo(elo_diff)
            odds_estimated = True

        raw_df = pd.DataFrame([{
            "Division": division,
            "MatchDate": m_date,
            "HomeElo": h_elo,
            "AwayElo": a_elo,
            "Form3Home": f3h,
            "Form5Home": f5h,
            "Form3Away": f3a,
            "Form5Away": f5a,
            "OddHome": o_h,
            "OddDraw": o_d,
            "OddAway": o_a
        }])

        X = build_features(raw_df, self.division_map)

        # 3-class probabilities
        probs = self.outcome_model.predict_proba(X)[0]
        pA, pD, pH = float(probs[0]), float(probs[1]), float(probs[2])

        # Goal expectations
        lh = max(float(self.goals_home_model.predict(X)[0]), 0.1)
        la = max(float(self.goals_away_model.predict(X)[0]), 0.1)

        # Poisson scoreline grid (7x7)
        grid = np.outer(poisson.pmf(range(7), lh), poisson.pmf(range(7), la))
        grid /= grid.sum()

        most_likely_outcome = "H" if pH >= max(pD, pA) else ("D" if pD >= pA else "A")

        # Rank all 49 scorelines by joint probability
        ranked_scorelines = []
        for i in range(7):
            for j in range(7):
                ranked_scorelines.append(((i, j), grid[i, j]))
        ranked_scorelines.sort(key=lambda x: x[1], reverse=True)

        # Condition the primary predicted scoreline on the predicted outcome
        if most_likely_outcome == "H":
            candidates = [x for x in ranked_scorelines if x[0][0] > x[0][1]]
        elif most_likely_outcome == "A":
            candidates = [x for x in ranked_scorelines if x[0][0] < x[0][1]]
        else:
            candidates = [x for x in ranked_scorelines if x[0][0] == x[0][1]]

        top_choice = candidates[0][0] if candidates else ranked_scorelines[0][0]
        top_scoreline = f"{top_choice[0]}-{top_choice[1]}"

        scoreline_probs = [
            {"score": f"{x[0][0]}-{x[0][1]}", "probability": round(float(x[1]), 4)}
            for x in ranked_scorelines[:5]
        ]

        # Favourite avoids defeat
        p_fav_ok = float(self.fav_model.predict_proba(X)[0, 1])
        home_is_fav = X.ImpProbHome.iloc[0] >= X.ImpProbAway.iloc[0]
        fav_side = "H" if home_is_fav else "A"

        confidence = max(pH, pD, pA)
        explanation = self.generate_explanation(
            pH, pD, pA, m["home_name"], m["away_name"], elo_diff,
            top_scoreline, o_h, o_a, f5h, f5a
        )

        features_used = {
            "division": division,
            "home_elo": h_elo,
            "away_elo": a_elo,
            "elo_diff": elo_diff,
            "form5_home": f5h,
            "form5_away": f5a,
            "odd_home": o_h,
            "odd_draw": o_d,
            "odd_away": o_a,
            "odds_estimated": odds_estimated
        }

        # Model version ID in DB
        mv_row = query_one("SELECT id FROM model_versions WHERE version = %s AND is_active = TRUE", (self.version,))
        mv_id = mv_row["id"] if mv_row else 1

        if persist:
            execute("""
                INSERT INTO predictions (
                    match_id, model_version_id, generated_at, p_home, p_draw, p_away,
                    p_fav_avoids_defeat, favourite_side, exp_home_goals, exp_away_goals,
                    predicted_score, confidence, features_used
                ) VALUES (%s, %s, now(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (match_id, model_version_id) DO UPDATE SET
                    generated_at = now(),
                    p_home = EXCLUDED.p_home,
                    p_draw = EXCLUDED.p_draw,
                    p_away = EXCLUDED.p_away,
                    p_fav_avoids_defeat = EXCLUDED.p_fav_avoids_defeat,
                    favourite_side = EXCLUDED.favourite_side,
                    exp_home_goals = EXCLUDED.exp_home_goals,
                    exp_away_goals = EXCLUDED.exp_away_goals,
                    predicted_score = EXCLUDED.predicted_score,
                    confidence = EXCLUDED.confidence,
                    features_used = EXCLUDED.features_used
            """, (
                match_id, mv_id, pH, pD, pA, p_fav_ok, fav_side, lh, la,
                top_scoreline, confidence, json.dumps(features_used)
            ))

        # Query Head-to-Head (H2H) clash history
        h2h_sql = """
            SELECT m.id, m.match_date, m.home_goals, m.away_goals, m.result,
                   ht.name AS home_team, ht.logo_url AS home_logo,
                   at.name AS away_team, at.logo_url AS away_logo
            FROM matches m
            JOIN teams ht ON ht.id = m.home_team_id
            JOIN teams at ON at.id = m.away_team_id
            WHERE m.status = 'finished'
              AND (
                (m.home_team_id = %(hid)s AND m.away_team_id = %(aid)s)
                OR (m.home_team_id = %(aid)s AND m.away_team_id = %(hid)s)
              )
            ORDER BY m.match_date DESC
            LIMIT 5
        """
        h2h_matches = query(h2h_sql, {"hid": h_id, "aid": a_id})
        h_wins = sum(1 for hm in h2h_matches if (hm["home_team"] == m["home_name"] and hm["result"] == "H") or (hm["away_team"] == m["home_name"] and hm["result"] == "A"))
        a_wins = sum(1 for hm in h2h_matches if (hm["home_team"] == m["away_name"] and hm["result"] == "H") or (hm["away_team"] == m["away_name"] and hm["result"] == "A"))
        draws = sum(1 for hm in h2h_matches if hm["result"] == "D")

        return {
            "match_id": match_id,
            "match_date": str(m_date),
            "kickoff_utc": str(m["kickoff_utc"]) if m.get("kickoff_utc") else None,
            "league_code": division,
            "league_name": m["league_name"],
            "home_team": m["home_name"],
            "home_logo": m["home_logo"],
            "away_team": m["away_name"],
            "away_logo": m["away_logo"],
            "model_version": self.version,
            "probabilities": {
                "home": round(pH, 4),
                "draw": round(pD, 4),
                "away": round(pA, 4)
            },
            "most_likely_outcome": "H" if pH >= max(pD, pA) else ("D" if pD >= pA else "A"),
            "confidence": round(confidence, 4),
            "bookmaker_favourite": "home" if home_is_fav else "away",
            "favourite_avoids_defeat_prob": round(p_fav_ok, 4),
            "predicted_goals": {
                "home": round(lh, 2),
                "away": round(la, 2),
                "label": "predicted goals (Poisson expectation), not xG"
            },
            "predicted_score": top_scoreline,
            "top_scorelines": scoreline_probs,
            "odds_estimated": odds_estimated,
            "explanation": explanation,
            "h2h": {
                "total": len(h2h_matches),
                "home_wins": h_wins,
                "draws": draws,
                "away_wins": a_wins,
                "past_matches": h2h_matches
            },
            "disclaimer": "Probabilistic estimates, not guaranteed outcomes. Model calibrated to market-implied accuracy."
        }


def get_model_service() -> ModelService:
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = ModelService()
    return _predictor_instance
