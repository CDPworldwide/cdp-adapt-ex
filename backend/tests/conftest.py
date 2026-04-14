import os
from unittest.mock import MagicMock, patch

import pytest
from app.api.v1.deps import (
    get_database_service,
    get_llm_client,
    get_location_details_repository,
)
from app.main import app
from app.services.clients.database.base import DatabaseService
from app.services.clients.database.location_details_repository import (
    LocationDetailsRepository,
)
from app.services.impls.gemini_client import GeminiLLMClient
from httpx import ASGITransport, AsyncClient
from sqlmodel import SQLModel, create_engine

# Use a test database URL
TEST_DATABASE_URL = "sqlite:///./test.db"


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
def mock_llm_client():
    mock = MagicMock(spec=GeminiLLMClient)
    mock.llm_chat_completion_response_sync.return_value = "Mocked LLM Response"
    return mock


@pytest.fixture
async def client(db_service, mock_llm_client):
    def override_get_database_service():
        return db_service

    def override_get_llm_client():
        return mock_llm_client

    def override_get_location_details_repository():
        return LocationDetailsRepository(db_service.engine)

    # Note: this maps to the depends function used in the routes, so we can mock
    # the LLMClient as well
    app.dependency_overrides[get_database_service] = override_get_database_service
    app.dependency_overrides[get_llm_client] = override_get_llm_client
    app.dependency_overrides[get_location_details_repository] = (
        override_get_location_details_repository
    )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


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
