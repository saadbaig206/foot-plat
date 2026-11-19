"""Bridge module guaranteeing a single source of truth for features between training and serving.
All definitions originate in app.ml.features.
"""
from app.ml.features import RAW, FEATURES, REQUIRED_FOR_SERVING, build_features

__all__ = ["RAW", "FEATURES", "REQUIRED_FOR_SERVING", "build_features"]
