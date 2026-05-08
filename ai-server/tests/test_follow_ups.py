from types import SimpleNamespace

from httpx import ASGITransport, AsyncClient

from app.api.follow_ups import get_location_verifier, get_provider
from app.follow_ups import (
    build_follow_up_request,
    build_follow_up_selection_message,
    load_approved_follow_up_question_catalog,
    parse_follow_up_questions_from_text,
    select_candidate_questions,
)
from app.main import app
from app.schemas import ChatCompletionRequest, SuggestFollowUpsResponse


class StubProvider:
    def __init__(self, response):
        self.response = response

    async def generate(
        self, request, prompt_name="system_prompt.md", response_schema=None
    ):
        return self.response


class StubLocationVerifier:
    async def verify_chat_request(self, request):
        return request.with_resolved_location_data(
            {
                "organizationId": 123,
                "name": "City of Mumbai",
                "countryName": "India",
                "lat": 19.076,
                "lng": 72.8777,
                "geometry": {},
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
        )


def _chat_request() -> ChatCompletionRequest:
    return ChatCompletionRequest.model_validate(
        {
            "messages": [{"role": "user", "content": "What should I ask next?"}],
            "locationData": {
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
            },
        }
    )


def test_load_approved_follow_up_question_catalog():
    catalog = load_approved_follow_up_question_catalog()
    assert len(catalog.questions) == 13
    assert catalog.questions[0].question == (
        "Which actions have the highest positive impact for vulnerable populations?"
    )


def test_build_follow_up_selection_message():
    catalog = load_approved_follow_up_question_catalog()
    candidate_questions = select_candidate_questions(_chat_request(), catalog)
    message = build_follow_up_selection_message(candidate_questions)
    assert message.role == "user"
    assert "Candidates:" in message.text_content()
    assert "What hazards are on the rise?" in message.text_content()


def test_build_follow_up_request_appends_selection_message():
    request = build_follow_up_request(_chat_request())
    assert len(request.messages) == 2
    assert request.messages[0].text_content() == "What should I ask next?"
    assert "Select exactly 3 follow-up questions" in request.messages[1].text_content()
    assert request.location_data is not None
    assert request.location_data["geometry"] == {}


def test_select_candidate_questions_uses_context_area_bias():
    catalog = load_approved_follow_up_question_catalog()
    request = ChatCompletionRequest.model_validate(
        {
            "messages": [{"role": "user", "content": "What should I ask next?"}],
            "locationData": {
                **_chat_request().resolved_location_data(),
                "contextArea": "solutions",
            },
            "contextArea": "solutions",
        }
    )

    candidate_questions = select_candidate_questions(request, catalog, limit=3)

    assert all(question.question_type == "Actions" for question in candidate_questions)


def test_parse_follow_up_questions_from_wrapped_json():
    catalog = load_approved_follow_up_question_catalog()
    response = parse_follow_up_questions_from_text(
        'Here is the JSON requested:\n```json\n{"follow_up_questions":'
        '["What hazards are on the rise?","What percentage of GDP is at risk?",'
        '"Which hazards are expected to have the highest financial impact?"]}\n```',
        catalog,
    )
    assert response.follow_up_questions == [
        "What hazards are on the rise?",
        "What percentage of GDP is at risk?",
        "Which hazards are expected to have the highest financial impact?",
    ]


async def test_suggest_follow_ups_endpoint(monkeypatch):
    monkeypatch.setenv("AI_SERVER_API_KEY", "")
    from app.settings import get_settings

    get_settings.cache_clear()
    app.dependency_overrides[get_provider] = lambda: StubProvider(
        SimpleNamespace(
            parsed=SuggestFollowUpsResponse(
                follow_up_questions=[
                    "What hazards are on the rise?",
                    "What percentage of GDP is at risk?",
                    "Which hazards are expected to have the highest financial impact?",
                ]
            ),
            text="",
        )
    )
    app.dependency_overrides[get_location_verifier] = lambda: StubLocationVerifier()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/v1/suggest-follow-ups",
            json={
                "messages": [{"role": "user", "content": "What should I ask next?"}],
                "locationData": {"organizationId": 123},
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "follow_up_questions": [
            "What hazards are on the rise?",
            "What percentage of GDP is at risk?",
            "Which hazards are expected to have the highest financial impact?",
        ]
    }
    app.dependency_overrides.clear()
    get_settings.cache_clear()
