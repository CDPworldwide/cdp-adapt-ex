from unittest.mock import AsyncMock

import pytest
from app.models.location_details import OrganizationSummary
from app.services.clients.database.location_details_repository import (
    LocationDetailsRepository,
)
from app.services.impls.city_resolution_service_impl import CityResolutionServiceImpl
from app.shared.exceptions import MultipleCitiesFoundException


class TestCityResolutionService:
    @pytest.fixture
    def mock_repository(self):
        return AsyncMock(spec=LocationDetailsRepository)

    @pytest.fixture
    def service(self, mock_repository):
        return CityResolutionServiceImpl(mock_repository)

    async def test_resolve_org_id_found(self, service, mock_repository):
        mock_repository.get_orgs_by_name.return_value = [OrganizationSummary(id=12345)]

        result = await service.resolve_org_id("Test City")
        assert result == 12345
        mock_repository.get_orgs_by_name.assert_called_once_with("Test City")

    async def test_resolve_org_id_not_found(self, service, mock_repository):
        mock_repository.get_orgs_by_name.return_value = []
        result = await service.resolve_org_id("Unknown City")
        assert result is None
        mock_repository.get_orgs_by_name.assert_called_once_with("Unknown City")

    async def test_resolve_org_id_multiple_found(self, service, mock_repository):
        mock_repository.get_orgs_by_name.return_value = [
            OrganizationSummary(
                id=1, name="City", country="Country A", population=1000
            ),
            OrganizationSummary(id=2, name="City", country="Country B", population=500),
        ]

        with pytest.raises(MultipleCitiesFoundException) as exc:
            await service.resolve_org_id("City")

        assert len(exc.value.candidates) == 2
        assert exc.value.candidates[0]["id"] == 1
        assert exc.value.candidates[1]["id"] == 2
