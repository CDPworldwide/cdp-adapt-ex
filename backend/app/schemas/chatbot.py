from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.location_context import LocationContext
from app.shared.config import settings


class OpenAIChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=10000)


class OpenAIChatCompletionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    messages: List[OpenAIChatMessage] = Field(
        min_length=1,
        max_length=settings.MAX_CHAT_MESSAGES,
    )
    location_data: LocationContext
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(
        default=None,
        gt=0,
        le=settings.MAX_CHAT_MAX_TOKENS,
    )

    @model_validator(mode="after")
    def validate_total_message_chars(self):
        total_message_chars = sum(len(message.content) for message in self.messages)
        if total_message_chars > settings.MAX_CHAT_TOTAL_CHARS:
            raise ValueError(
                "Combined message content exceeds the configured chat request limit"
            )
        if any(message.role == "system" for message in self.messages):
            raise ValueError("Client-supplied system messages are not allowed")
        return self


class OpenAIChatCompletionChoice(BaseModel):
    index: int
    message: OpenAIChatMessage
    finish_reason: str


class OpenAIUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class OpenAIChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[OpenAIChatCompletionChoice]
    usage: OpenAIUsage
