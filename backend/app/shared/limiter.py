"""Rate limiting configuration for the application.

This module configures rate limiting using slowapi, with default limits
defined in the application settings."""

from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_client_ip(request: Request) -> str:
    """Return the original client IP when running behind a trusted proxy."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    for address in forwarded_for.split(","):
        client_ip = address.strip()
        if client_ip:
            return client_ip

    return get_remote_address(request)


# Do not apply global limits to public read endpoints. Release-day traffic can
# legitimately hit locations, pins, trends, and hazard layers many times while
# users explore the public map. Expensive endpoints should opt in with
# `@limiter.limit(...)`, as translate does.
limiter = Limiter(
    key_func=get_client_ip,
    default_limits=[],
)
