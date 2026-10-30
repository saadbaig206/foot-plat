"""Model registry: reports which model artifacts exist and are active.

Phase 1 only reads the DB's model_versions table; prediction code arrives in Phase 4.
Nothing here fabricates a model: if no row is active, status says so.
"""
from ..db import query


def model_status() -> dict:
    rows = query(
        """SELECT name, version, trained_at, is_active, metrics, train_range::text AS train_range,
                  test_range::text AS test_range
           FROM model_versions ORDER BY name, trained_at DESC"""
    )
    active = [r for r in rows if r["is_active"]]
    return {
        "models_registered": len(rows),
        "models_active": len(active),
        "ready_for_predictions": len(active) > 0,
        "models": rows,
        "note": None if active else "No trained model is registered yet (Phase 4).",
    }
