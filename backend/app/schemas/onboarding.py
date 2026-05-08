"""Schemas for onboarding endpoints."""

from enum import Enum

from app.schemas.location import APIBaseModel


class UserRole(str, Enum):
    """Welcome-modal role options. Mirrors the `roles` list in
    frontend/src/app/features/welcome-modal/welcome-modal.component.ts.
    Keep both lists in sync.
    """

    NGO = "ngo"
    GOVERNMENT_DISCLOSER = "governmentDiscloser"
    FINANCIAL = "financial"
    GOVERNMENT_NOT_DISCLOSING = "governmentNotDisclosing"
    BUSINESS = "business"
    OTHER = "other"


class RoleSelectionRequest(APIBaseModel):
    role: UserRole
