import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import pydantic
from pydantic import BaseModel, Field

from app.schemas import ChatCompletionRequest, ChatMessage, SuggestFollowUpsResponse


class ApprovedFollowUpQuestion(BaseModel):
    id: int
    question_type: str
    likelihood: str
    likelihood_rank: int = Field(ge=0, le=3)
    question: str = Field(min_length=1, max_length=120)


class ApprovedFollowUpQuestionCatalog(BaseModel):
    source_csv: str
    selection_rule: str
    questions: list[ApprovedFollowUpQuestion] = Field(min_length=1)


FOLLOW_UP_CANDIDATE_COUNT = 8
FOLLOW_UP_SELECTION_COUNT = 3
FOLLOW_UP_SUMMARY_ITEM_LIMIT = 3
QUESTION_TYPE_BIAS_BOOST = 3
STOP_WORDS = {
    "about",
    "already",
    "and",
    "any",
    "are",
    "ask",
    "best",
    "biggest",
    "can",
    "city",
    "for",
    "from",
    "here",
    "how",
    "into",
    "its",
    "next",
    "should",
    "steps",
    "tell",
    "that",
    "the",
    "them",
    "there",
    "these",
    "this",
    "what",
    "which",
    "with",
}
APPROVED_FOLLOW_UP_QUESTIONS_PATH = (
    Path(__file__).with_name("data") / "approved_follow_up_questions.json"
)


@lru_cache(maxsize=1)
def load_approved_follow_up_question_catalog() -> ApprovedFollowUpQuestionCatalog:
    return ApprovedFollowUpQuestionCatalog.model_validate_json(
        APPROVED_FOLLOW_UP_QUESTIONS_PATH.read_text(encoding="utf-8")
    )


def extract_latest_user_query(chat_request: ChatCompletionRequest) -> str:
    for message in reversed(chat_request.messages):
        if message.role == "user":
            return message.text_content()
    return ""


def _tokenize(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.lower())
        if len(token) >= 3 and token not in STOP_WORDS
    }


def _question_type_bias(
    query_text: str,
    question: ApprovedFollowUpQuestion,
    context_area: str | None = None,
) -> int:
    if context_area == "hazards" and question.question_type == "Hazards":
        return QUESTION_TYPE_BIAS_BOOST
    if context_area in {"actions", "solutions"} and question.question_type == "Actions":
        return QUESTION_TYPE_BIAS_BOOST

    lowered_query = query_text.lower()
    if question.question_type == "Hazards":
        if any(
            keyword in lowered_query
            for keyword in ("hazard", "risk", "heat", "flood", "storm", "gdp")
        ):
            return QUESTION_TYPE_BIAS_BOOST
    if question.question_type == "Actions":
        if any(
            keyword in lowered_query
            for keyword in (
                "action",
                "goal",
                "plan",
                "project",
                "fund",
                "funding",
                "support",
                "initiative",
            )
        ):
            return QUESTION_TYPE_BIAS_BOOST
    return 0


def _candidate_sort_key(
    question: ApprovedFollowUpQuestion,
    query_text: str,
    query_tokens: set[str],
    context_area: str | None = None,
) -> tuple[int, int, int]:
    token_overlap = len(query_tokens & _tokenize(question.question))
    latest_turn_relevance = token_overlap + _question_type_bias(
        query_text, question, context_area
    )
    return (-latest_turn_relevance, -question.likelihood_rank, question.id)


def select_candidate_questions(
    chat_request: ChatCompletionRequest,
    catalog: ApprovedFollowUpQuestionCatalog,
    limit: int = FOLLOW_UP_CANDIDATE_COUNT,
) -> list[ApprovedFollowUpQuestion]:
    query_text = extract_latest_user_query(chat_request)
    query_tokens = _tokenize(query_text)
    context_area = chat_request.resolved_context_area()
    ranked_questions = sorted(
        catalog.questions,
        key=lambda question: _candidate_sort_key(
            question, query_text, query_tokens, context_area
        ),
    )
    return ranked_questions[:limit]


def summarize_location_data_for_follow_ups(
    location_data: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if location_data is None:
        return None

    statistics = (location_data.get("hazards") or {}).get("statistics") or {}
    government_actions = location_data.get("governmentActions") or {}
    solutions = (location_data.get("solutions") or {}).get("solutions") or {}

    return {
        "organizationId": location_data.get("organizationId"),
        "name": location_data.get("name"),
        "countryName": location_data.get("countryName"),
        "lat": location_data.get("lat"),
        "lng": location_data.get("lng"),
        "geometry": {},
        "isReportingLeader": location_data.get("isReportingLeader", False),
        "disclosureYear": location_data.get("disclosureYear"),
        "requesters": (location_data.get("requesters") or [])[
            :FOLLOW_UP_SUMMARY_ITEM_LIMIT
        ],
        "population": location_data.get("population"),
        "hazards": {
            "statistics": {
                "populationExposedValue": statistics.get("populationExposedValue"),
                "populationExposedPercentage": statistics.get(
                    "populationExposedPercentage"
                ),
                "gdpAtRiskValue": statistics.get("gdpAtRiskValue"),
                "gdpAtRiskPercentage": statistics.get("gdpAtRiskPercentage"),
                "gdpAtRiskCurrencyCode": statistics.get("gdpAtRiskCurrencyCode"),
                "vulnerableSectors": (statistics.get("vulnerableSectors") or [])[
                    :FOLLOW_UP_SUMMARY_ITEM_LIMIT
                ],
            },
            "hazards": [
                {
                    "hazard": hazard.get("hazard"),
                    "hazardRank": hazard.get("hazardRank"),
                    "vulnerableGroups": (hazard.get("vulnerableGroups") or [])[
                        :FOLLOW_UP_SUMMARY_ITEM_LIMIT
                    ],
                    "mostExposedSectors": (hazard.get("mostExposedSectors") or [])[
                        :FOLLOW_UP_SUMMARY_ITEM_LIMIT
                    ],
                }
                for hazard in (
                    (location_data.get("hazards") or {}).get("hazards") or []
                )[:FOLLOW_UP_SUMMARY_ITEM_LIMIT]
            ],
        },
        "governmentActions": {
            "goals": [
                {
                    "title": goal.get("title"),
                    "targetYear": goal.get("targetYear"),
                    "hazardsAddressed": (goal.get("hazardsAddressed") or [])[
                        :FOLLOW_UP_SUMMARY_ITEM_LIMIT
                    ],
                }
                for goal in (government_actions.get("goals") or [])[
                    :FOLLOW_UP_SUMMARY_ITEM_LIMIT
                ]
            ],
            "actions": [
                {
                    "title": action.get("title"),
                    "status": action.get("status"),
                    "hazardsAddressed": (action.get("hazardsAddressed") or [])[
                        :FOLLOW_UP_SUMMARY_ITEM_LIMIT
                    ],
                    "impactedSectors": (action.get("impactedSectors") or [])[
                        :FOLLOW_UP_SUMMARY_ITEM_LIMIT
                    ],
                }
                for action in (government_actions.get("actions") or [])[
                    :FOLLOW_UP_SUMMARY_ITEM_LIMIT
                ]
            ],
            "projects": [
                {
                    "title": project.get("title"),
                    "status": project.get("status"),
                    "financeStatus": project.get("financeStatus"),
                    "fundedPercent": project.get("fundedPercent"),
                }
                for project in (government_actions.get("projects") or [])[
                    :FOLLOW_UP_SUMMARY_ITEM_LIMIT
                ]
            ],
        },
        "solutions": {
            "solutions": {
                category: [
                    {"solution": card.get("solution")}
                    for card in cards[:FOLLOW_UP_SUMMARY_ITEM_LIMIT]
                ]
                for category, cards in solutions.items()
            }
        },
    }


def build_follow_up_selection_message(
    candidate_questions: list[ApprovedFollowUpQuestion],
) -> ChatMessage:
    candidate_lines = [
        (
            f"{index}. [{question.question_type} | {question.likelihood}] "
            f'"{question.question}"'
        )
        for index, question in enumerate(candidate_questions, start=1)
    ]
    return ChatMessage(
        role="user",
        content=(
            f"Select exactly {FOLLOW_UP_SELECTION_COUNT} follow-up questions from the candidates below.\n"
            "Return raw JSON only.\n"
            'Use this exact shape: {"follow_up_questions":["q1","q2","q3"]}\n'
            "Copy questions exactly from the candidate list.\n"
            "Do not add prose, markdown, code fences, numbering, or extra keys.\n"
            "Prioritize follow-ups that best continue the user's latest question.\n"
            "Prefer higher-likelihood candidates when relevance is otherwise similar.\n\n"
            "Candidates:\n"
            f"{chr(10).join(candidate_lines)}"
        ),
    )


def _extract_json_object(text: str) -> str | None:
    start = text.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False

    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]

    return None


def parse_follow_up_questions_from_text(
    text: str,
    catalog: ApprovedFollowUpQuestionCatalog,
) -> SuggestFollowUpsResponse:
    cleaned_text = text.strip()
    if not cleaned_text:
        raise pydantic.ValidationError.from_exception_data(
            "SuggestFollowUpsResponse",
            [
                {
                    "type": "value_error",
                    "loc": ("follow_up_questions",),
                    "msg": "LLM response was empty",
                    "input": cleaned_text,
                    "ctx": {"error": "LLM response was empty"},
                }
            ],
        )

    try:
        return SuggestFollowUpsResponse.model_validate_json(cleaned_text)
    except pydantic.ValidationError:
        pass

    extracted_json = _extract_json_object(cleaned_text)
    if extracted_json:
        try:
            return SuggestFollowUpsResponse.model_validate_json(extracted_json)
        except pydantic.ValidationError:
            pass

    matched_questions: list[str] = []
    lowered_text = cleaned_text.casefold()
    for question in catalog.questions:
        if question.question.casefold() in lowered_text:
            matched_questions.append(question.question)

    deduped_questions = list(dict.fromkeys(matched_questions))
    if deduped_questions:
        return SuggestFollowUpsResponse(follow_up_questions=deduped_questions[:3])

    raise pydantic.ValidationError.from_exception_data(
        "SuggestFollowUpsResponse",
        [
            {
                "type": "value_error",
                "loc": ("follow_up_questions",),
                "msg": "Unable to recover follow-up questions from LLM response text",
                "input": cleaned_text[:500],
                "ctx": {"error": "Unable to recover follow-up questions"},
            }
        ],
    )


def build_follow_up_request(
    chat_request: ChatCompletionRequest,
) -> ChatCompletionRequest:
    catalog = load_approved_follow_up_question_catalog()
    candidate_questions = select_candidate_questions(chat_request, catalog)
    selection_message = build_follow_up_selection_message(candidate_questions)
    summarized_location_data = summarize_location_data_for_follow_ups(
        chat_request.resolved_location_data()
    )
    return chat_request.model_copy(
        update={
            "messages": [*chat_request.messages, selection_message],
            "location_data": summarized_location_data,
        }
    )


def parse_follow_up_response(response) -> SuggestFollowUpsResponse:
    parsed_response = getattr(response, "parsed", None)
    if isinstance(parsed_response, SuggestFollowUpsResponse):
        return parsed_response
    if isinstance(parsed_response, dict):
        return SuggestFollowUpsResponse.model_validate(parsed_response)

    catalog = load_approved_follow_up_question_catalog()
    return parse_follow_up_questions_from_text(
        getattr(response, "text", "") or "", catalog
    )
