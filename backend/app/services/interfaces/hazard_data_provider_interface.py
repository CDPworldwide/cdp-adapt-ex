from typing import Optional, Protocol

from app.schemas.hazard_layer import HazardLayer, ScenarioEnum, YearRange
from app.schemas.location import HazardEnum


class HazardDataProviderInterface(Protocol):
    def fetch_hazard_layer(
        self,
        hazard_type: HazardEnum,
        scenario: ScenarioEnum,
        year_range: Optional[YearRange] = None,
    ) -> HazardLayer: ...
