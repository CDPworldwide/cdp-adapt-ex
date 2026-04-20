from typing import Any, Protocol


class DiscloserClient(Protocol):
    """Contract for looking up organization geometry from the discloser service."""

    def get_geometry_by_organization_id(
        self, organization_id: str
    ) -> dict[str, Any] | None: ...
