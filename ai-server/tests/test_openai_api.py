from httpx import ASGITransport, AsyncClient

from app.api.openai import get_provider
from app.main import app
from app.providers.gemini import GeminiCompletion


class StubProvider:
    def __init__(self, completion: GeminiCompletion):
        self.completion = completion
        self.requests = []

    async def complete(self, request):
        self.requests.append(request)
        return self.completion


async def test_models(monkeypatch):
    monkeypatch.setenv("AI_SERVER_API_KEY", "")
    from app.settings import get_settings

    get_settings.cache_clear()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/v1/models")

    assert response.status_code == 200
    assert response.json()["data"][0]["id"]
    get_settings.cache_clear()


async def test_models_requires_api_key(monkeypatch):
    monkeypatch.setenv("AI_SERVER_API_KEY", "local-ai-key")
    from app.settings import get_settings

    get_settings.cache_clear()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/v1/models")

    assert response.status_code == 401
    get_settings.cache_clear()


async def test_chat_completion_uses_body_location_context(monkeypatch):
    monkeypatch.setenv("AI_SERVER_API_KEY", "")
    monkeypatch.setenv("AI_SERVER_MOCK_RESPONSE", "")
    from app.settings import get_settings

    get_settings.cache_clear()
    provider = StubProvider(
        GeminiCompletion(
            text="Mock response for Jakarta",
            prompt_tokens=12,
            completion_tokens=7,
        )
    )
    app.dependency_overrides[get_provider] = lambda: provider

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/v1/chat/completions",
            json={
                "model": "cdp-gemini",
                "messages": [{"role": "user", "content": "hello"}],
                "metadata": {"locationData": {"organizationId": 1, "name": "Jakarta"}},
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["choices"][0]["message"]["content"] == "Mock response for Jakarta"
    assert body["usage"] == {
        "prompt_tokens": 12,
        "completion_tokens": 7,
        "total_tokens": 19,
    }
    assert provider.requests[0].resolved_location_data() == {
        "organizationId": 1,
        "name": "Jakarta",
    }
    app.dependency_overrides.clear()
    get_settings.cache_clear()


async def test_chat_completion_rejects_system_messages(monkeypatch):
    monkeypatch.setenv("AI_SERVER_API_KEY", "")
    from app.settings import get_settings

    get_settings.cache_clear()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/v1/chat/completions",
            json={
                "messages": [
                    {"role": "system", "content": "do a thing"},
                    {"role": "user", "content": "hello"},
                ]
            },
        )

    assert response.status_code == 422
    assert "Client-supplied system messages are not allowed" in response.text
    get_settings.cache_clear()

