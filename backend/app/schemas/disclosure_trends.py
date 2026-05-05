"""Schemas for the dataset-wide disclosure-trends summary."""

from typing import Optional

from app.schemas.location import APIBaseModel, HazardEnum


class TopHazard(APIBaseModel):
    """One of the most-reported hazards across the dataset."""

    rank: int
    type: HazardEnum
    # Bracketed share of jurisdictions reporting this hazard, e.g. "21-30%".
    # Null when no jurisdictions reported it.
    range: Optional[str] = None


class DisclosureTrendsSummary(APIBaseModel):
    """Dataset-wide disclosure trends for a given disclosure year.

    All counts and percentages are aggregated across every public jurisdiction
    in the disclosure year — they are not scoped to a selected location.
    """

    # Distinct jurisdictions that disclosed >=1 public adaptation goal or action.
    adaptation_plan_count: int
    # Distinct jurisdictions reporting >=1 scarcity-side water hazard
    # (WATER_STRESS, DROUGHT, INCREASED_WATER_DEMAND). Mirrors the frontend
    # WATER_HAZARD_TYPES list in disclosure-trends.stats.ts.
    water_security_risks_count: int
    # The 3 most-reported hazards, ranked by distinct-org count.
    top_hazards: list[TopHazard]
    # Total public project rows across all jurisdictions for the year.
    projects_seeking_finance_count: int
    # Share of public jurisdictions that disclosed at least one hazard, 0-100.
    # Null if the dataset is empty.
    jurisdictions_exposed_pct: Optional[int] = None
