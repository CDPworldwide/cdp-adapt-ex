from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Protocol
from uuid import uuid4

import httpx

logger = logging.getLogger("uvicorn.error")

DEFAULT_BASE_URL = "https://otelapi.raggle.co"
DEFAULT_TIMEOUT_SECONDS = 10.0
MAX_CONTENT_CHARS = 32_000


class Transport(Protocol):
    def request(
        self,
        method: str,
        url: str,
        *,
        headers: dict[str, str],
        json: dict[str, Any],
    ) -> httpx.Response: ...

    def close(self) -> None: ...


@dataclass(frozen=True)
class RaggleOtelSettings:
    enabled: bool
    base_url: str
    api_token: str
    project_id: str
    capture_content: bool
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS

    @classmethod
    def from_env(cls, *, capture_content_default: bool = True) -> "RaggleOtelSettings":
        return cls(
            enabled=_parse_bool(os.getenv("RAGGLE_OTEL_ENABLED"), False),
            base_url=os.getenv("RAGGLE_OTEL_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
            api_token=os.getenv("RAGGLE_OTEL_API_TOKEN", ""),
            project_id=os.getenv("RAGGLE_OTEL_PROJECT_ID", ""),
            capture_content=_parse_bool(
                os.getenv("RAGGLE_OTEL_CAPTURE_CONTENT"),
                capture_content_default,
            ),
            timeout_seconds=_parse_float(
                os.getenv("RAGGLE_OTEL_TIMEOUT_SECONDS"),
                DEFAULT_TIMEOUT_SECONDS,
            ),
        )

    @property
    def configured(self) -> bool:
        return bool(self.enabled and self.api_token and self.project_id)


class RaggleOtelClient:
    def __init__(
        self,
        settings: RaggleOtelSettings,
        *,
        transport: Transport | None = None,
    ):
        self.settings = settings
        self._transport = transport or httpx.Client(timeout=settings.timeout_seconds)
        self._owned_transport = transport is None
        self._known_sessions: set[str] = set()

    @property
    def enabled(self) -> bool:
        return self.settings.configured

    def capture_generation(
        self,
        *,
        name: str,
        model: str,
        model_parameters: dict[str, Any],
        input_payload: Any | None,
        output: Any | None,
        usage_details: dict[str, int] | None,
        metadata: dict[str, Any],
        trace_id: str | None = None,
        span_id: str | None = None,
        latency_seconds: float | None = None,
        error: str | None = None,
    ) -> bool:
        if not self.enabled:
            return False

        session_id = _session_id(metadata, self.settings.project_id)
        try:
            self._ensure_session(session_id=session_id, metadata=metadata)
            response = self._request(
                "POST",
                f"/v1/sessions/{session_id}/otel-events",
                {
                    "traceId": _trace_id(trace_id, session_id),
                    "spanId": _span_id(span_id),
                    "name": name,
                    "kind": "span",
                    "attributes": _attributes(
                        project_id=self.settings.project_id,
                        name=name,
                        model=model,
                        model_parameters=model_parameters,
                        input_payload=input_payload,
                        output=output,
                        usage_details=usage_details,
                        metadata=metadata,
                        latency_seconds=latency_seconds,
                        capture_content=self.settings.capture_content,
                        error=error,
                    ),
                },
            )
            if 200 <= response.status_code < 300:
                return True
            logger.warning(
                "Raggle OTel event capture failed status=%s body=%s",
                response.status_code,
                response.text[:500],
            )
        except Exception:
            logger.warning("Failed to capture Raggle OTel generation", exc_info=True)
        return False

    def flush(self) -> None:
        return None

    def close(self) -> None:
        if self._owned_transport:
            self._transport.close()

    def _ensure_session(self, *, session_id: str, metadata: dict[str, Any]) -> None:
        if session_id in self._known_sessions:
            return

        response = self._request(
            "POST",
            "/v1/sessions",
            {
                "id": session_id,
                "title": f"{self.settings.project_id} telemetry",
                "metadata": {
                    "project_id": self.settings.project_id,
                    **_metadata_attributes(metadata),
                },
            },
        )
        if response.status_code in {200, 201, 409}:
            self._known_sessions.add(session_id)
            return

        raise RuntimeError(
            f"Raggle OTel session setup failed with {response.status_code}: {response.text[:500]}"
        )

    def _request(self, method: str, path: str, payload: dict[str, Any]) -> httpx.Response:
        return self._transport.request(
            method,
            f"{self.settings.base_url}{path}",
            headers={
                "Authorization": f"Bearer {self.settings.api_token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )


def _session_id(metadata: dict[str, Any], project_id: str) -> str:
    for key in ("sessionId", "session_id"):
        value = metadata.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return f"{project_id}:{uuid4()}"


def _trace_id(trace_id: str | None, session_id: str) -> str | None:
    return (trace_id or session_id or "")[:64] or None


def _span_id(span_id: str | None) -> str:
    candidate = span_id or uuid4().hex
    if len(candidate) <= 32:
        return candidate
    return candidate.replace("-", "")[:32]


def _attributes(
    *,
    project_id: str,
    name: str,
    model: str,
    model_parameters: dict[str, Any],
    input_payload: Any | None,
    output: Any | None,
    usage_details: dict[str, int] | None,
    metadata: dict[str, Any],
    latency_seconds: float | None,
    capture_content: bool,
    error: str | None,
) -> dict[str, Any]:
    attributes: dict[str, Any] = {
        "raggle.project_id": project_id,
        "raggle.source": "cdp-ai-server",
        "gen_ai.operation.name": name,
        "gen_ai.request.model": model,
        "gen_ai.response.model": model,
        "gen_ai.system": "gemini" if model.startswith("gemini") else "llm",
        "gen_ai.request.temperature": model_parameters.get("temperature"),
        "gen_ai.request.max_tokens": model_parameters.get("max_output_tokens"),
        "gen_ai.request.response_mime_type": model_parameters.get("response_mime_type"),
        **_metadata_attributes(metadata),
    }
    if latency_seconds is not None:
        attributes["gen_ai.latency_seconds"] = latency_seconds
    if usage_details:
        attributes["gen_ai.usage.input_tokens"] = usage_details.get("prompt_tokens", 0)
        attributes["gen_ai.usage.output_tokens"] = usage_details.get("completion_tokens", 0)
        attributes["gen_ai.usage.total_tokens"] = usage_details.get("total_tokens") or (
            usage_details.get("prompt_tokens", 0) + usage_details.get("completion_tokens", 0)
        )
    if error:
        attributes["error"] = True
        attributes["exception.message"] = _truncate(error)
    if capture_content:
        if input_payload is not None:
            attributes["gen_ai.prompt"] = _truncate(input_payload)
        if output is not None:
            attributes["gen_ai.completion"] = _truncate(output)
    return {key: value for key, value in attributes.items() if value is not None}


def _metadata_attributes(metadata: dict[str, Any]) -> dict[str, Any]:
    attributes: dict[str, Any] = {}
    for key, value in metadata.items():
        if value is None:
            continue
        attributes[f"cdp.{_snake_case(key)}"] = _truncate(value, max_chars=4_000)
    return attributes


def _truncate(value: Any, *, max_chars: int = MAX_CONTENT_CHARS) -> str:
    text = value if isinstance(value, str) else repr(value)
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}...[truncated]"


def _snake_case(value: str) -> str:
    output = []
    for index, char in enumerate(value):
        if char.isupper() and index > 0:
            output.append("_")
        output.append(char.lower() if char.isalnum() else "_")
    return "".join(output).strip("_")


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_float(value: str | None, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default
