from starlette.requests import Request

from app.shared.limiter import get_client_ip, limiter


def make_request(
    headers: dict[str, str] | None = None,
    client: tuple[str, int] = ("203.0.113.7", 12345),
) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [
                (name.lower().encode(), value.encode())
                for name, value in (headers or {}).items()
            ],
            "client": client,
        }
    )


def test_get_client_ip_uses_first_forwarded_for_address() -> None:
    request = make_request(
        {"X-Forwarded-For": "198.51.100.10, 169.254.169.126"}
    )

    assert get_client_ip(request) == "198.51.100.10"


def test_get_client_ip_falls_back_to_remote_address() -> None:
    request = make_request(client=("203.0.113.22", 54321))

    assert get_client_ip(request) == "203.0.113.22"


def test_limiter_has_no_global_default_limits() -> None:
    assert limiter._default_limits == []
