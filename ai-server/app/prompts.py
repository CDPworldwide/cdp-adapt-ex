import json
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

SYSTEM_PROMPT_ENV_VAR = "SYSTEM_PROMPT"
SYSTEM_PROMPT_FILE_NAME = "system_prompt.md"
DEFAULT_SYSTEM_PROMPT = "You are a helpful climate risk assistant."
PROMPT_FETCH_TIMEOUT_SECONDS = 10.0
PROMPT_CACHE_SECONDS_ENV_VAR = "SYSTEM_PROMPT_CACHE_SECONDS"
DEFAULT_REMOTE_PROMPT_CACHE_SECONDS = 60.0
LOCATION_CONTEXT_PLACEHOLDER = "{{ selected_location_context_json }}"
MAX_SOLUTION_CARDS_PER_CATEGORY = 1
MAX_SOLUTION_CARDS_TOTAL = 6
MAX_PEER_ACTIONS_PER_SOLUTION = 1
MAX_GOVERNMENT_ACTIONS = 20
MAX_GOVERNMENT_GOALS = 12
MAX_GOVERNMENT_PROJECTS = 12
MAX_CONTEXT_TEXT_CHARS = 1200
MAX_PEER_ACTION_TEXT_CHARS = 300
INTERNAL_CONTEXT_KEYS = {"geometry", "hazardRank"}
VALID_CONTEXT_AREAS = {"hazards", "actions", "solutions"}
COMMON_LOCATION_CONTEXT_KEYS = (
    "organizationId",
    "name",
    "countryName",
    "lat",
    "lng",
    "isReportingLeader",
    "disclosureYear",
    "requesters",
    "population",
)
CONTEXT_AREA_FIELDS = {
    "hazards": ("hazards",),
    "actions": ("governmentActions",),
    "solutions": ("solutions",),
}
_REMOTE_PROMPT_CACHE: dict[str, tuple[float, str]] = {}


def load_system_prompt(file_name: str = SYSTEM_PROMPT_FILE_NAME) -> str:
    prompt_source = os.getenv(SYSTEM_PROMPT_ENV_VAR)
    if file_name == SYSTEM_PROMPT_FILE_NAME and prompt_source:
        return _load_prompt_from_source(prompt_source)

    prompt_path = Path(__file__).parent / "prompts" / file_name
    if not prompt_path.exists():
        return DEFAULT_SYSTEM_PROMPT
    return prompt_path.read_text(encoding="utf-8")


def _load_prompt_from_source(prompt_source: str) -> str:
    parsed_url = urlparse(prompt_source)
    if parsed_url.scheme in {"http", "https"}:
        return _load_remote_prompt(prompt_source)
    if parsed_url.scheme == "file":
        prompt_path = Path(parsed_url.path)
    elif not parsed_url.scheme:
        prompt_path = Path(prompt_source).expanduser()
    else:
        raise ValueError(
            f"{SYSTEM_PROMPT_ENV_VAR} must be an http(s) URL or file path when provided"
        )

    return prompt_path.read_text(encoding="utf-8")


def _load_remote_prompt(prompt_source: str) -> str:
    now = time.monotonic()
    cached = _REMOTE_PROMPT_CACHE.get(prompt_source)
    cache_seconds = remote_prompt_cache_seconds()
    if cached is not None and now - cached[0] < cache_seconds:
        return cached[1]

    response = httpx.get(prompt_source, timeout=PROMPT_FETCH_TIMEOUT_SECONDS)
    response.raise_for_status()
    _REMOTE_PROMPT_CACHE[prompt_source] = (now, response.text)
    return response.text


def remote_prompt_cache_seconds() -> float:
    configured = os.getenv(PROMPT_CACHE_SECONDS_ENV_VAR)
    if configured is None:
        return DEFAULT_REMOTE_PROMPT_CACHE_SECONDS
    try:
        return max(0.0, float(configured))
    except ValueError:
        return DEFAULT_REMOTE_PROMPT_CACHE_SECONDS


def clear_prompt_cache() -> None:
    _REMOTE_PROMPT_CACHE.clear()


load_system_prompt.cache_clear = clear_prompt_cache


def build_system_prompt(
    location_data: dict[str, Any] | None,
    file_name: str = SYSTEM_PROMPT_FILE_NAME,
    context_area: str | None = None,
) -> str:
    system_prompt = load_system_prompt(file_name)
    if not location_data:
        return render_system_prompt(system_prompt, None)

    sanitized_location = build_location_context(location_data, context_area)
    location_context = json.dumps(
        sanitized_location,
        separators=(",", ":"),
        ensure_ascii=False,
    )
    return render_system_prompt(system_prompt, location_context)


def render_system_prompt(system_prompt: str, location_context: str | None) -> str:
    if LOCATION_CONTEXT_PLACEHOLDER in system_prompt:
        return system_prompt.replace(
            LOCATION_CONTEXT_PLACEHOLDER,
            location_context or "null",
        ).rstrip()
    if location_context is None:
        return system_prompt
    return f"{system_prompt}\n\n```json\n{location_context}\n```"


def build_location_context(
    location_data: dict[str, Any],
    context_area: str | None = None,
) -> dict[str, Any]:
    normalized_area = normalize_context_area(
        context_area or location_data.get("contextArea")
    )
    scoped_location = scope_location_context(location_data, normalized_area)
    sanitized = sanitize_location_context(scoped_location)
    sanitized["dataProvenance"] = build_data_provenance(
        scoped_location, normalized_area
    )
    return sanitized


def normalize_context_area(value: Any) -> str | None:
    if value in VALID_CONTEXT_AREAS:
        return value
    return None


def scope_location_context(
    location_data: dict[str, Any],
    context_area: str | None,
) -> dict[str, Any]:
    if context_area is None:
        return dict(location_data)

    scoped = {
        key: location_data[key]
        for key in COMMON_LOCATION_CONTEXT_KEYS
        if key in location_data
    }
    scoped["contextArea"] = context_area
    for key in CONTEXT_AREA_FIELDS[context_area]:
        if key in location_data:
            scoped[key] = location_data[key]
    return scoped


def sanitize_location_context(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized = {}
        for key, child in value.items():
            if key in INTERNAL_CONTEXT_KEYS:
                continue
            if key == "solutions" and isinstance(child, dict):
                sanitized[key] = sanitize_solutions_context(child)
            elif key == "governmentActions" and isinstance(child, dict):
                sanitized[key] = sanitize_government_actions_context(child)
            else:
                sanitized[key] = sanitize_location_context(child)
        return sanitized
    if isinstance(value, list):
        return [sanitize_location_context(item) for item in value]
    if isinstance(value, str):
        return truncate_text(value)
    return value


def build_data_provenance(
    location_data: dict[str, Any],
    context_area: str | None = None,
) -> dict[str, Any]:
    hazards = location_data.get("hazards") or {}
    stats = hazards.get("statistics") if isinstance(hazards, dict) else {}
    has_aggregate_stats = isinstance(stats, dict) and any(
        stats.get(key) is not None
        for key in (
            "populationExposedValue",
            "populationExposedPercentage",
            "gdpAtRiskValue",
            "gdpAtRiskPercentage",
        )
    )
    has_hazard_ordering = any(
        isinstance(hazard, dict) and hazard.get("hazardRank") is not None
        for hazard in (hazards.get("hazards", []) if isinstance(hazards, dict) else [])
    )
    return {
        "contextArea": context_area or "all",
        "includedTopLevelFields": [
            key for key in location_data.keys() if key not in INTERNAL_CONTEXT_KEYS
        ],
        "contextShape": "endpoint_shaped_platform_data",
        "isScopedToContextArea": context_area is not None,
        "aggregateStatisticsPresent": has_aggregate_stats,
        "hazardOrderingEvidencePresent": has_hazard_ordering,
        "contextTrimmingApplied": True,
    }


def sanitize_solutions_context(value: dict[str, Any]) -> dict[str, Any]:
    solutions = value.get("solutions")
    if not isinstance(solutions, dict):
        return sanitize_location_context(value)

    trimmed_categories = {}
    selected_cards = select_solution_cards(solutions)
    for category, cards in selected_cards.items():
        trimmed_categories[category] = [summarize_solution_card(card) for card in cards]

    return {
        "solutions": trimmed_categories,
        "trimming": {
            "maxSolutionCardsTotal": MAX_SOLUTION_CARDS_TOTAL,
            "maxSolutionCardsPerCategory": MAX_SOLUTION_CARDS_PER_CATEGORY,
            "maxPeerExamplesPerCard": MAX_PEER_ACTIONS_PER_SOLUTION,
        },
    }


def select_solution_cards(
    solutions: dict[str, Any],
) -> dict[str, list[dict[str, Any]]]:
    candidates = []
    for category, cards in solutions.items():
        if not isinstance(cards, list):
            continue
        for index, card in enumerate(cards):
            if isinstance(card, dict):
                candidates.append((category, card, index))

    candidates.sort(
        key=lambda item: solution_card_priority(item[1], item[2]),
        reverse=True,
    )

    selected_categories: dict[str, list[dict[str, Any]]] = {}
    selected_count = 0
    for category, card, _ in candidates:
        if selected_count >= MAX_SOLUTION_CARDS_TOTAL:
            break
        category_cards = selected_categories.setdefault(category, [])
        if len(category_cards) >= MAX_SOLUTION_CARDS_PER_CATEGORY:
            continue
        category_cards.append(card)
        selected_count += 1

    return selected_categories


def solution_card_priority(
    card: dict[str, Any], original_index: int
) -> tuple[Any, ...]:
    peer_actions = card.get("peerActions")
    return (
        bool(card.get("hasLocalAction")),
        numeric_value(card.get("pctPeerTakingAction")),
        len(peer_actions) if isinstance(peer_actions, list) else 0,
        -original_index,
    )


def numeric_value(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def sanitize_government_actions_context(value: dict[str, Any]) -> dict[str, Any]:
    """Keep action evidence concise and omit raw dropdown label fields."""
    return {
        "actions": [
            summarize_government_action(item)
            for item in (value.get("actions") or [])[:MAX_GOVERNMENT_ACTIONS]
            if isinstance(item, dict)
        ],
        "goals": [
            summarize_government_goal(item)
            for item in (value.get("goals") or [])[:MAX_GOVERNMENT_GOALS]
            if isinstance(item, dict)
        ],
        "projects": [
            summarize_government_project(item)
            for item in sorted_government_projects(value.get("projects") or [])[
                :MAX_GOVERNMENT_PROJECTS
            ]
            if isinstance(item, dict)
        ],
        "omittedFields": ["coBenefits", "resilienceEnhanced"],
    }


def sorted_government_projects(projects: list[Any]) -> list[Any]:
    return sorted(
        projects,
        key=lambda item: (
            numeric_value(item.get("totalNeeded")) if isinstance(item, dict) else 0,
            bool(item.get("financeStatus")) if isinstance(item, dict) else False,
        ),
        reverse=True,
    )


def summarize_government_action(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": item.get("title"),
        "status": sanitize_location_context(item.get("status")),
        "timeframe": item.get("timeframe"),
        "description": truncate_text(item.get("description")),
        "hazardsAddressed": sanitize_location_context(item.get("hazardsAddressed", [])),
        "impactedSectors": sanitize_location_context(item.get("impactedSectors", [])),
    }


def summarize_government_goal(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": item.get("title"),
        "description": truncate_text(item.get("description")),
        "hazardsAddressed": sanitize_location_context(item.get("hazardsAddressed", [])),
        "metricIndicator": item.get("metricIndicator"),
        "baseYear": item.get("baseYear"),
        "targetYear": item.get("targetYear"),
    }


def summarize_government_project(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": item.get("title"),
        "status": sanitize_location_context(item.get("status")),
        "description": truncate_text(item.get("description")),
        "projectArea": item.get("projectArea"),
        "financeStatus": item.get("financeStatus"),
        "totalAmount": item.get("totalAmount"),
        "totalNeeded": item.get("totalNeeded"),
    }


def summarize_solution_card(card: dict[str, Any]) -> dict[str, Any]:
    summarized = {
        "solution": card.get("solution"),
        "solutionCategory": card.get("solutionCategory"),
        "hazardFilter": card.get("hazardFilter"),
        "hasLocalAction": card.get("hasLocalAction"),
        "pctPeerTakingAction": card.get("pctPeerTakingAction"),
        "solutionHazardsAddressed": sanitize_location_context(
            card.get("solutionHazardsAddressed", [])
        ),
    }
    peer_actions = card.get("peerActions")
    if isinstance(peer_actions, list):
        summarized["peerActions"] = [
            summarize_peer_action(item)
            for item in peer_actions[:MAX_PEER_ACTIONS_PER_SOLUTION]
            if isinstance(item, dict)
        ]
    return summarized


def summarize_peer_action(item: dict[str, Any]) -> dict[str, Any]:
    action = item.get("action") if isinstance(item.get("action"), dict) else {}
    return {
        "peerName": item.get("peerName"),
        "action": {
            "title": action.get("title"),
            "status": sanitize_location_context(action.get("status")),
            "timeframe": action.get("timeframe"),
            "description": truncate_text(
                action.get("description"), MAX_PEER_ACTION_TEXT_CHARS
            ),
            "hazardsAddressed": sanitize_location_context(
                action.get("hazardsAddressed", [])
            ),
        },
    }


def truncate_text(value: Any, max_chars: int = MAX_CONTEXT_TEXT_CHARS) -> Any:
    if not isinstance(value, str):
        return value
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 20].rstrip() + "... [truncated]"
