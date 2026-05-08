from unittest.mock import AsyncMock, MagicMock

import pytest
from app.api.v1.deps import get_disclosure_trends_repository
from app.main import app
from app.schemas.disclosure_trends import DisclosureTrendsSummary, TopHazard
from app.schemas.location import HazardEnum
from app.services.clients.database.disclosure_trends_repository import (
    DisclosureTrendsRepository,
    _bracket,
)


@pytest.fixture
def mock_disclosure_trends_repo():
    return MagicMock(spec=DisclosureTrendsRepository)


@pytest.mark.asyncio
async def test_get_disclosure_trends_success(client, mock_disclosure_trends_repo):
    expected = DisclosureTrendsSummary(
        adaptation_plan_count=312,
        water_security_risks_count=184,
        top_hazards=[
            TopHazard(rank=1, type=HazardEnum.EXTREME_HEAT, range="41-50%"),
            TopHazard(rank=2, type=HazardEnum.URBAN_FLOODING, range="31-40%"),
            TopHazard(rank=3, type=HazardEnum.DROUGHT, range="21-30%"),
        ],
        projects_seeking_finance_count=427,
        jurisdictions_exposed_pct=68,
    )
    mock_disclosure_trends_repo.get_summary = AsyncMock(return_value=expected)
    app.dependency_overrides[get_disclosure_trends_repository] = (
        lambda: mock_disclosure_trends_repo
    )

    response = await client.get("/api/v1/disclosure-trends?year=2025")

    assert response.status_code == 200
    assert response.json() == expected.model_dump(by_alias=True)
    mock_disclosure_trends_repo.get_summary.assert_called_once_with(2025)
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_disclosure_trends_year_required(client):
    response = await client.get("/api/v1/disclosure-trends")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_disclosure_trends_passes_year(client, mock_disclosure_trends_repo):
    mock_disclosure_trends_repo.get_summary = AsyncMock(
        return_value=DisclosureTrendsSummary(
            adaptation_plan_count=0,
            water_security_risks_count=0,
            top_hazards=[],
            projects_seeking_finance_count=0,
            jurisdictions_exposed_pct=None,
        )
    )
    app.dependency_overrides[get_disclosure_trends_repository] = (
        lambda: mock_disclosure_trends_repo
    )

    response = await client.get("/api/v1/disclosure-trends?year=2024")

    assert response.status_code == 200
    mock_disclosure_trends_repo.get_summary.assert_called_once_with(2024)
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "pct,expected",
    [
        (0, None),
        (1, "1-10%"),
        (10, "1-10%"),
        (11, "11-20%"),
        (20, "11-20%"),
        (21, "21-30%"),
        (50, "41-50%"),
        (100, "91-100%"),
    ],
)
def test_bracket(pct, expected):
    assert _bracket(pct) == expected
