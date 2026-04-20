"""Rate limiting configuration for the application.

This module configures rate limiting using slowapi, with default limits
defined in the application settings."""

from app.shared.config import settings
from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address, default_limits=settings.RATE_LIMIT_DEFAULT
)
