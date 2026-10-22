
from pathlib import Path
import json

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "milestones.csv"
ARTIFACT_DIR = ROOT / "ml" / "artifacts"

NUMERIC_FEATURES = [
    "planned_progress",
    "actual_progress",
    "planned_budget",
    "actual_spend",
    "planned_duration_days",
    "start_delay_days",
]

CATEGORICAL_FEATURES = [
    "project_name",
    "milestone_name",
]

TARGET = "delay_label"


def main():
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Dataset not found: {DATA_FILE}")

    df = pd.read_csv(DATA_FILE)

    required = [
        "project_name",
        "milestone_name",
        "planned_start_date",
        "planned_end_date",
        "actual_start_date",
        "planned_progress",
        "actual_progress",
        "planned_budget",
        "actual_spend",
        TARGET,
    ]

    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Parse dates consistently.
    date_columns = [
        "planned_start_date",
        "planned_end_date",
        "actual_start_date",
    ]
    for column in date_columns:
        df[column] = pd.to_datetime(df[column], errors="coerce")

    # Convert numeric columns and remove invalid required records.
    numeric_columns = [
        "planned_progress",
        "actual_progress",
        "planned_budget",
        "actual_spend",
        TARGET,
    ]
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df = df.dropna(
        subset=date_columns + numeric_columns
        + ["project_name", "milestone_name"]
    ).copy()

    df = df[
        df[TARGET].isin([0, 1])
        & df["planned_progress"].between(0, 100)
        & df["actual_progress"].between(0, 100)
        & (df["planned_budget"] >= 0)
        & (df["actual_spend"] >= 0)
    ].copy()

    # Construct features without using actual_end_date.
    df["planned_duration_days"] = (
        df["planned_end_date"] - df["planned_start_date"]
    ).dt.days

    df["start_delay_days"] = (
        df["actual_start_date"] - df["planned_start_date"]
    ).dt.days

    df = df[df["planned_duration_days"] >= 0].copy()

    if len(df) < 8 or df[TARGET].nunique() != 2:
        raise ValueError(
            f"Only {len(df)} valid rows or only one label class remains. "
            "More valid labelled data is needed for this training split."
        )

    # Avoid a stratified split that cannot represent both classes.
    counts = df[TARGET].value_counts()
    if counts.min() < 2:
        raise ValueError(
            "Each delay-label class needs at least two records for "
            "this initial stratified train/test split."
        )

    features = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    X = df[features]
    y = df[TARGET].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.33,
        random_state=42,
        stratify=y,
    )

    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore")),
    ])

    preprocessing = ColumnTransformer([
        ("numeric", numeric_pipeline, NUMERIC_FEATURES),
        ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
    ])

    model = Pipeline([
        ("preprocessing", preprocessing),
        ("classifier", LogisticRegression(max_iter=1000)),
    ])

    model.fit(X_train, y_train)
    predictions = model.predict(X_test)

    report = classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["Not delayed", "Delayed"],
        zero_division=0,
        output_dict=True,
    )

    metrics = {
        "valid_rows": int(len(df)),
        "training_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "features": features,
        "excluded_future_field": "actual_end_date",
        "accuracy": float(accuracy_score(y_test, predictions)),
        "precision": float(
            precision_score(y_test, predictions, zero_division=0)
        ),
        "recall": float(
            recall_score(y_test, predictions, zero_division=0)
        ),
        "f1_score": float(
            f1_score(y_test, predictions, zero_division=0)
        ),
        "confusion_matrix": confusion_matrix(
            y_test, predictions, labels=[0, 1]
        ).tolist(),
        "classification_report": report,
        "limitations": (
            "Only nine sample records are provided. Evaluation metrics "
            "are highly unstable and do not establish real-world accuracy."
        ),
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, ARTIFACT_DIR / "delay_risk_pipeline.joblib")

    with open(
        ARTIFACT_DIR / "metrics.json", "w", encoding="utf-8"
    ) as file:
        json.dump(metrics, file, indent=2)

    print("\n=== InfraPredict AI: Model Evaluation ===")
    print(f"Valid records: {len(df)}")
    print(f"Training records: {len(X_train)}")
    print(f"Test records: {len(X_test)}")
    print(f"Accuracy: {metrics['accuracy']:.3f}")
    print(f"Precision: {metrics['precision']:.3f}")
    print(f"Recall: {metrics['recall']:.3f}")
    print(f"F1-score: {metrics['f1_score']:.3f}")
    print("Confusion matrix:", metrics["confusion_matrix"])
    print("\nSaved model:", ARTIFACT_DIR / "delay_risk_pipeline.joblib")
    print("Saved metrics:", ARTIFACT_DIR / "metrics.json")


if __name__ == "__main__":
    main()