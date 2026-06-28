import httpx

from app.observability import LLMGenerationObservation, ObservabilityStatus
from app.raggle_otel import RaggleOtelClient, RaggleOtelSettings
from app.schemas import ChatCompletionRequest
from app.settings import get_settings


class FakeTransport:
    def __init__(self, statuses=None):
        self.statuses = list(statuses or [201, 201])
        self.requests = []

    def request(self, method, url, *, headers, json):
        self.requests.append(
            {"method": method, "url": url, "headers": headers, "json": json}
        )
        return httpx.Response(self.statuses.pop(0), json={"ok": True})

    def close(self):
        return None


def test_raggle_otel_client_creates_session_and_event():
    transport = FakeTransport()
    client = RaggleOtelClient(
        RaggleOtelSettings(
            enabled=True,
            base_url="https://otelapi.raggle.co",
            api_token="token",
            project_id="cdp-ai-server",
            capture_content=True,
        ),
        transport=transport,
    )

    assert client.capture_generation(
        name="gemini.generate_content",
        model="gemini-2.5-flash",
        model_parameters={"temperature": 0.2, "max_output_tokens": 100},
        input_payload={"messages": [{"role": "user", "content": "Hi"}]},
        output="Hello",
        usage_details={"prompt_tokens": 3, "completion_tokens": 4, "total_tokens": 7},
        metadata={"sessionId": "session-1", "userId": "user-1"},
        trace_id="session-1",
        span_id="span-1",
        latency_seconds=0.12,
    )

    assert transport.requests[0]["json"]["id"] == "session-1"
    event = transport.requests[1]["json"]
    assert event["name"] == "gemini.generate_content"
    assert event["attributes"]["raggle.project_id"] == "cdp-ai-server"
    assert event["attributes"]["gen_ai.usage.total_tokens"] == 7
    assert event["attributes"]["cdp.user_id"] == "user-1"


def test_observation_reports_capture_status():
    transport = FakeTransport()
    client = RaggleOtelClient(
        RaggleOtelSettings(
            enabled=True,
            base_url="https://otelapi.raggle.co",
            api_token="token",
            project_id="cdp-ai-server",
            capture_content=False,
        ),
        transport=transport,
    )
    status = ObservabilityStatus(raggle_otel_enabled=True, raggle_otel_configured=True)
    observation = LLMGenerationObservation(
        raggle_otel=client,
        status=status,
        name="gemini.generate_content",
        model="gemini-2.5-flash",
        model_parameters={"temperature": 0.2},
        input_payload={"messages": [{"role": "user", "content": "Hi"}]},
        metadata={"sessionId": "session-1"},
    )

    with observation as active:
        active.update(
            output="Hello",
            usage_details={"prompt_tokens": 3, "completion_tokens": 4},
        )

    assert status.last_raggle_otel_capture_status == "ok"
    assert status.last_raggle_otel_capture_trace_id == "session-1"
    attributes = transport.requests[1]["json"]["attributes"]
    assert "gen_ai.prompt" not in attributes
    assert "gen_ai.completion" not in attributes


def test_raggle_otel_settings(monkeypatch):
    monkeypatch.setenv("RAGGLE_OTEL_ENABLED", "true")
    monkeypatch.setenv("RAGGLE_OTEL_API_TOKEN", "token")
    monkeypatch.setenv("RAGGLE_OTEL_PROJECT_ID", "cdp-ai-server")
    monkeypatch.setenv("RAGGLE_OTEL_TIMEOUT_SECONDS", "5")
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.raggle_otel_enabled is True
    assert settings.raggle_otel_api_token == "token"
    assert settings.raggle_otel_project_id == "cdp-ai-server"
    assert settings.raggle_otel_timeout_seconds == 5

    get_settings.cache_clear()
