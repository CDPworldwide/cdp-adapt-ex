from unittest.mock import AsyncMock, MagicMock

import pytest
from app.api.v1.deps import (
    get_location_details_service,
    get_location_profile_translation_service,
)
from app.main import app
from app.models.location_details import DimCentral, OrganizationSummary, PeerSolutions
from app.schemas.location import (
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
    response = await client.get("/api/v1/locations/London")

    # Assert
    assert response.status_code == 200
    assert response.json()["location"] == expected_location.model_dump(by_alias=True)
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
    response = await client.get("/api/v1/locations/NonExistentLocation")

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

    response = await client.get("/api/v1/locations/id/867355")

    assert response.status_code == 200
    assert response.json()["location"] == expected_location.model_dump(by_alias=True)
    mock_location_details_service.get_location_details_by_org_id.assert_called_once_with(
        867355
    )
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_location_by_org_id_translates_profile_on_backend(
    client, mock_location_details_service
):
    expected_location = LocationProfile(
        organization_id=123,
        name="Junagadh",
        country_name="India",
        lat=21.5222,
        lng=70.4579,
        geometry={"type": "Point", "coordinates": [70.4579, 21.5222]},
        hazards=HazardsTab(statistics=RegionalStatistics()),
        government_actions=ActionsTab(),
        solutions=SolutionsTab(),
    )
    translated_location = expected_location.model_copy(
        update={"reporting_language": "es"}
    )
    mock_location_details_service.get_location_details_by_org_id.return_value = (
        expected_location
    )
    mock_translation_service = AsyncMock()
    mock_translation_service.translate_profile.return_value = translated_location

    app.dependency_overrides[get_location_details_service] = (
        lambda: mock_location_details_service
    )
    app.dependency_overrides[get_location_profile_translation_service] = (
        lambda: mock_translation_service
    )

    response = await client.get("/api/v1/locations/id/867355?target_language=es")

    assert response.status_code == 200
    assert response.json()["location"]["reportingLanguage"] == "es"
    mock_translation_service.translate_profile.assert_awaited_once_with(
        expected_location, "es"
    )
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_location_by_org_id_rejects_unsupported_target_language(
    client, mock_location_details_service
):
    expected_location = LocationProfile(
        organization_id=123,
        name="Junagadh",
        country_name="India",
        lat=21.5222,
        lng=70.4579,
        geometry={"type": "Point", "coordinates": [70.4579, 21.5222]},
        hazards=HazardsTab(statistics=RegionalStatistics()),
        government_actions=ActionsTab(),
        solutions=SolutionsTab(),
    )
    mock_location_details_service.get_location_details_by_org_id.return_value = (
        expected_location
    )

    app.dependency_overrides[get_location_details_service] = (
        lambda: mock_location_details_service
    )

    response = await client.get("/api/v1/locations/id/867355?target_language=xx")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported target language: xx"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_location_by_org_id_preserves_null_has_local_action(client):
    repository = AsyncMock()
    repository.has_organization.return_value = True
    repository.get_metadata.return_value = DimCentral(
        cdp_disclosing_org_number=834406,
        disclosing_organization="Null Local Action City",
        discloser_country_or_area="Test Country",
        cdp_requesting_org_number=834406,
        has_geometry=True,
        geometry='{"type":"Point","coordinates":[10.0,20.0]}',
    )
    repository.get_hazards.return_value = []
    repository.get_goals.return_value = []
    repository.get_actions.return_value = []
    repository.get_projects.return_value = []
    repository.get_solutions.return_value = [
        PeerSolutions(
            disclosing_year=2025,
            target_org_id=834406,
            hazard_filter="All",
            solution_category="Engineered and built environment actions",
            solution="Install green roofs",
            action_rank=1,
            action_english="Install green roofs",
            action_index=1,
            hazard_addressed="Urban flooding",
            peer_org_cnt=1,
            action_count=1,
            pct_peers=50,
            has_local_action=None,
        )
    ]
    repository.get_solution_examples.return_value = []

    location_details_service = LocationDetailsService(repository, AsyncMock())
    app.dependency_overrides[get_location_details_service] = (
        lambda: location_details_service
    )

    response = await client.get("/api/v1/locations/id/834406")

    assert response.status_code == 200
    response_body = response.json()
    solution_cards = response_body["location"]["solutions"]["solutions"][
        "ENGINEERED_BUILT_ENVIRONMENT"
    ]
    assert solution_cards[0]["hasLocalAction"] is None
    repository.has_organization.assert_awaited_once_with(834406)
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_location_by_org_id_not_found(client, mock_location_details_service):
    mock_location_details_service.get_location_details_by_org_id.side_effect = (
        CityNotFoundException("999999")
    )

    app.dependency_overrides[get_location_details_service] = (
        lambda: mock_location_details_service
    )

    response = await client.get("/api/v1/locations/id/999999")

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

    response = await client.get("/api/v1/locations/names")

    assert response.status_code == 200
    assert response.json()["locations"] == [
        location.model_dump(by_alias=True) for location in expected_locations
    ]
    mock_location_details_service.get_all_location_summaries.assert_called_once_with()
    app.dependency_overrides.clear()
