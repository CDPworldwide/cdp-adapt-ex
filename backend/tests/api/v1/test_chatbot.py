from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.api.v1.deps import get_location_details_service
from app.main import app
from app.shared.config import settings
from app.schemas.chatbot import OpenAIChatCompletionRequest
from httpx import ASGITransport, AsyncClient


def _location_payload() -> dict:
    return {
        "organizationId": 123,
        "name": "City of Mumbai",
        "countryName": "India",
        "lat": 19.076,
        "lng": 72.8777,
        "geometry": {"type": "Point", "coordinates": [72.8777, 19.076]},
        "isReportingLeader": False,
        "hazards": {
            "statistics": {
                "populationExposedValue": None,
                "populationExposedPercentage": None,
                "gdpAtRiskValue": None,
                "gdpAtRiskPercentage": None,
                "gdpAtRiskCurrencyCode": None,
                "vulnerableSectors": [],
            },
            "hazards": [],
        },
        "governmentActions": {
            "goals": [],
            "actions": [],
            "projects": [],
        },
        "solutions": {
            "solutions": {},
        },
    }


@pytest.mark.asyncio
async def test_chat_completions_passes_location_data_to_llm_client(
    client, mock_llm_client
):
    payload = {
        "messages": [{"role": "user", "content": "What is Mumbai doing about heat?"}],
        "locationData": _location_payload(),
    }
    mock_response = MagicMock()
    mock_response.text = "Mumbai is expanding heat resilience measures."
    mock_response.usage_metadata = SimpleNamespace(
        prompt_token_count=10,
        candidates_token_count=5,
    )
    mock_llm_client.llm_chat_completion_response_async = AsyncMock(
        return_value=mock_response
    )

    response = await client.post("/api/v1/chats/completions", json=payload)

    assert response.status_code == 200
    mock_llm_client.llm_chat_completion_response_async.assert_called_once()

    called_request = mock_llm_client.llm_chat_completion_response_async.call_args[0][0]
    assert isinstance(called_request, OpenAIChatCompletionRequest)
    assert called_request.location_data is not None
    assert called_request.location_data.name == "Verified test location"
    assert called_request.location_data.country_name == "Test Country"
    assert called_request.location_data.geometry == {}


@pytest.mark.asyncio
async def test_chat_completions_coerces_missing_usage_counts(client, mock_llm_client):
    payload = {
        "messages": [{"role": "user", "content": "What is Mumbai doing about heat?"}],
        "locationData": _location_payload(),
    }
    mock_response = MagicMock()
    mock_response.text = "Mumbai is expanding heat resilience measures."
    mock_response.usage_metadata = SimpleNamespace(
        prompt_token_count=None,
        candidates_token_count=None,
    )
    mock_llm_client.llm_chat_completion_response_async = AsyncMock(
        return_value=mock_response
    )

    response = await client.post("/api/v1/chats/completions", json=payload)

    assert response.status_code == 200
    assert response.json()["usage"] == {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
    }


@pytest.mark.asyncio
async def test_chat_completions_requires_api_key(db_service, mock_llm_client):
    original_api_key = settings.API_KEY
    settings.API_KEY = "test-api-key"

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as unauthenticated_client:
        response = await unauthenticated_client.post(
            "/api/v1/chats/completions",
            json={
                "messages": [{"role": "user", "content": "Hello"}],
                "locationData": _location_payload(),
            },
        )

    settings.API_KEY = original_api_key
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_chat_completions_rejects_unknown_location_id(client, mock_llm_client):
    mock_location_service = MagicMock()
    mock_location_service.get_location_details_by_org_id = AsyncMock(
        side_effect=Exception("not used")
    )

    async def raise_not_found(_organization_id: int):
        from app.shared.exceptions import CityNotFoundException

        raise CityNotFoundException("999999")

    mock_location_service.get_location_details_by_org_id.side_effect = raise_not_found
    app.dependency_overrides[get_location_details_service] = lambda: mock_location_service

    response = await client.post(
        "/api/v1/chats/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "locationData": {**_location_payload(), "organizationId": 999999},
        },
    )

    assert response.status_code == 400
    assert "organizationId" in response.json()["detail"]


@pytest.mark.asyncio
async def test_chat_completions_rejects_too_many_messages(client):
    response = await client.post(
        "/api/v1/chats/completions",
        json={
            "messages": [
                {"role": "user", "content": f"message {i}"} for i in range(51)
            ],
            "locationData": _location_payload(),
        },
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_completions_rejects_excessive_max_tokens(client):
    response = await client.post(
        "/api/v1/chats/completions",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "locationData": _location_payload(),
            "max_tokens": 2001,
        },
    )

    assert response.status_code == 422
