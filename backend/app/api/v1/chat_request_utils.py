from app.schemas.chatbot import OpenAIChatCompletionRequest
from app.services.impls.location_details_service import LocationDetailsService
from app.shared.exceptions import CityGeometryMissingException, CityNotFoundException
from fastapi import HTTPException


def strip_geometry_from_chat_request(
    chat_request: OpenAIChatCompletionRequest,
) -> OpenAIChatCompletionRequest:
    if chat_request.location_data is None:
        return chat_request

    sanitized_location_data = chat_request.location_data.model_copy(
        update={"geometry": {}}
    )
    return chat_request.model_copy(update={"location_data": sanitized_location_data})


async def build_verified_chat_request(
    chat_request: OpenAIChatCompletionRequest,
    location_service: LocationDetailsService,
) -> OpenAIChatCompletionRequest:
    if chat_request.location_data is None:
        return chat_request

    organization_id = chat_request.location_data.organization_id

    try:
        canonical_location = await location_service.get_location_details_by_org_id(
            organization_id
        )
    except (CityNotFoundException, CityGeometryMissingException) as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "locationData must reference a valid organizationId from the locations "
                "endpoint"
            ),
        ) from exc

    return strip_geometry_from_chat_request(
        chat_request.model_copy(update={"location_data": canonical_location})
    )
