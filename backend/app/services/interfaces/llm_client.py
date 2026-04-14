from typing import Protocol

from google.genai import types
from pydantic import BaseModel

from app.schemas.chatbot import (
    OpenAIChatCompletionRequest,
)


class LLMClient(Protocol):
    def llm_chat_completion_response_sync(
        self,
        chat_request: OpenAIChatCompletionRequest,
        system_prompt_name: str,
        response_schema: type[BaseModel] | None = None,
        analytics_context: dict | None = None,
    ) -> types.GenerateContentResponse: ...

    async def llm_chat_completion_response_async(
        self,
        chat_request: OpenAIChatCompletionRequest,
        system_prompt_name: str,
        response_schema: type[BaseModel] | None = None,
        analytics_context: dict | None = None,
    ) -> types.GenerateContentResponse: ...
