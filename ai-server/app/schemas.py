import time
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.settings import get_settings

CONTEXT_AREAS = {"hazards", "actions", "solutions"}


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str | list[dict[str, Any]] = Field(min_length=1)

    def text_content(self) -> str:
        if isinstance(self.content, str):
            return self.content
        return "".join(
            part.get("text", "")
            for part in self.content
            if part.get("type") == "text" and isinstance(part.get("text"), str)
        )


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    model: str | None = None
    messages: list[ChatMessage] = Field(min_length=1)
    stream: bool = False
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, gt=0)
    metadata: dict[str, Any] | None = None
    context_area: Literal["hazards", "actions", "solutions"] | None = Field(
        default=None, alias="contextArea"
    )
    location_data: dict[str, Any] | None = Field(default=None, alias="locationData")

    @model_validator(mode="after")
    def validate_request(self):
        settings = get_settings()
        if len(self.messages) > settings.max_chat_messages:
            raise ValueError("Too many chat messages")
        total_chars = sum(len(message.text_content()) for message in self.messages)
        if total_chars > settings.max_chat_total_chars:
            raise ValueError("Combined message content exceeds the chat request limit")
        if any(message.role == "system" for message in self.messages):
            raise ValueError("Client-supplied system messages are not allowed")
        return self

    def resolved_location_data(self) -> dict[str, Any] | None:
        if self.location_data is not None:
            return self.location_data
        if self.metadata and isinstance(self.metadata.get("locationData"), dict):
            return self.metadata["locationData"]
        return None

    def resolved_context_area(self) -> str | None:
        inferred_area = self.inferred_context_area()
        if inferred_area is not None:
            return inferred_area
        if self.context_area is not None:
            return self.context_area
        if self.metadata and self.metadata.get("contextArea") in CONTEXT_AREAS:
            return self.metadata["contextArea"]
        location_data = self.resolved_location_data()
        if location_data and location_data.get("contextArea") in CONTEXT_AREAS:
            return location_data["contextArea"]
        return None

    def inferred_context_area(self) -> str | None:
        latest_user_message = next(
            (
                message.text_content().lower()
                for message in reversed(self.messages)
                if message.role == "user"
            ),
            "",
        )
        if not latest_user_message:
            return None

        comparison_terms = ("compare", "comparison", "side-by-side", "side by side")
        if any(term in latest_user_message for term in comparison_terms):
            return None

        if any(
            term in latest_user_message
            for term in (
                "peer solution",
                "peer action",
                "best practice",
                "best practices",
                "copy from",
                "learn from",
                "other cities",
                "other locations",
                "similar cities",
                "similar locations",
                "solution idea",
                "solution ideas",
                "action ideas",
            )
        ):
            return "solutions"

        if any(
            term in latest_user_message
            for term in (
                "vulnerable population",
                "vulnerable group",
                "adaptation action",
                "adaptation actions",
                "resilience action",
                "resilience actions",
                "action source",
                "action sources",
                "action reference",
                "action references",
                "which actions",
                "what actions",
                "actions",
                "project",
                "projects",
                "projects seeking funding",
                "projects are seeking funding",
                "project seeking funding",
                "seeking funding",
                "seeking finance",
                "need funding",
                "needs funding",
                "funding needed",
                "funding gap",
                "funding gaps",
            )
        ):
            return "actions"

        if any(
            term in latest_user_message
            for term in (
                "hazard",
                "rankings provided",
                "ranking provided",
                "severity order",
                "climate context",
                "on the rise",
            )
        ):
            return "hazards"

        return None

    def with_resolved_location_data(
        self, location_data: dict[str, Any]
    ) -> "ChatCompletionRequest":
        context_area = self.resolved_context_area()
        update: dict[str, Any] = {"location_data": location_data}
        if context_area:
            update["context_area"] = context_area
        return self.model_copy(update=update)


class ChatCompletionResponseMessage(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str


class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatCompletionResponseMessage
    finish_reason: str = "stop"


class Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatCompletionResponse(BaseModel):
    id: str = Field(default_factory=lambda: f"chatcmpl-{int(time.time())}")
    object: Literal["chat.completion"] = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: list[ChatCompletionChoice]
    usage: Usage = Field(default_factory=Usage)


class ModelInfo(BaseModel):
    id: str
    object: Literal["model"] = "model"
    created: int = 0
    owned_by: str = "cdp"


class ModelsResponse(BaseModel):
    object: Literal["list"] = "list"
    data: list[ModelInfo]


class SuggestFollowUpsResponse(BaseModel):
    follow_up_questions: list[str] = Field(min_length=1, max_length=3)
