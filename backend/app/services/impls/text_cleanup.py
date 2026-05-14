"""Normalize disclosed free-text fields (action / project titles + descriptions)
before they're returned to the UI.

Disclosed strings arrive with assorted display junk: trailing newlines (real
'\\n' and the literal two-char escape that survives CSV round-trips) and stray
leading/trailing quote characters. This module collapses both.
"""

import re

_QUOTE_CHARS = frozenset("\"'`‘’“”")

_NEWLINE_PATTERN = re.compile(r"\\n|[\r\n\t]+")
_WHITESPACE_PATTERN = re.compile(r"\s+")


def clean_disclosed_text(value: str | None) -> str | None:
    """Strip newlines/tabs (real and literal '\\n') and stray surrounding
    quote chars (including escape-sequence leftovers like \\' and \\")."""
    if not value:
        return value
    text = _NEWLINE_PATTERN.sub(" ", value)
    text = _WHITESPACE_PATTERN.sub(" ", text).strip()
    return _strip_quote_chars(text)


def _strip_quote_chars(text: str) -> str:
    # Handles both plain quote chars and CSV/JSON escape-sequence leftovers.
    while text:
        if len(text) >= 2 and text[0] == "\\" and text[1] in _QUOTE_CHARS:
            text = text[2:].lstrip()
        elif text[0] in _QUOTE_CHARS:
            text = text[1:].lstrip()
        else:
            break
    while text:
        if len(text) >= 2 and text[-1] in _QUOTE_CHARS and text[-2] == "\\":
            text = text[:-2].rstrip()
        elif text[-1] in _QUOTE_CHARS:
            text = text[:-1].rstrip()
        else:
            break
    return text
