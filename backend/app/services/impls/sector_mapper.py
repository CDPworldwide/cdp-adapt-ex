"""Sector mapping logic."""

import re
from typing import Dict, List, Optional

from app.schemas.location_v2 import Sector, SectorEnum
from app.shared.logging import logger

_SECTOR_SPLIT_REGEX = re.compile(r"[|]")

# Sector mapping from database strings to enums.
_SECTOR_MAPPING: Dict[str, SectorEnum] = {
    "Agriculture": SectorEnum.AGRICULTURE,
    "Forestry": SectorEnum.FORESTRY,
    "Fishing": SectorEnum.FISHING,
    "Mining and quarrying": SectorEnum.MINING_QUARRYING,
    "Manufacturing": SectorEnum.MANUFACTURING,
    "Electricity, gas, steam and air conditioning supply": SectorEnum.ELECTRICITY_GAS_STEAM_AIR,
    "Water supply": SectorEnum.WATER_SUPPLY,
    "Sewerage, waste management and remediation activities": SectorEnum.SEWERAGE_WASTE_REMEDIATION,
    "Waste management": SectorEnum.WASTE_MANAGEMENT,
    "Administrative and support service activities": SectorEnum.ADMIN_SUPPORT_SERVICES,
    "Public administration and defence; compulsory social security": SectorEnum.PUBLIC_ADMIN_DEFENCE,
    "Conservation": SectorEnum.CONSERVATION,
    "Construction": SectorEnum.CONSTRUCTION,
    "Wholesale and retail trade; repair of motor vehicles and motorcycles": SectorEnum.WHOLESALE_RETAIL_TRADE,
    "Transportation and storage": SectorEnum.TRANSPORTATION_STORAGE,
    "Accommodation and food service activities": SectorEnum.ACCOMMODATION_FOOD_SERVICE,
    "Information and communication": SectorEnum.INFORMATION_COMMUNICATION,
    "Financial and insurance activities": SectorEnum.FINANCIAL_INSURANCE,
    "Real estate activities": SectorEnum.REAL_ESTATE,
    "Professional, scientific and technical activities": SectorEnum.PROFESSIONAL_SCIENTIFIC_TECHNICAL,
    "Education": SectorEnum.EDUCATION,
    "Human health and social work activities": SectorEnum.HUMAN_HEALTH_SOCIAL_WORK,
    "Arts, entertainment and recreation": SectorEnum.ARTS_ENTERTAINMENT_RECREATION,
}


class SectorMapper:
    """Utility to map raw database sector strings to typed enums."""

    def map_string_to_sector(
        self, db_string: str | None, org_id: Optional[int] = None
    ) -> Optional[Sector]:
        """Convert database string to a Sector object."""
        if db_string is None:
            return None
        normalized_string = db_string.strip()
        if not normalized_string:
            return None

        if normalized_string.startswith("Other:"):
            details = normalized_string.removeprefix("Other:").strip()
            if not details:
                return None
            return Sector(
                sector_type=SectorEnum.OTHERS,
                other_sector_details=details,
            )

        sector_type = _SECTOR_MAPPING.get(normalized_string)
        if sector_type is None:
            log_message = f"Unknown sector: '{db_string}'"
            if org_id:
                log_message += f" for org_id={org_id}"
            logger.warning(log_message)
            return None

        return Sector(sector_type=sector_type)

    def split_and_map_sectors(
        self, sectors_field: Optional[str], org_id: Optional[int] = None
    ) -> List[Sector]:
        """Split a sectors string by pipe delimiter and map each to a Sector.

        Empty parts are ignored.
        """
        if not sectors_field:
            return []

        parts = [
            p.strip() for p in _SECTOR_SPLIT_REGEX.split(sectors_field) if p.strip()
        ]

        return [
            mapped_sector
            for p in parts
            if (mapped_sector := self.map_string_to_sector(p, org_id=org_id))
        ]
