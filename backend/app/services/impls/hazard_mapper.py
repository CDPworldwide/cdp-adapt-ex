"""Hazard mapping logic."""

import re
from typing import Dict, List, Optional

from app.schemas.location import Hazard, HazardEnum
from app.shared.logging import logger

_HAZARD_SPLIT_REGEX = re.compile(r"[|]")

# Hazard mapping from database strings to enums.
# Public; also consumed by disclosure-trends aggregation.
HAZARD_STRING_TO_ENUM: Dict[str, HazardEnum] = {
    "Heat stress": HazardEnum.HEAT_STRESS,
    "Extreme heat": HazardEnum.EXTREME_HEAT,
    "Extreme cold": HazardEnum.EXTREME_COLD,
    "Snow and ice": HazardEnum.SNOW_AND_ICE,
    "Drought": HazardEnum.DROUGHT,
    "Water stress": HazardEnum.WATER_STRESS,
    "Increased water demand": HazardEnum.INCREASED_WATER_DEMAND,
    "Fire weather (risk of wildfires)": HazardEnum.FIRE_WEATHER,
    "Urban flooding": HazardEnum.URBAN_FLOODING,
    "River flooding": HazardEnum.RIVER_FLOODING,
    "Coastal flooding (incl. sea level rise)": HazardEnum.COASTAL_FLOODING,
    "Other coastal events": HazardEnum.OTHER_COASTAL_EVENTS,
    "Oceanic events": HazardEnum.OCEANIC_EVENTS,
    "Hurricanes, cyclones, and/or typhoons": HazardEnum.TROPICAL_CYCLONE,
    "Extreme wind": HazardEnum.EXTREME_WIND,
    "Storm": HazardEnum.STORM,
    "Heavy precipitation": HazardEnum.HEAVY_PRECIPITATION,
    "Mass movement": HazardEnum.MASS_MOVEMENT,
    "Loss of green space/green cover": HazardEnum.LOSS_OF_GREEN_SPACE,
    "Soil degradation/erosion": HazardEnum.SOIL_DEGRADATION_EROSION,
    "Other: Landslides": HazardEnum.SOIL_DEGRADATION_EROSION,
    "Other forms of climate-induced landscape shift/degradation": HazardEnum.LANDSCAPE_SHIFT_DEGRADATION,
    "Infectious disease": HazardEnum.INFECTIOUS_DISEASE,
    "Biodiversity loss": HazardEnum.BIODIVERSITY_LOSS,
}


class HazardMapper:
    """Utility to map raw database hazard strings to typed enums."""

    def map_string_to_hazard(
        self, db_string: str | None, org_id: Optional[int] = None
    ) -> Optional[Hazard]:
        """Convert database string to a Hazard object.

        - Converts known hazard strings to the appropriate HazardEnum.
        - For "Other: <details>" strings, it sets type to OTHERS and extracts details.
        - If a hazard is unknown, logs a warning and returns None.
        - Returns None for empty strings or "Other:" without details.
        """
        if db_string is None:
            return None
        normalized_string = db_string.strip()
        if not normalized_string:
            return None

        if normalized_string.startswith("Other:"):
            details = normalized_string.removeprefix("Other:").strip()
            # Strip leading list-marker punctuation a few rows have: "- ", "• ",
            # "* ", em/en dashes etc., then force the first letter uppercase so
            # entries like "Other: - risk of disruption..." render as
            # "Risk of disruption...".
            details = re.sub(r"^[-–—*•·]+\s*", "", details)
            if details:
                details = details[0].upper() + details[1:]
            if not details:
                return None  # Ignore "Other:" if no details are provided
            return Hazard(
                hazard_type=HazardEnum.OTHERS,
                other_hazard_details=details,
            )

        hazard_type = HAZARD_STRING_TO_ENUM.get(normalized_string)
        if hazard_type is None:
            log_message = f"Unknown hazard: '{db_string}'"
            if org_id:
                log_message += f" for org_id={org_id}"
            logger.warning(log_message)
            return None

        return Hazard(hazard_type=hazard_type)

    def split_and_map_hazards(
        self, hazards_field: Optional[str], org_id: Optional[int] = None
    ) -> List[Hazard]:
        """Split a hazards string by delimiters and map each to a Hazard.

        Supports comma and semicolon separators. Strips whitespace from each token.
        Empty parts are ignored.
        """
        if not hazards_field:
            return []
        parts = [
            p.strip() for p in _HAZARD_SPLIT_REGEX.split(hazards_field) if p.strip()
        ]

        return [
            mapped_hazard
            for p in parts
            if (mapped_hazard := self.map_string_to_hazard(p, org_id=org_id))
        ]
