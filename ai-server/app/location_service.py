import logging
from collections.abc import Mapping
from typing import Any

from app.schemas import ChatCompletionRequest
from app.settings import Settings

INVALID_LOCATION_MESSAGE = "locationData must be an object when provided"
logger = logging.getLogger("uvicorn.error")


class LocationVerifier:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def verify_chat_request(
        self, request: ChatCompletionRequest
    ) -> ChatCompletionRequest:
        location_data = request.resolved_location_data()
        if location_data is None:
            return request

        if not isinstance(location_data, dict):
            raise ValueError(INVALID_LOCATION_MESSAGE)

        canonical_location = dict(location_data)
        canonical_location.pop("geometry", None)
        context_area = request.resolved_context_area()
        if context_area:
            canonical_location["contextArea"] = context_area
        _log_location_context(canonical_location)
        return request.with_resolved_location_data(canonical_location)


def _log_location_context(location_data: Mapping[str, Any]) -> None:
    hazards = _nested_list(location_data, "hazards", "hazards")
    actions = _nested_list(location_data, "governmentActions", "actions")
    goals = _nested_list(location_data, "governmentActions", "goals")
    projects = _nested_list(location_data, "governmentActions", "projects")
    solution_groups = _nested_mapping(location_data, "solutions", "solutions")

    logger.info(
        "location_context_summary org_id=%s name=%r country=%r context_area=%s "
        "has_geometry=%s hazards=%s actions=%s goals=%s projects=%s solution_groups=%s",
        location_data.get("organizationId"),
        location_data.get("name"),
        location_data.get("countryName"),
        location_data.get("contextArea"),
        "geometry" in location_data,
        len(hazards),
        len(actions),
        len(goals),
        len(projects),
        len(solution_groups),
    )


def _nested_list(data: Mapping[str, Any], section: str, key: str) -> list[Any]:
    section_data = data.get(section)
    if isinstance(section_data, Mapping):
        value = section_data.get(key)
        if isinstance(value, list):
            return value
    return []


def _nested_mapping(data: Mapping[str, Any], section: str, key: str) -> Mapping[str, Any]:
    section_data = data.get(section)
    if isinstance(section_data, Mapping):
        value = section_data.get(key)
        if isinstance(value, Mapping):
            return value
    return {}
