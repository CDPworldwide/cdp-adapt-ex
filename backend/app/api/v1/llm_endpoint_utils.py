import asyncio

from app.shared.config import settings
from app.shared.exceptions import (
    LLMAuthError,
    LLMRateLimitError,
    LLMServiceError,
    LLMTimeoutError,
)
from app.shared.logging import logger
from fastapi import HTTPException


async def await_llm_response(coro):
    try:
        return await asyncio.wait_for(
            coro,
            timeout=settings.LLM_REQUEST_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise LLMTimeoutError("LLM request timed out") from exc


def clamp_chat_response_text(response_text: str) -> str:
    if len(response_text) > settings.MAX_CHAT_RESPONSE_CHARS:
        raise ValueError("LLM response exceeded the configured chat response limit")
    return response_text


def extract_chat_response_text(response) -> str:
    try:
        return response.text or ""
    except ValueError as exc:
        logger.warning(
            "llm_response_text_accessor_failed",
            error=str(exc),
        )

    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        raise LLMServiceError("LLM returned no candidates")

    first_candidate = candidates[0]
    parts = getattr(getattr(first_candidate, "content", None), "parts", None) or []
    text_parts = [part.text for part in parts if getattr(part, "text", None)]
    if text_parts:
        return "".join(text_parts)

    finish_reason = getattr(first_candidate, "finish_reason", None)
    if finish_reason is not None:
        raise LLMServiceError(
            f"LLM returned no text content (finish_reason={finish_reason})"
        )

    raise LLMServiceError("LLM returned no text content")


def raise_llm_http_exception(exc: Exception, event_prefix: str) -> None:
    if isinstance(exc, LLMTimeoutError):
        logger.error(
            f"{event_prefix}_timeout",
            error=str(exc),
        )
        raise HTTPException(status_code=504, detail="LLM request timed out") from exc

    if isinstance(exc, LLMAuthError):
        logger.error(
            f"{event_prefix}_auth_failed",
            error=str(exc),
        )
        raise HTTPException(
            status_code=500, detail="LLM service authentication failed"
        ) from exc

    if isinstance(exc, LLMRateLimitError):
        logger.error(
            f"{event_prefix}_rate_limited",
            error=str(exc),
        )
        raise HTTPException(status_code=429, detail="Rate limit exceeded") from exc

    if isinstance(exc, LLMServiceError):
        logger.error(
            f"{event_prefix}_failed",
            error=str(exc),
            exc_info=True,
        )
        raise HTTPException(status_code=502, detail="LLM service request failed") from exc
