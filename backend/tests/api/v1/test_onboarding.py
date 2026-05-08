from unittest.mock import AsyncMock, MagicMock

import pytest
from app.api.v1.deps import get_onboarding_repository
from app.main import app
from app.services.clients.database.onboarding_repository import OnboardingRepository


@pytest.fixture
def mock_onboarding_repo():
    repo = MagicMock(spec=OnboardingRepository)
    repo.insert_role_selection = AsyncMock(return_value=None)
    return repo


def _override(repo):
    app.dependency_overrides[get_onboarding_repository] = lambda: repo


@pytest.mark.asyncio
async def test_record_role_selection_success(client, mock_onboarding_repo):
    _override(mock_onboarding_repo)

    response = await client.post(
        "/api/v1/onboarding/role",
        json={"role": "ngo"},
        headers={"x-forwarded-for": "203.0.113.7, 10.0.0.1", "user-agent": "ua/1.0"},
    )

    assert response.status_code == 204
    mock_onboarding_repo.insert_role_selection.assert_awaited_once_with(
        role="ngo",
        ip_address="203.0.113.7",
        user_agent="ua/1.0",
    )
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_record_role_selection_falls_back_to_client_host(
    client, mock_onboarding_repo
):
    _override(mock_onboarding_repo)

    response = await client.post(
        "/api/v1/onboarding/role",
        json={"role": "business"},
    )

    assert response.status_code == 204
    call = mock_onboarding_repo.insert_role_selection.await_args
    assert call.kwargs["role"] == "business"
    # httpx ASGITransport sets request.client to ("127.0.0.1", port).
    assert call.kwargs["ip_address"] == "127.0.0.1"
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_record_role_selection_rejects_unknown_role(
    client, mock_onboarding_repo
):
    _override(mock_onboarding_repo)

    response = await client.post(
        "/api/v1/onboarding/role",
        json={"role": "not-a-real-role"},
    )

    assert response.status_code == 422
    mock_onboarding_repo.insert_role_selection.assert_not_called()
    app.dependency_overrides.clear()
