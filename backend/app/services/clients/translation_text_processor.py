import re
from dataclasses import dataclass


ACRONYM_PATTERN = re.compile(
    r"\b(?=[A-Z0-9/-]{2,}\b)(?=[A-Z0-9/-]*[A-Z])[A-Z0-9]+(?:[/-][A-Z0-9]+)*\b"
)
PLACEHOLDER_TEMPLATE = "[[PAC_ACRONYM_{index}]]"


@dataclass(frozen=True)
class PreparedText:
    text: str
    placeholders: dict[str, str]


def protect_acronyms(text: str) -> PreparedText:
    placeholders: dict[str, str] = {}

    def replace(match: re.Match[str]) -> str:
        placeholder = PLACEHOLDER_TEMPLATE.format(index=len(placeholders))
        placeholders[placeholder] = match.group(0)
        return placeholder

    return PreparedText(text=ACRONYM_PATTERN.sub(replace, text), placeholders=placeholders)


def restore_acronyms(text: str, placeholders: dict[str, str]) -> str:
    restored = text
    for placeholder, original in placeholders.items():
        restored = restored.replace(placeholder, original)
    return restored
