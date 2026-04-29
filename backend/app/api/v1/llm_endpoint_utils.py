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
