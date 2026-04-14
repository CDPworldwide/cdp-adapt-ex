import time

from app.api.v1.deps import get_llm_client
from app.schemas.chatbot import (
    OpenAIChatCompletionChoice,
    OpenAIChatCompletionRequest,
    OpenAIChatCompletionResponse,
    OpenAIChatMessage,
    OpenAIUsage,
)
from app.services.interfaces.llm_client import LLMClient
from app.shared.config import settings
from app.shared.limiter import limiter
from app.shared.logging import logger
from fastapi import APIRouter, Depends, HTTPException, Request

router = APIRouter()


def strip_geometry_from_chat_request(
    chat_request: OpenAIChatCompletionRequest,
) -> OpenAIChatCompletionRequest:
    if chat_request.location_data is None:
        return chat_request

    sanitized_location_data = chat_request.location_data.model_copy(
        update={"geometry": {}}
    )
    return chat_request.model_copy(update={"location_data": sanitized_location_data})


@router.post("/chat/completions", response_model=OpenAIChatCompletionResponse)
@limiter.limit(settings.RATE_LIMIT_ENDPOINTS["chat"][0])
async def chat_completions(
    request: Request,
    chat_request: OpenAIChatCompletionRequest,
    llm_client: LLMClient = Depends(get_llm_client),
) -> OpenAIChatCompletionResponse:
    """Non-streaming chat completions endpoint.

    Args:
        request: FastAPI request object
        chat_request: OpenAI-compatible chat request

    Returns:
        OpenAIChatCompletionResponse: Complete chat response
    """
    llm_chat_request = strip_geometry_from_chat_request(chat_request)
    try:
        logger.info(
            "chat_request_received",
            message_count=len(chat_request.messages),
            stream=False,
        )

        response = await llm_client.llm_chat_completion_response_async(
            llm_chat_request,
            "system_prompt.md",
            None,
        )

        completion_id = f"chatcmpl-{int(time.time())}"
        prompt_tokens = 0
        completion_tokens = 0
        if hasattr(response, "usage_metadata"):
            prompt_tokens = (
                getattr(response.usage_metadata, "prompt_token_count", 0) or 0
            )
            completion_tokens = (
                getattr(response.usage_metadata, "candidates_token_count", 0) or 0
            )
        response_text = response.text or ""
        return OpenAIChatCompletionResponse(
            id=completion_id,
            created=int(time.time()),
            model=settings.LLM_MODEL,
            choices=[
                OpenAIChatCompletionChoice(
                    index=0,
                    message=OpenAIChatMessage(
                        role="assistant",
                        content=response_text,
                    ),
                    finish_reason="stop",
                )
            ],
            usage=OpenAIUsage(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
            ),
        )

    except ValueError as e:
        logger.warning(
            "chat_request_invalid",
            error=str(e),
        )
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        error_msg = str(e).lower()
        if "api key" in error_msg or "authentication" in error_msg:
            logger.error(
                "chat_request_auth_failed",
                error=str(e),
            )
            raise HTTPException(
                status_code=500, detail="LLM service authentication failed"
            )
        elif "rate limit" in error_msg or "quota" in error_msg:
            logger.error(
                "chat_request_rate_limited",
                error=str(e),
            )
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        else:
            logger.error(
                "chat_request_failed",
                error=str(e),
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail="An unexpected error occurred")
