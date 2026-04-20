import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.schemas.chatbot import OpenAIChatCompletionRequest
from app.schemas.suggest_follow_ups import SuggestFollowUpsResponse
from app.shared.config import settings


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
async def test_suggest_follow_ups_success(client, mock_llm_client):
    payload = {
        "messages": [{"role": "user", "content": "What are the next steps?"}],
        "locationData": _location_payload(),
    }

    mock_response = MagicMock()
    mock_response.text = json.dumps(
        {
            "follow_up_questions": [
                "What hazards are on the rise?",
                "What percentage of GDP is at risk?",
                "Which hazards are expected to have the highest financial impact?",
            ]
        }
    )
    mock_llm_client.llm_chat_completion_response_async = AsyncMock(
        return_value=mock_response
    )

    response = await client.post("/api/v1/suggest-follow-ups", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "follow_up_questions" in data
    assert data["follow_up_questions"] == [
        "What hazards are on the rise?",
        "What percentage of GDP is at risk?",
        "Which hazards are expected to have the highest financial impact?",
    ]

    # Verify mocks were called
    mock_llm_client.llm_chat_completion_response_async.assert_called_once()
    call_args = mock_llm_client.llm_chat_completion_response_async.call_args[0]
    assert call_args[1] == "suggest_follow_ups.md"
    assert call_args[2] is SuggestFollowUpsResponse
    called_request = call_args[0]
    assert isinstance(called_request, OpenAIChatCompletionRequest)
    assert called_request.messages[0].content == "What are the next steps?"
    assert called_request.messages[-1].content.startswith(
        "Select exactly 3 follow-up questions"
    )
    assert "What hazards are on the rise?" in called_request.messages[-1].content
    assert called_request.max_tokens == settings.SUGGEST_FOLLOW_UPS_MAX_TOKENS


@pytest.mark.asyncio
async def test_suggest_follow_ups_uses_parsed_response(client, mock_llm_client):
    payload = {
        "messages": [{"role": "user", "content": "What should I ask next?"}],
        "locationData": _location_payload(),
    }

    mock_response = MagicMock()
    mock_response.text = '{"follow_up_questions": ["truncated'
    mock_response.parsed = SuggestFollowUpsResponse(
        follow_up_questions=[
            "What climate risks are highest here?",
            "Which city actions are already underway?",
            "What funding options support these actions?",
        ]
    )
    mock_llm_client.llm_chat_completion_response_async = AsyncMock(
        return_value=mock_response
    )

    response = await client.post("/api/v1/suggest-follow-ups", json=payload)

    assert response.status_code == 200
    assert response.json() == {
        "follow_up_questions": [
            "What climate risks are highest here?",
            "Which city actions are already underway?",
            "What funding options support these actions?",
        ]
    }


@pytest.mark.asyncio
async def test_suggest_follow_ups_recovers_wrapped_json_text(client, mock_llm_client):
    payload = {
        "messages": [{"role": "user", "content": "What should I ask next?"}],
        "locationData": _location_payload(),
    }

    mock_response = MagicMock()
    mock_response.parsed = None
    mock_response.text = (
        'Here is the JSON requested:\n```json\n{"follow_up_questions":'
        '["What hazards are on the rise?",'
        '"What percentage of GDP is at risk?",'
        '"Which hazards are expected to have the highest financial impact?"]}\n```'
    )
    mock_llm_client.llm_chat_completion_response_async = AsyncMock(
        return_value=mock_response
    )

    response = await client.post("/api/v1/suggest-follow-ups", json=payload)

    assert response.status_code == 200
    assert response.json() == {
        "follow_up_questions": [
            "What hazards are on the rise?",
            "What percentage of GDP is at risk?",
            "Which hazards are expected to have the highest financial impact?",
        ]
    }


@pytest.mark.asyncio
async def test_suggest_follow_ups_recovers_exact_questions_from_plain_text(
    client, mock_llm_client
):
    payload = {
        "messages": [{"role": "user", "content": "What should I ask next?"}],
        "locationData": _location_payload(),
    }

    mock_response = MagicMock()
    mock_response.parsed = None
    mock_response.text = (
        "Try these next:\n"
        "1. What hazards are on the rise?\n"
        "2. What hazards does this location face in severity order?\n"
        "3. What percentage of GDP is at risk?"
    )
    mock_llm_client.llm_chat_completion_response_async = AsyncMock(
        return_value=mock_response
    )

    response = await client.post("/api/v1/suggest-follow-ups", json=payload)

    assert response.status_code == 200
    assert response.json() == {
        "follow_up_questions": [
            "What hazards are on the rise?",
            "What hazards does this location face in severity order?",
            "What percentage of GDP is at risk?",
        ]
    }


@pytest.mark.asyncio
async def test_suggest_follow_ups_error(client, mock_llm_client):
    # Mock an error in the LLM client
    mock_llm_client.llm_chat_completion_response_async = AsyncMock(
        side_effect=Exception("LLM Error")
    )

    payload = {
        "messages": [{"role": "user", "content": "Trigger error"}],
        "locationData": _location_payload(),
    }

    response = await client.post("/api/v1/suggest-follow-ups", json=payload)

    assert response.status_code == 500
    assert response.json()["detail"] == "An unexpected error occurred"
