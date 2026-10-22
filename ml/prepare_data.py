
from pathlib import Path

import pandas as pd

# Find the CSV file in the project's data folder
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = PROJECT_ROOT / "data" / "milestones.csv"


def main():
    if not DATA_FILE.exists():
        print(f"ERROR: Dataset not found: {DATA_FILE}")
        return

    df = pd.read_csv(DATA_FILE)

    print("\n=== InfraPredict AI: Dataset Check ===")
    print(f"Dataset file: {DATA_FILE}")
    print(f"Number of data rows: {len(df)}")
    print(f"Number of columns: {len(df.columns)}")

    print("\nColumn names:")
    print(df.columns.tolist())

    print("\nMissing values per column:")
    print(df.isnull().sum())

    print("\nDelay label counts (0 = on time, 1 = delayed):")
    if "delay_label" in df.columns:
        print(df["delay_label"].value_counts(dropna=False))
    else:
        print("ERROR: The delay_label column is missing.")

    print("\nFirst five records:")
    print(df.head().to_string(index=False))


if __name__ == "__main__":
    main()
