"""Initializes and provides a singleton instance of the Earth Engine client."""

import ee

from app.shared.config import settings


class EarthEngineClient:
    def __init__(self):
        self._initialize_ee()
        self.client = ee

    def _initialize_ee(self):
        """Initializes the Earth Engine client."""
        ee.Initialize(project=settings.GCP_PROJECT_ID)

    def get_client(self):
        """Returns the initialized Earth Engine client."""
        return self.client
