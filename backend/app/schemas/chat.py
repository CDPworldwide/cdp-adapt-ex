"""This file contains the chat schema for the application."""

import re
from typing import (
    List,
    Literal,
)

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from app.schemas.location_context import LocationContext


class Message(BaseModel):
    """Message model for chat endpoint.

    Attributes:
        role: The role of the message sender (user or assistant).
        content: The content of the message.
    """

    model_config = {"extra": "ignore"}

    role: Literal["user", "assistant", "system"] = Field(
        ..., description="The role of the message sender"
    )
    content: str = Field(
        ..., description="The content of the message", min_length=1, max_length=10000
    )

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        """Validate the message content.

        Args:
            v: The content to validate

        Returns:
            str: The validated content

        Raises:
            ValueError: If the content contains disallowed patterns
        """
        # Check for potentially harmful content
        if re.search(r"<script.*?>.*?</script>", v, re.IGNORECASE | re.DOTALL):
            raise ValueError("Content contains potentially harmful script tags")

        # Check for null bytes
        if "\0" in v:
            raise ValueError("Content contains null bytes")

        return v


class ChatRequest(BaseModel):
    """Request model for chat endpoint.

    Attributes:
        messages: List of messages in the conversation.
    """

    model_config = ConfigDict(populate_by_name=True)

    messages: List[Message] = Field(
        ...,
        description="List of messages in the conversation",
    )
    location_data: LocationContext
    is_resumption: bool = Field(
        default=False, description="Whether the conversation is being resumed"
    )
    resumption_text: str = Field(
        default="", description="The text to resume the conversation"
    )
    resumption_approved: bool = Field(
        default=False, description="Whether the resumption was approved"
    )
    brand_guidelines_uri: str = Field(
        default="", description="URI for brand guidelines"
    )
    script_uri: str = Field(default="", description="URI for script")
    ref_image_uri: str = Field(default="", description="URI for reference image")
    voice_overs: list[str] = Field(
        default_factory=list, description="List of voice overs"
    )


class ChatResponse(BaseModel):
    """Response model for chat endpoint.

    Attributes:
        messages: List of messages in the conversation.
    """

    messages: List[Message] = Field(
        ..., description="List of messages in the conversation"
    )
    interrupt_task: str = Field(
        default="",
        description="The instructions for the human user to resolve interrupt",
    )
    interrupt_value: str = Field(
        default="", description="The value for the human user to review"
    )
    interrupt_value_type: Literal["text", "image", "audio", "video"] = Field(
        default="text", description="The type of the value for the human user to review"
    )


class StreamResponse(BaseModel):
    """Response model for streaming chat endpoint.

    Attributes:
        content: The content of the current chunk.
        done: Whether the stream is complete.
    """

    content: str = Field(default="", description="The content of the current chunk")
    done: bool = Field(default=False, description="Whether the stream is complete")
