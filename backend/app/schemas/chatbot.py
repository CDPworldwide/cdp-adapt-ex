from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.location_context import LocationContext


class OpenAIChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=10000)


class OpenAIChatCompletionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    messages: List[OpenAIChatMessage]
    location_data: LocationContext
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, gt=0)


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
