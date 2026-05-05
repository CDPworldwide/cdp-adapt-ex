import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.openai import get_location_verifier, get_provider
from app.main import app
from app.providers.gemini import GeminiCompletion
from utility_scripts.run_chat_eval import load_cases_from_questions_file


ROOT = Path(__file__).resolve().parents[1]
REVIEWED_CASES = load_cases_from_questions_file(
    ROOT / "data" / "questions.json", ROOT / "org-data"
)


class RecordingProvider:
    def __init__(self):
        self.requests = []

    async def complete(self, request):
        self.requests.append(request)
        location = request.resolved_location_data() or {}
        return GeminiCompletion(text=f"Stub response for {location.get('name')}")


class OrgDataVerifier:
    async def verify_chat_request(self, request):
        location_data = request.resolved_location_data() or {}
        org_id = location_data.get("organizationId")
        payload = json.loads((ROOT / "org-data" / f"{org_id}.json").read_text())
        payload["geometry"] = {}
        return request.with_resolved_location_data(payload)


@pytest.mark.parametrize(
    "case",
    REVIEWED_CASES,
    ids=[case["id"] for case in REVIEWED_CASES],
)
async def test_reviewed_questions_replay_through_chat_endpoint(case, monkeypatch):
    monkeypatch.setenv("AI_SERVER_API_KEY", "")
    from app.settings import get_settings

    get_settings.cache_clear()
    provider = RecordingProvider()
    app.dependency_overrides[get_provider] = lambda: provider
    app.dependency_overrides[get_location_verifier] = lambda: OrgDataVerifier()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/v1/chat/completions",
            json={
                "messages": [{"role": "user", "content": case["question"]}],
                "locationData": case["locationData"],
            },
        )

    assert response.status_code == 200
    content = response.json()["choices"][0]["message"]["content"]
    if case["question"] == "Clicked on the AI button directly":
        assert "What would you like to know" in content
        assert provider.requests == []
    else:
        assert len(provider.requests) == 1
        request_location = provider.requests[0].resolved_location_data()
        assert request_location["organizationId"] == case["locationData"]["organizationId"]
        assert request_location["name"] == case["locationData"]["name"]
        assert request_location["geometry"] == {}

    app.dependency_overrides.clear()
    get_settings.cache_clear()
