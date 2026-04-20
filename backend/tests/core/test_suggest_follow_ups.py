from types import SimpleNamespace

import pytest
from app.core.suggest_follow_ups import (
    SuggestFollowUps,
    build_follow_up_selection_message,
    load_approved_follow_up_question_catalog,
    parse_follow_up_questions_from_text,
    select_candidate_questions,
)
from app.schemas.chatbot import OpenAIChatCompletionRequest, OpenAIChatMessage


def _chat_request() -> OpenAIChatCompletionRequest:
    return OpenAIChatCompletionRequest.model_validate(
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

    assert isinstance(message, OpenAIChatMessage)
    assert message.role == "user"
    assert "Candidates:" in message.content
    assert "Return raw JSON only." in message.content
    assert "What hazards are on the rise?" in message.content


def test_build_request_appends_selection_message():
    service = SuggestFollowUps(llm_client=object())

    request = service.build_request(_chat_request())

    assert len(request.messages) == 2
    assert request.messages[0].content == "What should I ask next?"
    assert "Select exactly 3 follow-up questions" in (request.messages[1].content)
    assert request.location_data is not None
    assert request.location_data.geometry == {}


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


def test_parse_follow_up_questions_from_plain_text_matches():
    catalog = load_approved_follow_up_question_catalog()

    response = parse_follow_up_questions_from_text(
        "Try these next:\n"
        "1. What hazards are on the rise?\n"
        "2. What hazards does this location face in severity order?\n"
        "3. What percentage of GDP is at risk?",
        catalog,
    )

    assert response.follow_up_questions == [
        "What hazards are on the rise?",
        "What hazards does this location face in severity order?",
        "What percentage of GDP is at risk?",
    ]


def test_parse_response_uses_text_recovery():
    service = SuggestFollowUps(llm_client=object())

    response = service.parse_response(
        SimpleNamespace(
            parsed=None,
            text=(
                "Here is the JSON requested:\n"
                '{"follow_up_questions":["What hazards are on the rise?",'
                '"What percentage of GDP is at risk?",'
                '"Which hazards are expected to have the highest financial impact?"]}'
            ),
        )
    )

    assert response.follow_up_questions == [
        "What hazards are on the rise?",
        "What percentage of GDP is at risk?",
        "Which hazards are expected to have the highest financial impact?",
    ]


def test_parse_follow_up_questions_raises_for_unrecoverable_text():
    catalog = load_approved_follow_up_question_catalog()

    with pytest.raises(Exception):
        parse_follow_up_questions_from_text("{", catalog)
