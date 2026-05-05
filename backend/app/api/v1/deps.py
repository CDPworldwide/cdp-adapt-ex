from functools import lru_cache

from app.services.clients.database import DatabaseService, database_service
from app.services.clients.database.disclosure_trends_repository import (
    DisclosureTrendsRepository,
)
from app.services.clients.database.location_details_repository import (
    LocationDetailsRepository,
)
from app.services.clients.earth_engine_client import EarthEngineClient
from app.services.clients.translate_client import TranslateClient, translate_client
from app.services.impls.city_resolution_service_impl import CityResolutionServiceImpl
from app.services.impls.discloser_client_impl import discloser_client
from app.services.impls.earth_engine_hazard_data_provider_impl import (
    EarthEngineHazardDataProviderImpl,
)
from app.services.impls.gemini_client import gemini_service
from app.services.impls.location_details_service import LocationDetailsService
from app.services.interfaces.city_resolution_service import CityResolutionService
from app.services.interfaces.discloser_client import DiscloserClient
from app.services.interfaces.hazard_data_provider_interface import (
    HazardDataProviderInterface,
)
from app.services.interfaces.llm_client import LLMClient


def get_database_service() -> DatabaseService:
    """Dependency that returns the DatabaseService instance."""
    return database_service


def get_location_details_repository() -> LocationDetailsRepository:
    """Dependency that provides the LocationDetailsRepository instance."""
    return LocationDetailsRepository(database_service.engine)


def get_disclosure_trends_repository() -> DisclosureTrendsRepository:
    """Dependency that provides the DisclosureTrendsRepository instance."""
    return DisclosureTrendsRepository(database_service.engine)


def get_city_resolution_service() -> CityResolutionService:
    """Dependency that provides the CityResolutionService instance."""
    return CityResolutionServiceImpl(get_location_details_repository())


def get_location_details_service() -> LocationDetailsService:
    """Dependency that provides the LocationDetailsService instance."""
    return LocationDetailsService(
        get_location_details_repository(), get_city_resolution_service()
    )


def get_llm_client() -> LLMClient:
    """Dependency that returns the LLMClient instance."""
    return gemini_service


def get_discloser_client() -> DiscloserClient:
    """Dependency that returns the DiscloserClient instance."""
    return discloser_client


@lru_cache(maxsize=None)
def get_earth_engine_client() -> EarthEngineClient:
    """Returns an EarthEngineClient instance."""
    return EarthEngineClient()


def get_earth_engine_hazard_data_provider() -> HazardDataProviderInterface:
    """Returns an EarthEngineHazardDataProviderImpl instance."""
    return EarthEngineHazardDataProviderImpl(get_earth_engine_client())


def get_translate_client() -> TranslateClient:
    """Dependency that returns the TranslateClient instance."""
    return translate_client
