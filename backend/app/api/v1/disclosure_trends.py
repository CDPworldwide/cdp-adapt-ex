from app.api.v1.deps import get_disclosure_trends_repository
from app.schemas.disclosure_trends import DisclosureTrendsSummary
from app.services.clients.database.disclosure_trends_repository import (
    DisclosureTrendsRepository,
)
from fastapi import APIRouter, Depends, Query

router = APIRouter()


@router.get("", response_model=DisclosureTrendsSummary)
async def get_disclosure_trends(
    year: int = Query(..., description="Disclosure year, e.g. 2025."),
    repo: DisclosureTrendsRepository = Depends(get_disclosure_trends_repository),
) -> DisclosureTrendsSummary:
    """Aggregate dataset-wide disclosure trends for a given year.

    All counts and percentages are computed across every public jurisdiction
    in the disclosure year — they are not scoped to a selected location.
    """
    return await repo.get_summary(year)
