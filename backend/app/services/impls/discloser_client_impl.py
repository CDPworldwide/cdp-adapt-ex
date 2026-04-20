import os
from typing import Any

import requests

from app.services.interfaces.discloser_client import DiscloserClient

DEFAULT_DISCLOSER_SERVICE_BASE_URL = (
    "https://discloser-profile-service-pbybuiwoxq-uc.a.run.app"
)


class DiscloserClientImpl(DiscloserClient):
    """HTTP client for organization geometry lookups.

    The client reads `DISCLOSER_SERVICE_BASE_URL` from the environment when
    `base_url` is not passed explicitly.
    """

    def __init__(self, base_url: str | None = None, timeout_seconds: float = 10.0):
        self.base_url = (
            base_url
            or os.getenv(
                "DISCLOSER_SERVICE_BASE_URL",
                DEFAULT_DISCLOSER_SERVICE_BASE_URL,
            )
        ).rstrip("/")
        self.timeout_seconds = timeout_seconds

    def get_geometry_by_organization_id(
        self, organization_id: str
    ) -> dict[str, Any] | None:
        """Fetch geometry for a CRM organization/account key.

        Args:
            organization_id: CRM account key used by the discloser profile service.

        Returns:
            Geometry object when available, None when organization/geometry is not found.

        Raises:
            RuntimeError: When the service is unreachable, returns a non-404 HTTP
                status, or returns an invalid payload shape.
        """
        endpoint = f"{self.base_url}/api/v1/db/crm_entity/{organization_id}/geometry"

        try:
            response = requests.get(endpoint, timeout=self.timeout_seconds)
        except requests.RequestException as exc:
            raise RuntimeError(
                f"Unable to reach discloser service at {self.base_url}"
            ) from exc

        if response.status_code == 404:
            return None

        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            raise RuntimeError(
                f"Discloser service request failed with status {response.status_code}: {endpoint}"
            ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise RuntimeError("Discloser service returned invalid JSON") from exc

        if not isinstance(payload, dict):
            raise RuntimeError("Discloser service returned an invalid payload")

        geometry = payload.get("geometry")
        if geometry is None:
            return None
        if not isinstance(geometry, dict):
            raise RuntimeError("Discloser service returned an invalid geometry payload")
        return geometry


discloser_client = DiscloserClientImpl()
