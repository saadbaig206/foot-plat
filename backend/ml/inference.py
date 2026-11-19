"""Bridge module guaranteeing a single source of truth for inference between training and serving.
All implementations originate in app.ml.inference.
"""
from app.ml.inference import (
    load_model,
    predict_proba_1x2,
    predict_fav_avoids_defeat,
    predict_goals,
    predict_all,
)

__all__ = [
    "load_model",
    "predict_proba_1x2",
    "predict_fav_avoids_defeat",
    "predict_goals",
    "predict_all",
]
