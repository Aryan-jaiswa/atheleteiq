from pathlib import Path

from .predictor import InjuryRiskPredictor


def main() -> None:
    models_dir = Path(__file__).parent / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    InjuryRiskPredictor()
    print("Model trained and saved to models/")


if __name__ == "__main__":
    main()
