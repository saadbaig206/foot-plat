"""Model registry: tracks model artifacts and their DB registration.
"""
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
from ..db import query, query_one, execute

logger = logging.getLogger(__name__)


def model_status() -> dict:
    rows = query(
        """SELECT id, name, version, trained_at, is_active, metrics,
                  train_range::text AS train_range, test_range::text AS test_range
           FROM model_versions ORDER BY name, trained_at DESC"""
    )
    active = [r for r in rows if r["is_active"]]
    return {
        "models_registered": len(rows),
        "models_active": len(active),
        "ready_for_predictions": len(active) > 0,
        "models": rows,
        "note": None if active else "No trained model is registered yet.",
    }


def register_v1_artifact(artifact_dir: str = "artifacts/v1") -> dict:
    """Registers the v1 artifact files into model_versions table."""
    p = Path(artifact_dir)
    if not (p / "model.joblib").exists():
        # Try alternate path
        p = Path("backend") / artifact_dir
    if not (p / "model.joblib").exists():
        raise FileNotFoundError(f"model.joblib not found in {artifact_dir}")

    metrics_file = p / "metrics.json"
    metrics_data = {}
    if metrics_file.exists():
        metrics_data = json.loads(metrics_file.read_text(encoding="utf-8"))

    version = metrics_data.get("version", "v1")
    trained_at = metrics_data.get("trained_at", datetime.now(timezone.utc).isoformat())
    features = metrics_data.get("features", [])
    metrics = metrics_data.get("metrics", {})

    # Register main ensemble model
    sql = """
        INSERT INTO model_versions (
            name, version, artifact_path, trained_at, metrics, feature_list, is_active
        ) VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, TRUE)
        ON CONFLICT (name, version) DO UPDATE SET
            artifact_path = EXCLUDED.artifact_path,
            trained_at = EXCLUDED.trained_at,
            metrics = EXCLUDED.metrics,
            feature_list = EXCLUDED.feature_list,
            is_active = TRUE
        RETURNING id
    """
    row = query_one(sql, ("pitchside_ensemble", version, str((p / "model.joblib").resolve()),
                          trained_at, json.dumps(metrics), json.dumps(features)))
    return {
        "status": "registered",
        "model_version_id": row["id"] if row else None,
        "version": version,
        "name": "pitchside_ensemble"
    }
