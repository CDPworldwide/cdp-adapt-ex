"""Database model for persisted Google Translation results."""

from datetime import UTC, datetime

from sqlalchemy import Column, Text
from sqlmodel import Field

from app.models.base import BaseSQLModel


class TranslationCache(BaseSQLModel, table=True):
    """A cached translation shared across app users and Cloud Run instances."""

    __tablename__ = "translation_cache"

    source_language: str = Field(primary_key=True, max_length=16)
    target_language: str = Field(primary_key=True, max_length=16)
    source_hash: str = Field(primary_key=True, max_length=64)
    source_text: str = Field(sa_column=Column(Text, nullable=False))
    translated_text: str = Field(sa_column=Column(Text, nullable=False))
    provider: str = Field(default="google_translate_v3", max_length=64)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
