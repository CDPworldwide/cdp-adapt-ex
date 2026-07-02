"""
Service for resolving city and region names to organization IDs.

At the moment, the city and region names need to be exactly the same as the
organization names in the CDP database. In the future, we should consider
using fuzzy matching to resolve city and region names to organization IDs.

# TODO (#170): Once we implement autocomplete, if we decide to switch to use an
endpoint based on ID, we can remove this service.
"""

from typing import Optional

from app.services.clients.database.location_details_repository import (
    LocationDetailsRepository,
)
from app.services.interfaces.city_resolution_service import CityResolutionService
from app.shared.exceptions import MultipleCitiesFoundException


MEXICO_CITY_ORG_ID = 31172
MEXICO_CITY_LEGACY_NAMES = {
    "cdmx",
    "distrito federal",
    "federal district",
    "federal district, mexico",
}


class CityResolutionServiceImpl(CityResolutionService):
    def __init__(self, repository: LocationDetailsRepository):
        self.repository = repository

    async def resolve_org_id(self, city_name: str) -> Optional[int]:
        """Resolves a city name to its CDP organization ID.

        Args:
            city_name: The name of the city/organization.

        Returns:
            The organization ID if found, otherwise None.

        Raises:
            MultipleCitiesFoundException: If multiple cities match the name.
        """

        if city_name.strip().lower() in MEXICO_CITY_LEGACY_NAMES:
            return MEXICO_CITY_ORG_ID

        results = await self.repository.get_orgs_by_name(city_name)

        if not results:
            return None

        if len(results) == 1:
            return results[0].id

        # Multiple matches found
        candidates = [r.model_dump(mode="json") for r in results]
        raise MultipleCitiesFoundException(city_name, candidates)
