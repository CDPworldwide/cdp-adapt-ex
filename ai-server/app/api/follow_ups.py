import pydantic
from fastapi import APIRouter, Depends, HTTPException

from app.api.openai import get_location_verifier, get_provider
from app.follow_ups import build_follow_up_request, parse_follow_up_response
from app.llm_utils import await_llm_response, raise_llm_http_exception
from app.location_service import LocationVerifier
from app.providers.gemini import GeminiProvider
from app.schemas import ChatCompletionRequest, SuggestFollowUpsResponse
from app.settings import Settings, get_settings

router = APIRouter()


@router.post("/suggest-follow-ups", response_model=SuggestFollowUpsResponse)
async def suggest_follow_ups(
    request: ChatCompletionRequest,
    provider: GeminiProvider = Depends(get_provider),
    location_verifier: LocationVerifier = Depends(get_location_verifier),
    settings: Settings = Depends(get_settings),
) -> SuggestFollowUpsResponse:
    try:
        resolved_request = await location_verifier.verify_chat_request(request)
        follow_up_request = build_follow_up_request(
            resolved_request.model_copy(
                update={
                    "max_tokens": min(
                        resolved_request.max_tokens
                        or settings.suggest_follow_ups_max_tokens,
                        settings.suggest_follow_ups_max_tokens,
                    )
                }
            )
        )
        response = await await_llm_response(
            provider.generate(
                follow_up_request,
                prompt_name="suggest_follow_ups.md",
                response_schema=SuggestFollowUpsResponse,
            ),
            timeout_seconds=settings.llm_request_timeout_seconds,
        )
        return parse_follow_up_response(response)
    except pydantic.ValidationError as exc:
        raise HTTPException(
            status_code=500, detail="Failed to parse LLM response"
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise_llm_http_exception(exc)
        raise HTTPException(status_code=500, detail="An unexpected error occurred") from exc
