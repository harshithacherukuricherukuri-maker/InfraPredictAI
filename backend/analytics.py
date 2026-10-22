
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import engine
from backend.models import Milestone, Project, User


router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


def get_db():
    with Session(engine) as db:
        yield db


@router.get("/projects/{project_id}")
def get_project_analytics(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    milestones = db.scalars(
        select(Milestone)
        .where(Milestone.project_id == project_id)
        .order_by(Milestone.planned_end_date, Milestone.id)
    ).all()

    total = len(milestones)
    completed = sum(
        1 for m in milestones
        if m.actual_progress_pct is not None
        and m.actual_progress_pct >= 100
    )
    overdue = sum(
        1 for m in milestones
        if m.actual_progress_pct is None
        or m.actual_progress_pct < 100
        if m.planned_end_date < date.today()
    )

    planned_budget = sum(m.planned_budget for m in milestones)
    actual_spend = sum(
        m.actual_spend or 0 for m in milestones
    )

    progress_values = [
        m.actual_progress_pct
        for m in milestones
        if m.actual_progress_pct is not None
    ]

    actual_progress = (
        sum(progress_values) / len(progress_values)
        if progress_values else 0
    )

    planned_progress = (
        sum(m.planned_progress_pct for m in milestones) / total
        if total else 0
    )

    return {
        "project_id": project.id,
        "project_name": project.name,
        "milestone_count": total,
        "completed_milestones": completed,
        "overdue_milestones": overdue,
        "planned_progress_pct": round(planned_progress, 2),
        "actual_progress_pct": round(actual_progress, 2),
        "progress_variance_pct": round(
            actual_progress - planned_progress, 2
        ),
        "planned_budget": round(planned_budget, 2),
        "actual_spend": round(actual_spend, 2),
        "budget_variance": round(
            planned_budget - actual_spend, 2
        ),
        "budget_used_pct": round(
            actual_spend / planned_budget * 100, 2
        ) if planned_budget else 0,
    }
