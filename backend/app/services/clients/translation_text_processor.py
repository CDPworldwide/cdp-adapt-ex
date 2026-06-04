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


@dataclass(frozen=True)
class AcronymValidationResult:
    is_valid: bool
    missing: list[str]
    duplicated: list[str]
    mutated: list[str]


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


def extract_protected_acronyms(text: str) -> list[str]:
    return list(protect_acronyms(text).placeholders.values())


def validate_restored_acronyms(
    original_text: str, translated_text: str
) -> AcronymValidationResult:
    expected = extract_protected_acronyms(original_text)
    missing: list[str] = []
    duplicated: list[str] = []

    for token in expected:
        count = translated_text.count(token)
        if count == 0:
            missing.append(token)
        elif count > expected.count(token):
            duplicated.append(token)

    translated_acronyms = extract_protected_acronyms(translated_text)
    expected_unique = set(expected)
    mutated = [
        token
        for token in translated_acronyms
        if token not in expected_unique and _looks_like_mutated_acronym(token, expected_unique)
    ]

    return AcronymValidationResult(
        is_valid=not missing and not duplicated and not mutated,
        missing=missing,
        duplicated=duplicated,
        mutated=mutated,
    )


def _looks_like_mutated_acronym(token: str, expected: set[str]) -> bool:
    normalized = _normalize_acronym(token)
    return any(normalized == _normalize_acronym(candidate) for candidate in expected)


def _normalize_acronym(token: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", token.upper())
