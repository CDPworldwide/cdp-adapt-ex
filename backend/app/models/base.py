"""Base models and common imports for all models."""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class BaseSQLModel(SQLModel):
    """Base model with common fields."""

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
