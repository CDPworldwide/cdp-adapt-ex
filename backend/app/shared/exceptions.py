"""Custom domain exceptions for the application."""


class CityNotFoundException(Exception):
    """Raised when a requested city cannot be found in the database."""

    def __init__(self, city_name: str):
        self.city_name = city_name
        super().__init__(f"City not found: {city_name}")


class MultipleCitiesFoundException(Exception):
    """Raised when multiple cities match the requested name."""

    def __init__(self, city_name: str, candidates: list):
        self.city_name = city_name
        self.candidates = candidates
        super().__init__(f"Multiple cities found for: {city_name}")


class HazardLayerNotFoundException(Exception):
    """Raised when a requested hazard layer is not found in the hazard config."""

    def __init__(self, hazard_name: str):
        self.hazard_name = hazard_name
        super().__init__(f"Hazard layer not found: {hazard_name}")


class CityGeometryMissingException(Exception):
    """Raised when a city is found but lacks valid geometry or coordinate data."""

    def __init__(self, city_name: str):
        self.city_name = city_name
        super().__init__(f"City '{city_name}' has invalid or missing geometry data")


class LLMServiceError(Exception):
    """Base exception for upstream LLM service failures."""


class LLMAuthError(LLMServiceError):
    """Raised when the upstream LLM rejects authentication."""


class LLMRateLimitError(LLMServiceError):
    """Raised when the upstream LLM enforces a quota or rate limit."""


class LLMTimeoutError(LLMServiceError):
    """Raised when the upstream LLM call exceeds the allowed timeout."""
