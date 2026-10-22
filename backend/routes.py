
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import engine
from backend.models import Milestone, Project, User
from backend.schemas import (
    MilestoneCreate,
    MilestoneResponse,
    ProjectCreate,
    ProjectResponse,
)
from backend.prediction import predict_delay_risk
from backend.auth import get_current_user


router = APIRouter(prefix="/api/projects", tags=["Projects"])


def get_db():
    with Session(engine) as db:
        yield db


def get_project_or_404(
    db: Session,
    project_id: int,
    user_id: int,
) -> Project:
    """Return a project only when it belongs to the current user."""
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == user_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


# ---------------- PROJECT ENDPOINTS ----------------

@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(
        **payload.model_dump(),
        user_id=current_user.id,
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.id)
    ).all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_project_or_404(
        db, project_id, current_user.id
    )


@router.get("/{project_id}/predict")
def predict_project_delay(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(
        db, project_id, current_user.id
    )

    milestones = db.scalars(
        select(Milestone)
        .where(Milestone.project_id == project.id)
        .order_by(
            Milestone.planned_end_date,
            Milestone.id,
        )
    ).all()

    prediction = predict_delay_risk(
        start_date=project.start_date,
        expected_end_date=project.expected_end_date,
        progress=project.progress,
        project_name=project.name,
        project_budget=project.budget,
        milestones=milestones,
    )

    return {
        "project_id": project.id,
        "project_name": project.name,
        **prediction,
    }


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(
        db, project_id, current_user.id
    )

    db.delete(project)
    db.commit()

    return {"message": "Project deleted successfully"}


# ---------------- MILESTONE ENDPOINTS ----------------

@router.post(
    "/{project_id}/milestones",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_milestone(
    project_id: int,
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(
        db, project_id, current_user.id
    )

    milestone = Milestone(
        project_id=project.id,
        **payload.model_dump(),
    )

    db.add(milestone)
    db.commit()
    db.refresh(milestone)

    return milestone


@router.get(
    "/{project_id}/milestones",
    response_model=list[MilestoneResponse],
)
def list_milestones(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(
        db, project_id, current_user.id
    )

    return db.scalars(
        select(Milestone)
        .where(Milestone.project_id == project.id)
        .order_by(
            Milestone.planned_end_date,
            Milestone.id,
        )
    ).all()


@router.put(
    "/{project_id}/milestones/{milestone_id}",
    response_model=MilestoneResponse,
)
def update_milestone(
    project_id: int,
    milestone_id: int,
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(
        db, project_id, current_user.id
    )

    milestone = db.scalar(
        select(Milestone).where(
            Milestone.id == milestone_id,
            Milestone.project_id == project.id,
        )
    )

    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    for field, value in payload.model_dump().items():
        setattr(milestone, field, value)

    db.commit()
    db.refresh(milestone)

    return milestone
