import json
import time

from fastapi import APIRouter, Depends, HTTPException
from starlette.responses import StreamingResponse

from app.llm_utils import await_llm_response, raise_llm_http_exception
from app.location_service import LocationVerifier
from app.providers.gemini import GeminiCompletion, GeminiProvider
from app.schemas import (
    ChatCompletionChoice,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionResponseMessage,
    ModelInfo,
    ModelsResponse,
    Usage,
)
from app.settings import Settings, get_settings

router = APIRouter()

EMPTY_ASK_AI_RESPONSE = """What would you like to know about this location's climate resilience disclosure?

Suggested questions:
- Which hazards are reported?
- What adaptation actions are underway?
- Which actions support vulnerable populations?
- What goals or targets are listed?"""


def get_provider(settings: Settings = Depends(get_settings)) -> GeminiProvider:
    return GeminiProvider(settings)


def get_location_verifier(
    settings: Settings = Depends(get_settings),
) -> LocationVerifier:
    return LocationVerifier(settings)


@router.get("/models", response_model=ModelsResponse)
async def models(settings: Settings = Depends(get_settings)) -> ModelsResponse:
    return ModelsResponse(data=[ModelInfo(id=settings.public_model_name)])


@router.post("/chat/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    provider: GeminiProvider = Depends(get_provider),
    location_verifier: LocationVerifier = Depends(get_location_verifier),
    settings: Settings = Depends(get_settings),
):
    try:
        resolved_request = await location_verifier.verify_chat_request(request)
        if _is_empty_ask_ai_click(resolved_request):
            completion = GeminiCompletion(text=EMPTY_ASK_AI_RESPONSE)
        else:
            completion = await await_llm_response(
                provider.complete(resolved_request),
                timeout_seconds=settings.llm_request_timeout_seconds,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise_llm_http_exception(exc)
        raise HTTPException(status_code=500, detail="An unexpected error occurred") from exc

    if len(completion.text) > settings.max_chat_response_chars:
        raise HTTPException(status_code=502, detail="LLM response exceeded limit")

    model = resolved_request.model or settings.public_model_name
    if resolved_request.stream:
        return StreamingResponse(
            _stream_openai_chunks(completion.text, model),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache"},
        )

    return ChatCompletionResponse(
        model=model,
        choices=[
            ChatCompletionChoice(
                index=0,
                message=ChatCompletionResponseMessage(content=completion.text),
            )
        ],
        usage=Usage(
            prompt_tokens=completion.prompt_tokens,
            completion_tokens=completion.completion_tokens,
            total_tokens=completion.prompt_tokens + completion.completion_tokens,
        ),
    )


async def _stream_openai_chunks(text: str, model: str):
    completion_id = f"chatcmpl-{int(time.time())}"
    created = int(time.time())
    yield _sse(
        {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
        }
    )
    if text:
        yield _sse(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [
                    {"index": 0, "delta": {"content": text}, "finish_reason": None}
                ],
            }
        )
    yield _sse(
        {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        }
    )
    yield "data: [DONE]\n\n"


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"


def _is_empty_ask_ai_click(request: ChatCompletionRequest) -> bool:
    last_user_message = next(
        (message for message in reversed(request.messages) if message.role == "user"),
        None,
    )
    if last_user_message is None:
        return False

    text = last_user_message.text_content().strip()
    return text in {"", "Clicked on the AI button directly", "Ask AI"}
