class InvalidLocationError(Exception):
    """Raised when client-supplied location data is invalid."""


class LocationServiceError(Exception):
    """Raised when location context cannot be prepared cleanly."""


class LLMServiceError(Exception):
    """Base exception for upstream LLM service failures."""


class LLMAuthError(LLMServiceError):
    """Raised when the upstream LLM rejects authentication."""


class LLMRateLimitError(LLMServiceError):
    """Raised when the upstream LLM enforces a quota or rate limit."""


class LLMTimeoutError(LLMServiceError):
    """Raised when the upstream LLM call exceeds the allowed timeout."""
