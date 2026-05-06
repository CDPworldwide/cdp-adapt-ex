import os
from unittest.mock import MagicMock, patch

import pytest
from app.api.v1.deps import (
    get_database_service,
    get_location_details_service,
    get_location_details_repository,
)
from app.main import app
from app.schemas.location import ActionsTab, HazardsTab, LocationProfile, SolutionsTab
from app.services.clients.database.base import DatabaseService
from app.services.clients.database.location_details_repository import (
    LocationDetailsRepository,
)
from app.shared.config import settings
from httpx import ASGITransport, AsyncClient
from sqlmodel import SQLModel, create_engine

# Use a test database URL
TEST_DATABASE_URL = "sqlite:///./test.db"
TEST_API_KEY = "test-api-key"


@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine(TEST_DATABASE_URL, echo=False)
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)
    if os.path.exists("./test.db"):
        os.remove("./test.db")


@pytest.fixture
def db_service(db_engine):
    service = DatabaseService()
    service.engine = db_engine
    return service


@pytest.fixture
def location_details_repo(db_engine):
    return LocationDetailsRepository(db_engine)


@pytest.fixture
async def client(db_service):
    original_api_key = settings.API_KEY
    settings.API_KEY = TEST_API_KEY

    def override_get_database_service():
        return db_service

    def override_get_location_details_repository():
        return LocationDetailsRepository(db_service.engine)

    mock_location_service = MagicMock()

    async def get_location_details_by_org_id(organization_id: int):
        return LocationProfile(
            organization_id=organization_id,
            name="Verified test location",
            country_name="Test Country",
            lat=0,
            lng=0,
            geometry={"type": "Point", "coordinates": [0, 0]},
            hazards=HazardsTab(statistics={}),
            government_actions=ActionsTab(),
            solutions=SolutionsTab(),
        )

    mock_location_service.get_location_details_by_org_id.side_effect = (
        get_location_details_by_org_id
    )

    def override_get_location_details_service():
        return mock_location_service

    # Note: this maps to the depends function used in the routes, so we can mock
    # the LLMClient as well
    app.dependency_overrides[get_database_service] = override_get_database_service
    app.dependency_overrides[get_location_details_service] = (
        override_get_location_details_service
    )
    app.dependency_overrides[get_location_details_repository] = (
        override_get_location_details_repository
    )

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={settings.API_KEY_HEADER_NAME: TEST_API_KEY},
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
    settings.API_KEY = original_api_key


# Patch the create_engine function from sqlmodel to prevent actual db connections
mock_create_engine_patch = patch("sqlmodel.create_engine", autospec=True)


def pytest_configure(config):
    """
    Pytest hook to configure and patch settings before tests are collected.

    This automatically mocks the create_engine function for all tests to
    prevent real database connections during test sessions.
    """
    # Start the patch
    MockCreateEngine = mock_create_engine_patch.start()

    # Configure the mock to return a mock engine
    mock_engine = MagicMock()
    MockCreateEngine.return_value = mock_engine


def pytest_unconfigure(config):
    """
    Pytest hook to unconfigure and stop patches after tests are finished.
    """
    mock_create_engine_patch.stop()
