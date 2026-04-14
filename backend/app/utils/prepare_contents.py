from typing import List

from google.genai import types

from app.schemas.chatbot import OpenAIChatMessage
from app.shared.logging import logger


def prepare_contents(messages: List[OpenAIChatMessage]) -> tuple[list, int]:
    """Prepare conversation contents for Gemini API.

    Args:
        messages: List of OpenAI chat messages

    Returns:
        Tuple of (contents list, system message count)
    """
    contents = []
    system_message_count = 0

    for msg in messages:
        if msg.role == "system":
            system_message_count += 1
            continue
        contents.append(
            types.Content(
                role=msg.role if msg.role != "assistant" else "model",
                parts=[types.Part.from_text(text=msg.content)],
            )
        )

    if system_message_count > 0:
        logger.info(
            "system_messages_filtered",
            count=system_message_count,
            message="System messages filtered (system_instruction used instead)",
        )

    return contents, system_message_count
