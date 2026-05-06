from app.schemas import ChatCompletionRequest
from app.settings import Settings

INVALID_LOCATION_MESSAGE = "locationData must be an object when provided"


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
        return request.with_resolved_location_data(canonical_location)
