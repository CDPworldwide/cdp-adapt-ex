import json
import logging
from dataclasses import dataclass

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel

from app.errors import LLMAuthError, LLMRateLimitError, LLMServiceError
from app.observability import generation_observation
from app.prompts import build_system_prompt
from app.schemas import ChatCompletionRequest
from app.settings import Settings

logger = logging.getLogger("uvicorn.error")

RESPONSE_REPLACEMENTS = {
    "Community participation": "Resident involvement",
    "community participation": "resident involvement",
    "Increased security/protection for poor/vulnerable populations": "Greater safety for lower-income or higher-risk communities",
    "increased security/protection for poor/vulnerable populations": "greater safety for lower-income or higher-risk communities",
    "security and protection for poor and vulnerable populations": "safety for lower-income or higher-risk communities",
    "increased security and protection": "greater safety",
    "co-benefits": "benefits",
    "Co-benefits": "Benefits",
    "resilience enhanced": "resilience benefits",
    "Resilience enhanced": "Resilience benefits",
    "dropdown labels": "source labels",
    "Dropdown labels": "Source labels",
}


@dataclass
class GeminiCompletion:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0


class GeminiProvider:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = genai.Client(api_key=self.settings.llm_api_key)
        return self._client

    def build_generation_config(
        self,
        request: ChatCompletionRequest,
        prompt_name: str = "system_prompt.md",
        response_schema: type[BaseModel] | None = None,
    ) -> types.GenerateContentConfig:
        system_instruction = build_system_prompt(
            request.resolved_location_data(),
            prompt_name,
            context_area=request.resolved_context_area(),
        )
        config = types.GenerateContentConfig(
            temperature=(
                request.temperature
                if request.temperature is not None
                else self.settings.default_temperature
            ),
            max_output_tokens=min(
                request.max_tokens or self.settings.max_tokens,
                self.settings.max_tokens,
            ),
            system_instruction=system_instruction,
        )
        config.thinking_config = types.ThinkingConfig(thinking_budget=0)
        if response_schema is not None:
            config.response_mime_type = "application/json"
            config.response_schema = response_schema
        return config

    async def generate(
        self,
        request: ChatCompletionRequest,
        prompt_name: str = "system_prompt.md",
        response_schema: type[BaseModel] | None = None,
    ):
        contents = _prepare_contents(request.messages)
        config = self.build_generation_config(
            request,
            prompt_name=prompt_name,
            response_schema=response_schema,
        )
        if self.settings.log_llm_prompts:
            _log_llm_prompt_payload(
                request=request,
                prompt_name=prompt_name,
                model=self.settings.llm_model,
                system_instruction=str(config.system_instruction or ""),
            )

        model_parameters = {
            "temperature": (
                request.temperature
                if request.temperature is not None
                else self.settings.default_temperature
            ),
            "max_output_tokens": min(
                request.max_tokens or self.settings.max_tokens,
                self.settings.max_tokens,
            ),
            "response_mime_type": getattr(config, "response_mime_type", None),
        }

        try:
            with generation_observation(
                request=request,
                prompt_name=prompt_name,
                model=self.settings.llm_model,
                model_parameters={
                    key: value
                    for key, value in model_parameters.items()
                    if value is not None
                },
            ) as observation:
                response = await self.client.aio.models.generate_content(
                    model=self.settings.llm_model,
                    contents=contents,
                    config=config,
                )
                observation.update(
                    output=_safe_response_text(response),
                    usage_details=_response_usage_details(response),
                )
                return response
        except Exception as exc:
            _raise_typed_llm_error(exc)

    async def complete(self, request: ChatCompletionRequest) -> GeminiCompletion:
        if self.settings.mock_response:
            location = request.resolved_location_data() or {}
            location_name = location.get("name") or "the selected location"
            return GeminiCompletion(
                text=self.settings.mock_response.replace("{location}", location_name)
            )

        response = await self.generate(request)
        completion = _build_completion(response)
        completion.text = sanitize_response_text(completion.text)
        return completion


def sanitize_response_text(text: str) -> str:
    sanitized = text
    for source, replacement in RESPONSE_REPLACEMENTS.items():
        sanitized = sanitized.replace(source, replacement)
    return sanitized


def _prepare_contents(messages):
    contents = []
    for message in messages:
        role = "model" if message.role == "assistant" else "user"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part(text=message.text_content())],
            )
        )
    return contents


def _log_llm_prompt_payload(
    request: ChatCompletionRequest,
    prompt_name: str,
    model: str,
    system_instruction: str,
) -> None:
    payload = {
        "event": "llm_prompt_payload",
        "promptName": prompt_name,
        "model": model,
        "contextArea": request.resolved_context_area(),
        "messages": [
            {"role": message.role, "content": message.text_content()}
            for message in request.messages
        ],
        "systemInstruction": system_instruction,
    }
    logger.info(
        "llm_prompt_payload\n%s",
        json.dumps(payload, ensure_ascii=False, indent=2),
    )


def _extract_response_text(response) -> str:
    try:
        return response.text or ""
    except ValueError:
        pass

    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        raise LLMServiceError("LLM returned no candidates")

    parts = getattr(getattr(candidates[0], "content", None), "parts", None) or []
    text = "".join(part.text for part in parts if getattr(part, "text", None))
    if text:
        return text

    finish_reason = getattr(candidates[0], "finish_reason", None)
    if finish_reason is not None:
        raise LLMServiceError(
            f"LLM returned no text content (finish_reason={finish_reason})"
        )
    raise LLMServiceError("LLM returned no text content")


def _build_completion(response) -> GeminiCompletion:
    usage_metadata = getattr(response, "usage_metadata", None)
    prompt_tokens = getattr(usage_metadata, "prompt_token_count", 0) or 0
    completion_tokens = getattr(usage_metadata, "candidates_token_count", 0) or 0
    _raise_if_truncated(response)
    return GeminiCompletion(
        text=_extract_response_text(response),
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )


def _safe_response_text(response) -> str:
    try:
        return _extract_response_text(response)
    except Exception:
        return ""


def _response_usage_details(response) -> dict[str, int]:
    usage_metadata = getattr(response, "usage_metadata", None)
    prompt_tokens = getattr(usage_metadata, "prompt_token_count", 0) or 0
    completion_tokens = getattr(usage_metadata, "candidates_token_count", 0) or 0
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
    }


def _raise_if_truncated(response) -> None:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return

    finish_reason = getattr(candidates[0], "finish_reason", None)
    finish_reason_name = getattr(finish_reason, "name", str(finish_reason)).upper()
    if finish_reason_name.endswith("MAX_TOKENS"):
        raise LLMServiceError("LLM response was truncated before completion")


def _raise_typed_llm_error(exc: Exception) -> None:
    if isinstance(exc, LLMServiceError):
        raise exc

    if isinstance(exc, genai_errors.ClientError):
        status = getattr(exc, "status", None)
        if status in {401, 403}:
            raise LLMAuthError(str(exc)) from exc
        if status == 429:
            raise LLMRateLimitError(str(exc)) from exc
        raise LLMServiceError(str(exc)) from exc

    if isinstance(exc, genai_errors.ServerError):
        raise LLMServiceError(str(exc)) from exc

    error_msg = str(exc).lower()
    if "api key" in error_msg or "authentication" in error_msg:
        raise LLMAuthError(str(exc)) from exc
    if "rate limit" in error_msg or "quota" in error_msg:
        raise LLMRateLimitError(str(exc)) from exc
    raise LLMServiceError(str(exc)) from exc
