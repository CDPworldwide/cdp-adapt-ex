from enum import Enum
from typing import Literal, Union

from pydantic import BaseModel, Field

from app.schemas.location_v2 import HazardEnum


class YearRange(BaseModel):
    start: int = Field(..., description="Start year of the range.")
    end: int = Field(..., description="End year of the range.")


class ScenarioEnum(str, Enum):
    HISTORICAL = "historical"
    SSP126 = "ssp126"
    SSP245 = "ssp245"
    SSP370 = "ssp370"
    SSP585 = "ssp585"


class HazardLayerData(BaseModel):
    type: str


class TileHazardLayerData(HazardLayerData):
    type: Literal["tile"] = "tile"  # Add literal type for discriminator
    tile_url: str = Field(..., description="Map tile url for the hazard layer.")


# Create a Union of all possible hazard data types
HazardData = Union[TileHazardLayerData]


class HazardLayer(BaseModel):
    name: HazardEnum = Field(..., description="Type of the hazard layer.")
    hazard_data: HazardData = Field(..., discriminator="type")


class HazardLayerOptions(BaseModel):
    scenarios: list[ScenarioEnum]
    year_ranges: list[YearRange] | None = None
    historical_year_range: YearRange | None = None
    palette: list[str]
    source: str | None = None
    partial_image_id_templates: dict[str, str]
