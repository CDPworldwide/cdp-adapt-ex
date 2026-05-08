"""Database models for onboarding telemetry."""

from typing import Optional

from sqlmodel import Field

from app.models.base import BaseSQLModel


class UserRoleSelection(BaseSQLModel, table=True):
    """A role selection captured from the welcome modal."""

    __tablename__ = "user_role_selections"

    id: Optional[int] = Field(default=None, primary_key=True)
    role: str = Field(index=True)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
