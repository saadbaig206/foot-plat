"""CLI script to register model artifacts in model_versions table.
Usage: python -m scripts.register_models [--dir artifacts/v1]
"""
import argparse
from pathlib import Path
from app.ml.registry import register_v1_artifact, model_status


def main():
    parser = argparse.ArgumentParser(description="Register model artifact into model_versions database table.")
    parser.add_argument("--dir", type=str, default="artifacts/v1", help="Artifacts directory containing model.joblib and metrics.json")
    args = parser.parse_args()

    print(f"Registering model from {args.dir}...")
    res = register_v1_artifact(args.dir)
    print(f"Success! Registered model version {res['version']} (ID: {res['model_version_id']})")
    status = model_status()
    print(f"Active models count: {status['models_active']}, Ready for predictions: {status['ready_for_predictions']}")


if __name__ == "__main__":
    main()
