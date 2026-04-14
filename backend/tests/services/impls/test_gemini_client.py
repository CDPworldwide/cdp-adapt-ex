from app.schemas.chatbot import OpenAIChatCompletionRequest
from app.services.impls.gemini_client import GeminiLLMClient


def _chat_request() -> OpenAIChatCompletionRequest:
    return OpenAIChatCompletionRequest.model_validate(
        {
            "messages": [{"role": "user", "content": "What should I ask next?"}],
            "locationData": {
                "organizationId": 12345,
                "name": "City of Chicago",
                "countryName": "United States of America",
                "lat": 41.84,
                "lng": -87.60,
                "geometry": {"type": "Point", "coordinates": [-87.60, 41.84]},
                "isReportingLeader": False,
                "hazards": {
                    "statistics": {
                        "populationExposedValue": None,
                        "populationExposedPercentage": 50,
                        "gdpAtRiskValue": None,
                        "gdpAtRiskPercentage": 25,
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
            },
        }
    )


def test_build_generation_config_disables_thinking_for_suggest_follow_ups(monkeypatch):
    monkeypatch.setattr(
        "app.services.impls.gemini_client.build_system_prompt",
        lambda file_name, location_data: "SYSTEM PROMPT",
    )
    client = GeminiLLMClient()

    config = client.build_generation_config(
        _chat_request(),
        "suggest_follow_ups.md",
    )

    assert config.temperature == 0.0
    assert config.thinking_config is not None
    assert config.thinking_config.thinking_budget == 0


def test_build_generation_config_uses_default_temperature_for_chat(monkeypatch):
    monkeypatch.setattr(
        "app.services.impls.gemini_client.build_system_prompt",
        lambda file_name, location_data: "SYSTEM PROMPT",
    )
    client = GeminiLLMClient()

    config = client.build_generation_config(
        _chat_request(),
        "system_prompt.md",
    )

    assert config.temperature > 0.0
    assert config.thinking_config is None
