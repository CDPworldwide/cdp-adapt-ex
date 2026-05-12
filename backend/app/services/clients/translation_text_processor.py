import re
from dataclasses import dataclass


ACRONYM_PATTERN = re.compile(
    r"\b(?:[A-Za-z]{1,2}\.)+[A-Za-z]\.?(?=\W|$)|\b(?=[A-Z0-9/-]{2,}\b)(?=[A-Z0-9/-]*[A-Z])[A-Z0-9]+(?:[/-][A-Z0-9]+)*\b"
)
LOWERCASE_PATTERN = re.compile(r"[a-z]")
UPPERCASE_WORD_PATTERN = re.compile(r"\b[A-Z]{2,}\b")
PLACEHOLDER_TEMPLATE = "{{PACACRONYM{index}}}"


@dataclass(frozen=True)
class PreparedText:
    text: str
    placeholders: dict[str, str]


def protect_acronyms(text: str) -> PreparedText:
    placeholders: dict[str, str] = {}
    has_lowercase = bool(LOWERCASE_PATTERN.search(text))
    uppercase_word_count = len(UPPERCASE_WORD_PATTERN.findall(text))

    def replace(match: re.Match[str]) -> str:
        token = match.group(0)
        is_dotted = "." in token
        has_symbol = bool(re.search(r"[0-9/-]", token))

        if not is_dotted and not has_symbol and not has_lowercase and uppercase_word_count > 2:
            return token

        placeholder = PLACEHOLDER_TEMPLATE.format(index=len(placeholders))
        placeholders[placeholder] = token
        return placeholder

    return PreparedText(text=ACRONYM_PATTERN.sub(replace, text), placeholders=placeholders)


def restore_acronyms(text: str, placeholders: dict[str, str]) -> str:
    restored = text
    for placeholder, original in placeholders.items():
        restored = restored.replace(placeholder, original)
    return restored
