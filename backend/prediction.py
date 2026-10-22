
from datetime import date
from pathlib import Path

import joblib
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "ml" / "artifacts" / "delay_risk_pipeline.joblib"

_model = None


def load_model():
    """Load the trained ML pipeline once and reuse it."""
    global _model

    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Trained model not found: {MODEL_PATH}. "
                "Run ml/train_model.py first."
            )
        _model = joblib.load(MODEL_PATH)

    return _model


def _normalize_progress(progress: float) -> float:
    """Validate progress as a percentage from 0 to 100."""
    value = float(progress)

    if not 0 <= value <= 100:
        raise ValueError("Progress must be between 0 and 100.")

    return value


def _build_early_warning(
    today: date,
    start_date: date,
    expected_end_date: date,
    actual_progress: float,
    delay_gap: float,
    milestones: list,
) -> dict:
    """Build explainable schedule warnings and recommended actions."""
    risk_factors = []
    actions = []

    if today > expected_end_date and actual_progress < 100:
        schedule_status = "Overdue"
        risk_factors.append(
            "The expected end date has passed and the project is incomplete."
        )
        actions.extend([
            "Review unfinished work and confirm a realistic completion date.",
            "Create a recovery plan with owners and target dates.",
            "Notify stakeholders if the completion date needs to change.",
        ])
    elif today < start_date and actual_progress == 0:
        schedule_status = "Not started"
        actions.extend([
            "Confirm resources, approvals, and materials are ready.",
            "Verify the planned start and end dates.",
        ])
    elif delay_gap >= 20:
        schedule_status = "Significantly behind"
        risk_factors.append(
            f"Actual progress is {delay_gap:.2f} percentage points "
            "behind the time-based schedule."
        )
        actions.extend([
            "Identify activities causing the largest schedule slippage.",
            "Assign owners and target dates to recovery actions.",
            "Review resource availability and task dependencies.",
        ])
    elif delay_gap >= 10:
        schedule_status = "Behind schedule"
        risk_factors.append(
            f"Actual progress is {delay_gap:.2f} percentage points "
            "behind the time-based schedule."
        )
        actions.extend([
            "Review incomplete activities and upcoming milestone dates.",
            "Agree on corrective actions with task owners.",
        ])
    elif delay_gap > 0:
        schedule_status = "Slightly behind"
        risk_factors.append(
            f"Actual progress is {delay_gap:.2f} percentage points "
            "behind the time-based schedule."
        )
        actions.extend([
            "Monitor progress at the next project review.",
            "Confirm upcoming milestone dates remain achievable.",
        ])
    else:
        schedule_status = "On track or ahead"
        actions.extend([
            "Continue comparing actual progress with planned progress.",
            "Keep milestone dates and progress records up to date.",
        ])

    missing_data = 0
    behind_milestones = 0
    overdue_milestones = 0

    for milestone in milestones or []:
        actual = getattr(milestone, "actual_progress_pct", None)
        planned = getattr(milestone, "planned_progress_pct", None)
        end_date = getattr(milestone, "planned_end_date", None)
        name = getattr(milestone, "name", None) or "Unnamed milestone"

        if actual is None or planned is None:
            missing_data += 1
            continue

        try:
            actual = float(actual)
            planned = float(planned)
        except (TypeError, ValueError):
            missing_data += 1
            continue

        if actual < planned:
            behind_milestones += 1

        if end_date is not None and today > end_date and actual < 100:
            overdue_milestones += 1
            risk_factors.append(
                f"Milestone '{name}' is past its planned end date "
                "and is incomplete."
            )
            actions.insert(
                0,
                f"Review overdue milestone '{name}' and agree on a recovery date.",
            )

    if behind_milestones:
        risk_factors.append(
            f"{behind_milestones} milestone(s) have actual progress "
            "below planned progress."
        )
        actions.append(
            "Review lagging milestones with their responsible owners."
        )

    if missing_data:
        risk_factors.append(
            f"{missing_data} milestone(s) lack actual or planned progress "
            "data and cannot be assessed."
        )
        actions.append(
            "Fill in missing actual and planned milestone progress."
        )

    return {
        "schedule_status": schedule_status,
        "risk_factors": list(dict.fromkeys(risk_factors)),
        "recommended_actions": list(dict.fromkeys(actions))[:8],
        "overdue_milestones": overdue_milestones,
        "milestones_behind_plan": behind_milestones,
        "milestones_missing_progress_data": missing_data,
    }


def predict_delay_risk(
    start_date: date,
    expected_end_date: date,
    progress: float,
    project_name: str = "Unknown",
    project_budget: float = 0.0,
    milestones: list | None = None,
) -> dict:
    """
    Calculate schedule risk and experimental milestone ML predictions.

    ML scores are based on synthetic training data and are not validated
    real-world delay probabilities. Early-warning recommendations are
    rules-based guidance, not predictions from the ML model.
    """
    actual_progress = _normalize_progress(progress)
    today = date.today()
    total_days = (expected_end_date - start_date).days

    if total_days <= 0:
        return {
            "risk": "Unknown",
            "reason": "Project dates must span at least one day.",
            "expected_progress": None,
            "actual_progress": actual_progress,
            "delay_gap": None,
            "model_prediction": None,
            "model_prediction_label": "Unavailable",
            "model_probability": None,
            "model_status": "Unavailable: invalid project dates.",
            "schedule_status": "Unknown",
            "risk_factors": [
                "The project start and end dates must span at least one day."
            ],
            "recommended_actions": [
                "Correct the project start and end dates."
            ],
            "overdue_milestones": 0,
            "milestones_behind_plan": 0,
            "milestones_missing_progress_data": 0,
        }

    elapsed_days = (today - start_date).days

    if elapsed_days <= 0:
        expected_progress = 0.0
    elif elapsed_days >= total_days:
        expected_progress = 100.0
    else:
        expected_progress = (elapsed_days / total_days) * 100

    expected_progress = round(expected_progress, 2)
    # Public schedule gap is actual minus expected: negative means behind.
    schedule_gap = round(actual_progress - expected_progress, 2)
    # Internal behind-gap is expected minus actual: positive means behind.
    behind_gap = round(expected_progress - actual_progress, 2)

    if today > expected_end_date and actual_progress < 100:
        risk = "High"
        reason = (
            "The expected end date has passed, but the project is incomplete."
        )
    elif behind_gap >= 20:
        risk = "High"
        reason = (
            f"Actual progress is {behind_gap:.2f} percentage points "
            "behind the time-based schedule."
        )
    elif behind_gap >= 10:
        risk = "Medium"
        reason = (
            f"Actual progress is {behind_gap:.2f} percentage points "
            "behind the time-based schedule."
        )
    elif behind_gap > 0:
        risk = "Low"
        reason = (
            f"Actual progress is {behind_gap:.2f} percentage points "
            "behind the time-based schedule, within the low-risk threshold."
        )
    else:
        risk = "Low"
        reason = "Actual progress is at or ahead of the time-based schedule."

    milestone_list = milestones or []

    planned_budget = sum(
        float(getattr(m, "planned_budget", 0) or 0)
        for m in milestone_list
    )
    actual_spend = sum(
        float(getattr(m, "actual_spend", 0) or 0)
        for m in milestone_list
    )

    warnings = _build_early_warning(
        today=today,
        start_date=start_date,
        expected_end_date=expected_end_date,
        actual_progress=actual_progress,
        delay_gap=behind_gap,
        milestones=milestone_list,
    )

    features = []

    for milestone in milestone_list:
        name = getattr(milestone, "name", "Unknown")
        actual = getattr(milestone, "actual_progress_pct", None)
        planned = getattr(milestone, "planned_progress_pct", None)
        budget = getattr(milestone, "planned_budget", None)
        spend = getattr(milestone, "actual_spend", None)
        milestone_end = getattr(milestone, "planned_end_date", None)

        if actual is None or planned is None:
            continue

        duration = (
            max(1, (milestone_end - start_date).days)
            if milestone_end is not None
            else total_days
        )

        features.append({
            "planned_progress": float(planned),
            "actual_progress": float(actual),
            "planned_budget": float(budget or 0),
            "actual_spend": float(spend or 0),
            "planned_duration_days": duration,
            "start_delay_days": 0,
            "project_name": project_name or "Unknown",
            "milestone_name": name or "Unknown",
        })

    response = {
        "risk": risk,
        "reason": reason,
        "expected_progress": expected_progress,
        "actual_progress": actual_progress,
        "delay_gap": schedule_gap,
        **warnings,
        "milestone_count": len(features),
        "milestone_planned_budget": round(planned_budget, 2),
        "milestone_actual_spend": round(actual_spend, 2),
        "project_budget": float(project_budget or 0),
    }

    if not features:
        response.update({
            "model_prediction": None,
            "model_prediction_label": "Unavailable",
            "model_probability": None,
            "model_status": (
                "No usable milestone progress data is available "
                "for the experimental milestone model."
            ),
        })
        return response

    model = load_model()
    frame = pd.DataFrame(features)
    predictions = model.predict(frame).astype(int).tolist()

    probabilities = (
        model.predict_proba(frame)
        if hasattr(model, "predict_proba")
        else None
    )
    classes = list(model.classes_) if hasattr(model, "classes_") else []
    delayed_count = sum(value == 1 for value in predictions)
    model_prediction = int(delayed_count > 0)

    delay_probabilities = []
    if probabilities is not None and 1 in classes:
        class_index = classes.index(1)
        delay_probabilities = [
            float(row[class_index]) for row in probabilities
        ]

    model_probability = (
        round(sum(delay_probabilities) / len(delay_probabilities), 4)
        if delay_probabilities
        else None
    )

    response.update({
        "model_prediction": model_prediction,
        "model_prediction_label": (
            "Delayed" if model_prediction == 1 else "Not delayed"
        ),
        "model_probability": model_probability,
        "model_status": (
            "Experimental score from synthetic training data; "
            "not validated as a real-world delay probability. "
            "Milestone duration and start-delay features are approximated."
        ),
        "milestones_predicted_delayed": delayed_count,
    })

    return response
