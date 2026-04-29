import pydantic
from app.api.v1.chat_request_utils import build_verified_chat_request
from app.api.v1.deps import (
    get_llm_client,
    get_location_details_service,
)
from app.api.v1.llm_endpoint_utils import await_llm_response, raise_llm_http_exception
from app.core.suggest_follow_ups import SuggestFollowUps
from app.schemas.chatbot import OpenAIChatCompletionRequest
from app.schemas.suggest_follow_ups import (
    SuggestFollowUpsResponse,
)
from app.services.impls.location_details_service import LocationDetailsService
from app.services.interfaces.llm_client import LLMClient
from app.shared.config import settings
from app.shared.limiter import limiter
from app.shared.logging import logger
from fastapi import APIRouter, Depends, HTTPException, Request

router = APIRouter()


@router.post("", response_model=SuggestFollowUpsResponse)
@limiter.limit(settings.RATE_LIMIT_ENDPOINTS["suggest_follow_ups"][0])
async def suggest_follow_ups(
    request: Request,
    chat_request: OpenAIChatCompletionRequest,
    llm_client: LLMClient = Depends(get_llm_client),
    location_service: LocationDetailsService = Depends(get_location_details_service),
) -> SuggestFollowUpsResponse:
    """Provide an LLM suggested list of follow-ups to a user question

    Args:
        request: The FastAPI request object for rate limiting.
        chat_request: The chat request containing messages.
        llm_client: The LLM client.

    Returns:
        SuggestFollowUpsResponse: The processed chat response.

    Raises:
        HTTPException: If there's an error processing the request.
    """
    try:
        verified_chat_request = await build_verified_chat_request(
            chat_request, location_service
        )
        logger.info(
            "suggest_follow_ups_request_received",
            message_count=len(verified_chat_request.messages),
        )

        follow_up_request = verified_chat_request.model_copy(
            update={
                "max_tokens": min(
                    verified_chat_request.max_tokens
                    or settings.SUGGEST_FOLLOW_UPS_MAX_TOKENS,
                    settings.SUGGEST_FOLLOW_UPS_MAX_TOKENS,
                )
            }
        )

        suggest_follow_ups_service = SuggestFollowUps(llm_client)
        response = await await_llm_response(
            suggest_follow_ups_service.suggest_follow_ups_async(
                follow_up_request,
            )
        )
        parsed_response = suggest_follow_ups_service.parse_response(response)
        return parsed_response

    except pydantic.ValidationError as e:
        logger.error(
            "suggest_follow_ups_response_invalid",
            error=str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to parse LLM response")
    except ValueError as e:
        logger.error(
            "chat_request_invalid",
            error=str(e),
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        try:
            raise_llm_http_exception(e, "chat_request")
        except HTTPException:
            raise
        logger.error(
            "chat_request_failed",
            error=str(e),
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
