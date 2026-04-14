from google import genai
from google.genai import types
from pydantic import BaseModel

from app.schemas.chatbot import OpenAIChatCompletionRequest
from app.shared.config import settings
from app.utils.prepare_contents import prepare_contents
from app.utils.prompts import build_system_prompt


class GeminiLLMClient:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = genai.Client(api_key=settings.LLM_API_KEY)
        return self._client

    def build_generation_config(
        self,
        chat_request: OpenAIChatCompletionRequest,
        system_prompt_name: str,
        response_schema: type[BaseModel] | None = None,
    ) -> types.GenerateContentConfig:
        system_prompt = build_system_prompt(
            system_prompt_name,
            chat_request.location_data,
        )

        config = types.GenerateContentConfig(
            temperature=self.resolve_temperature(chat_request, system_prompt_name),
            max_output_tokens=chat_request.max_tokens or settings.MAX_TOKENS,
            system_instruction=system_prompt,
        )

        if system_prompt_name == "suggest_follow_ups.md":
            config.thinking_config = types.ThinkingConfig(thinking_budget=0)

        if response_schema:
            config.response_mime_type = "application/json"
            config.response_schema = response_schema

        return config

    def resolve_temperature(
        self,
        chat_request: OpenAIChatCompletionRequest,
        system_prompt_name: str,
    ) -> float:
        if chat_request.temperature is not None:
            return chat_request.temperature
        if system_prompt_name == "suggest_follow_ups.md":
            return 0.0
        return settings.DEFAULT_LLM_TEMPERATURE

    def llm_chat_completion_response_sync(
        self,
        chat_request: OpenAIChatCompletionRequest,
        system_prompt_name: str,
        response_schema: type[BaseModel] | None = None,
        analytics_context: dict | None = None,
    ) -> types.GenerateContentResponse:
        """Returns a synchronous response from the LLM."""
        contents, _ = prepare_contents(chat_request.messages)
        client = self.client

        return client.models.generate_content(
            model=settings.LLM_MODEL,
            contents=contents,
            config=self.build_generation_config(
                chat_request,
                system_prompt_name,
                response_schema,
            ),
        )

    async def llm_chat_completion_response_async(
        self,
        chat_request: OpenAIChatCompletionRequest,
        system_prompt_name: str,
        response_schema: type[BaseModel] | None = None,
        analytics_context: dict | None = None,
    ) -> types.GenerateContentResponse:
        """Returns an asynchronous response from the LLM."""
        contents, _ = prepare_contents(chat_request.messages)
        client = self.client

        if hasattr(client, "aio"):
            return await client.aio.models.generate_content(
                model=settings.LLM_MODEL,
                contents=contents,
                config=self.build_generation_config(
                    chat_request,
                    system_prompt_name,
                    response_schema,
                ),
            )

        from starlette.concurrency import run_in_threadpool

        return await run_in_threadpool(
            self.llm_chat_completion_response_sync,
            chat_request,
            system_prompt_name,
            response_schema,
            analytics_context,
        )


gemini_service = GeminiLLMClient()
