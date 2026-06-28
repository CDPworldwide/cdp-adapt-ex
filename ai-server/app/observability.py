from __future__ import annotations

import logging
import time
from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any
from uuid import uuid4

from app.raggle_otel import RaggleOtelClient, RaggleOtelSettings
from app.schemas import ChatCompletionRequest
from app.settings import Settings, get_settings

logger = logging.getLogger("uvicorn.error")


@dataclass
class ObservabilityStatus:
    raggle_otel_enabled: bool = False
    raggle_otel_configured: bool = False
    raggle_otel_base_url: str = ""
    raggle_otel_project_id: str = ""
    capture_content: bool = True
    last_raggle_otel_capture_at: str | None = None
    last_raggle_otel_capture_status: str | None = None
    last_raggle_otel_capture_trace_id: str | None = None
    last_raggle_otel_capture_error: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "raggle_otel_enabled": self.raggle_otel_enabled,
            "raggle_otel_configured": self.raggle_otel_configured,
            "raggle_otel_base_url": self.raggle_otel_base_url,
            "raggle_otel_project_id": self.raggle_otel_project_id,
            "capture_content": self.capture_content,
            "last_raggle_otel_capture_at": self.last_raggle_otel_capture_at,
            "last_raggle_otel_capture_status": self.last_raggle_otel_capture_status,
            "last_raggle_otel_capture_trace_id": self.last_raggle_otel_capture_trace_id,
            "last_raggle_otel_capture_error": self.last_raggle_otel_capture_error,
        }


class LLMObservability:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._raggle_otel = _build_raggle_otel_client(settings)
        self._status = ObservabilityStatus(
            raggle_otel_enabled=settings.raggle_otel_enabled,
            raggle_otel_configured=(
                self._raggle_otel is not None and self._raggle_otel.enabled
            ),
            raggle_otel_base_url=settings.raggle_otel_base_url,
            raggle_otel_project_id=settings.raggle_otel_project_id,
            capture_content=settings.raggle_otel_capture_content,
        )

    def generation(
        self,
        *,
        request: ChatCompletionRequest,
        prompt_name: str,
        model: str,
        model_parameters: dict[str, Any],
    ) -> "LLMGenerationObservation":
        metadata = _request_metadata(request, prompt_name)
        input_payload = _request_input(request) if self.settings.raggle_otel_capture_content else None
        return LLMGenerationObservation(
            raggle_otel=self._raggle_otel,
            status=self._status,
            name="gemini.generate_content",
            model=model,
            model_parameters=model_parameters,
            input_payload=input_payload,
            metadata=metadata,
        )

    def status(self) -> dict[str, Any]:
        return self._status.as_dict()

    def flush(self) -> None:
        if self._raggle_otel is None:
            return
        try:
            self._raggle_otel.flush()
            self._raggle_otel.close()
        except Exception:
            logger.warning("Failed to flush Raggle OTel client", exc_info=True)


class LLMGenerationObservation(AbstractContextManager):
    def __init__(
        self,
        *,
        raggle_otel: RaggleOtelClient | None,
        status: ObservabilityStatus | None,
        name: str,
        model: str,
        model_parameters: dict[str, Any],
        input_payload: Any | None,
        metadata: dict[str, Any],
    ):
        self.raggle_otel = raggle_otel
        self.status = status
        self.name = name
        self.model = model
        self.model_parameters = model_parameters
        self.input_payload = input_payload
        self.metadata = metadata
        self._started_at: float | None = None
        self._captured = False
        self._trace_id = str(metadata.get("sessionId") or metadata.get("session_id") or uuid4())
        self._span_id = uuid4().hex[:16]

    def __enter__(self) -> "LLMGenerationObservation":
        self._started_at = time.monotonic()
        return self

    def __exit__(self, exc_type, exc, traceback) -> bool:
        if exc is not None:
            self.record_error(exc)
        return False

    def update(
        self,
        *,
        output: Any | None = None,
        usage_details: dict[str, int] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self._capture(
            output=output,
            usage_details=usage_details,
            metadata={**self.metadata, **(metadata or {})},
        )

    def record_error(self, exc: BaseException) -> None:
        self._capture(
            output=None,
            usage_details=None,
            metadata={**self.metadata, "error_type": type(exc).__name__},
            error=f"{type(exc).__name__}: {exc}",
        )

    def _capture(
        self,
        *,
        output: Any | None,
        usage_details: dict[str, int] | None,
        metadata: dict[str, Any],
        error: str | None = None,
    ) -> None:
        if self.raggle_otel is None or self._captured:
            return
        try:
            captured = self.raggle_otel.capture_generation(
                name=self.name,
                model=self.model,
                model_parameters=self.model_parameters,
                input_payload=self.input_payload,
                output=output,
                usage_details=usage_details,
                metadata=metadata,
                trace_id=self._trace_id,
                span_id=self._span_id,
                latency_seconds=self._latency_seconds(),
                error=error,
            )
            self._captured = captured
            _record_capture(
                self.status,
                "ok" if captured else "skipped",
                self._trace_id,
                None,
            )
        except Exception as exc:
            _record_capture(self.status, "error", self._trace_id, str(exc))
            logger.warning("Failed to capture Raggle OTel generation", exc_info=True)

    def _latency_seconds(self) -> float | None:
        if self._started_at is None:
            return None
        return round(time.monotonic() - self._started_at, 6)


def _build_raggle_otel_client(settings: Settings) -> RaggleOtelClient | None:
    raggle_settings = RaggleOtelSettings(
        enabled=settings.raggle_otel_enabled,
        base_url=settings.raggle_otel_base_url.rstrip("/"),
        api_token=settings.raggle_otel_api_token,
        project_id=settings.raggle_otel_project_id,
        capture_content=settings.raggle_otel_capture_content,
        timeout_seconds=settings.raggle_otel_timeout_seconds,
    )
    if not raggle_settings.configured:
        return None
    return RaggleOtelClient(raggle_settings)


def _request_metadata(request: ChatCompletionRequest, prompt_name: str) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "prompt_name": prompt_name,
        "requested_model": request.model,
        "stream": request.stream,
        "context_area": request.resolved_context_area(),
    }
    request_metadata = request.metadata or {}
    for key in ("user_id", "userId", "session_id", "sessionId", "locationId"):
        if key in request_metadata:
            metadata[key] = request_metadata[key]

    location_data = request.resolved_location_data() or {}
    for key in ("id", "name", "country", "contextArea"):
        if key in location_data:
            metadata[f"location_{key}"] = location_data[key]

    return {key: value for key, value in metadata.items() if value is not None}


def _request_input(request: ChatCompletionRequest) -> dict[str, Any]:
    return {
        "messages": [
            {"role": message.role, "content": message.text_content()}
            for message in request.messages
        ],
        "location_data": request.resolved_location_data(),
        "context_area": request.resolved_context_area(),
    }


def _record_capture(
    status: ObservabilityStatus | None,
    capture_status: str,
    trace_id: str,
    error: str | None,
) -> None:
    if status is None:
        return
    status.last_raggle_otel_capture_at = datetime.now(UTC).isoformat()
    status.last_raggle_otel_capture_status = capture_status
    status.last_raggle_otel_capture_trace_id = trace_id
    status.last_raggle_otel_capture_error = error


@lru_cache(maxsize=1)
def get_observability() -> LLMObservability:
    return LLMObservability(get_settings())


def generation_observation(*args, **kwargs):
    return get_observability().generation(*args, **kwargs)
