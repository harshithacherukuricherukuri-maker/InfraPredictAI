
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    budget: float = Field(gt=0, allow_inf_nan=False)
    start_date: date
    expected_end_date: date
    progress: float = Field(default=0.0, ge=0, le=100)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.expected_end_date < self.start_date:
            raise ValueError(
                "Expected end date must not precede start date"
            )
        return self


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    location: str | None
    budget: float
    start_date: date
    expected_end_date: date
    progress: float
    created_at: datetime


class MilestoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    planned_end_date: date
    actual_end_date: date | None = None
    planned_progress_pct: float = Field(ge=0, le=100)
    actual_progress_pct: float | None = Field(
        default=None, ge=0, le=100
    )
    planned_budget: float = Field(ge=0, allow_inf_nan=False)
    actual_spend: float | None = Field(
        default=None, ge=0, allow_inf_nan=False
    )

    @model_validator(mode="after")
    def validate_actual_values(self):
        if (
            self.actual_end_date is not None
            and self.actual_end_date < date.min
        ):
            raise ValueError("Invalid actual end date")
        return self


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    planned_end_date: date
    actual_end_date: date | None
    planned_progress_pct: float
    actual_progress_pct: float | None
    planned_budget: float
    actual_spend: float | None
    created_at: datetime


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
