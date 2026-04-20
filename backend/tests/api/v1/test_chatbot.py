from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.schemas.chatbot import OpenAIChatCompletionRequest


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
    assert called_request.location_data.name == "City of Mumbai"
    assert called_request.location_data.country_name == "India"
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
