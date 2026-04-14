from unittest.mock import MagicMock

import pytest
from app.api.v1.deps import get_location_details_service
from app.main import app
from app.models.location_details import OrganizationSummary
from app.schemas.location_v2 import (
    ActionsTab,
    HazardsTab,
    LocationProfile,
    RegionalStatistics,
    SolutionsTab,
)
from app.services.impls.location_details_service import (
    LocationDetailsService,
)
from app.shared.exceptions import CityNotFoundException


@pytest.fixture
def mock_location_details_service():
    mock = MagicMock(spec=LocationDetailsService)
    return mock


@pytest.mark.asyncio
async def test_get_location_success(client, mock_location_details_service):
    # Arrange
    expected_location = LocationProfile(
        organization_id=101,
        name="London",
        country_name="United Kingdom",
        lat=51.5074,
        lng=-0.1278,
        geometry={"type": "Point", "coordinates": [0, 0]},
        disclosure_year=2025,
        requesters=["C40", "WWF"],
        population=53000000,
        hazards=HazardsTab(statistics=RegionalStatistics()),
        government_actions=ActionsTab(),
        solutions=SolutionsTab(),
    )
    mock_location_details_service.get_eligible_location_details_by_name.return_value = (
        expected_location
    )

    app.dependency_overrides[get_location_details_service] = (
        lambda: mock_location_details_service
    )

    # Act
    response = await client.get("/api/v1/location/London")

    # Assert
    assert response.status_code == 200
    assert response.json() == expected_location.model_dump(by_alias=True)
    mock_location_details_service.get_eligible_location_details_by_name.assert_called_once()
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_location_not_found(client, mock_location_details_service):
    # Arrange
    mock_location_details_service.get_eligible_location_details_by_name.side_effect = (
        CityNotFoundException("NonExistentLocation")
    )

    app.dependency_overrides[get_location_details_service] = (
        lambda: mock_location_details_service
    )

    # Act
    response = await client.get("/api/v1/location/NonExistentLocation")

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "City not found: NonExistentLocation"}
    mock_location_details_service.get_eligible_location_details_by_name.assert_called_once()
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_location_by_org_id_success(client, mock_location_details_service):
    expected_location = LocationProfile(
        organization_id=123,
        name="Junagadh",
        country_name="India",
        lat=21.5222,
        lng=70.4579,
        geometry={"type": "Point", "coordinates": [70.4579, 21.5222]},
        hazards=HazardsTab(
            statistics=RegionalStatistics(
                population_exposed_value=None,
                population_exposed_percentage=None,
                gdp_at_risk_value=None,
                gdp_at_risk_percentage=None,
                gdp_at_risk_currency_code=None,
            )
        ),
        government_actions=ActionsTab(),
        solutions=SolutionsTab(),
    )
    mock_location_details_service.get_location_details_by_org_id.return_value = (
        expected_location
    )

    app.dependency_overrides[get_location_details_service] = (
        lambda: mock_location_details_service
    )

    response = await client.get("/api/v1/location/id/867355")

    assert response.status_code == 200
    assert response.json() == expected_location.model_dump(by_alias=True)
    mock_location_details_service.get_location_details_by_org_id.assert_called_once_with(
        867355
    )
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_location_by_org_id_not_found(client, mock_location_details_service):
    mock_location_details_service.get_location_details_by_org_id.side_effect = (
        CityNotFoundException("999999")
    )

    app.dependency_overrides[get_location_details_service] = (
        lambda: mock_location_details_service
    )

    response = await client.get("/api/v1/location/id/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "City not found: 999999"}
    mock_location_details_service.get_location_details_by_org_id.assert_called_once_with(
        999999
    )
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_all_location_names_returns_organization_summaries(
    client, mock_location_details_service
):
    expected_locations = [
        OrganizationSummary(
            id=867355,
            name="Junagadh",
            country="India",
            population=320250,
        ),
        OrganizationSummary(
            id=129421,
            name="London",
            country="United Kingdom of Great Britain and Northern Ireland",
            population=8982000,
        ),
    ]
    mock_location_details_service.get_all_location_summaries.return_value = (
        expected_locations
    )

    app.dependency_overrides[get_location_details_service] = (
        lambda: mock_location_details_service
    )

    response = await client.get("/api/v1/location/names")

    assert response.status_code == 200
    assert response.json() == [
        location.model_dump(by_alias=True) for location in expected_locations
    ]
    mock_location_details_service.get_all_location_summaries.assert_called_once_with()
    app.dependency_overrides.clear()
