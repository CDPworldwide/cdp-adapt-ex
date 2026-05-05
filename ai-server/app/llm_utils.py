import asyncio

from fastapi import HTTPException

from app.errors import LLMAuthError, LLMRateLimitError, LLMServiceError, LLMTimeoutError


async def await_llm_response(coro, timeout_seconds: float):
    try:
        return await asyncio.wait_for(coro, timeout=timeout_seconds)
    except asyncio.TimeoutError as exc:
        raise LLMTimeoutError("LLM request timed out") from exc


def raise_llm_http_exception(exc: Exception) -> None:
    if isinstance(exc, LLMTimeoutError):
        raise HTTPException(status_code=504, detail="LLM request timed out") from exc
    if isinstance(exc, LLMAuthError):
        raise HTTPException(
            status_code=500, detail="LLM service authentication failed"
        ) from exc
    if isinstance(exc, LLMRateLimitError):
        raise HTTPException(status_code=429, detail="Rate limit exceeded") from exc
    if isinstance(exc, LLMServiceError):
        raise HTTPException(
            status_code=502, detail="LLM service request failed"
        ) from exc
