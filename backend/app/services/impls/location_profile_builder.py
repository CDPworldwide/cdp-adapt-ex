"""Helpers for assembling location profiles from mapped backend data."""

import json
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from app.models.location_details import DimCentral
from app.schemas.location_v2 import (
    ActionsTab,
    AdaptationAction,
    AdaptationGoal,
    HazardProfile,
    HazardsTab,
    LocationProfile,
    ProjectSeekingFunding,
    RegionalStatistics,
    SolutionCard,
    SolutionCategoryEnum,
    SolutionsTab,
)
from app.services.impls.sector_mapper import SectorMapper
from app.shared.exceptions import CityGeometryMissingException, CityNotFoundException
from app.shared.logging import logger


@dataclass
class GeometryData:
    geometry: dict[str, Any] | None
    lng: float | None
    lat: float | None

    @property
    def is_valid(self) -> bool:
        return (
            self.geometry is not None and self.lng is not None and self.lat is not None
        )


class LocationProfileBuilder:
    def __init__(self, sector_mapper: SectorMapper):
        self.sector_mapper = sector_mapper

    def build_profile(
        self,
        org_id: int,
        fallback_name: str,
        metadata: DimCentral | None,
        mapped_hazards: list[HazardProfile],
        mapped_goals: list[AdaptationGoal],
        mapped_actions: list[AdaptationAction],
        mapped_projects: list[ProjectSeekingFunding],
        mapped_solution_cards: list[SolutionCard],
    ) -> LocationProfile:
        if metadata is None:
            logger.error(
                "Data inconsistency: Metadata not found for location '%s' (org_id=%s).",
                fallback_name,
                org_id,
            )
            raise CityNotFoundException(fallback_name)

        geo_data = self.extract_geometry_and_coords(metadata.geometry)
        if not geo_data.is_valid:
            logger.error(
                "Data inconsistency: location '%s' (org_id=%s) is missing valid geometry or coordinate data.",
                fallback_name,
                org_id,
            )
            raise CityGeometryMissingException(fallback_name)

        if not metadata.disclosing_organization:
            logger.error(
                "Data inconsistency: missing disclosing_organization for org_id=%s",
                org_id,
            )
            raise CityNotFoundException(fallback_name)

        dummy_statistics = RegionalStatistics(
            population_exposed_value=None,
            population_exposed_percentage=50,
            gdp_at_risk_value=None,
            gdp_at_risk_percentage=25,
            gdp_at_risk_currency_code=None,
            vulnerable_sectors=self.sector_mapper.split_and_map_sectors(
                metadata.ranked_sectors, org_id=org_id
            ),
        )

        assert geo_data.lat is not None
        assert geo_data.lng is not None
        assert geo_data.geometry is not None

        return LocationProfile(
            organization_id=org_id,
            name=metadata.disclosing_organization,
            country_name=metadata.discloser_country_or_area or "Unknown",
            lat=geo_data.lat,
            lng=geo_data.lng,
            geometry=geo_data.geometry,
            disclosure_year=metadata.disclosing_year,
            population=metadata.current_pop,
            requesters=(
                [r.strip() for r in metadata.requesting_auth.split("|") if r.strip()]
                if metadata.requesting_auth
                else []
            ),
            hazards=HazardsTab(hazards=mapped_hazards, statistics=dummy_statistics),
            government_actions=ActionsTab(
                goals=mapped_goals,
                actions=mapped_actions,
                projects=mapped_projects,
            ),
            solutions=SolutionsTab(
                solutions=self._group_solution_cards_by_category(mapped_solution_cards),
            ),
        )

    def _group_solution_cards_by_category(
        self, solution_cards: list[SolutionCard]
    ) -> dict[SolutionCategoryEnum, list[SolutionCard]]:
        grouped: dict[SolutionCategoryEnum, list[SolutionCard]] = defaultdict(list)
        for solution_card in solution_cards:
            category = solution_card.solution_category
            if category is None:
                logger.warning(
                    "Skipping SolutionCard without solution_category: %s",
                    solution_card.solution,
                )
                continue
            grouped[category].append(solution_card)

        return dict(grouped)

    @staticmethod
    def extract_first_coordinate_pair(
        geometry: dict[str, Any],
    ) -> tuple[float, float] | None:
        """Extract the first [lng, lat] coordinate pair from a GeoJSON geometry."""
        if not isinstance(geometry, dict) or not (
            coords := geometry.get("coordinates")
        ):
            return None

        while isinstance(coords, list) and coords and isinstance(coords[0], list):
            coords = coords[0]

        if isinstance(coords, list) and len(coords) >= 2:
            return float(coords[0]), float(coords[1])

        return None

    def extract_geometry_and_coords(
        self, geometry_data: str | dict[str, Any] | None
    ) -> GeometryData:
        """Parse geometry data and extract a geometry dict and first lng/lat pair."""
        if not geometry_data:
            return GeometryData(None, None, None)

        try:
            geometry = (
                json.loads(geometry_data)
                if isinstance(geometry_data, str)
                else geometry_data
            )

            coords = (
                self.extract_first_coordinate_pair(geometry)
                if isinstance(geometry, dict)
                else None
            )

            if coords:
                return GeometryData(geometry, coords[0], coords[1])

            return GeometryData(
                geometry if isinstance(geometry, dict) else None, None, None
            )
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            logger.error(f"Failed to parse geometry data: {exc}")
            return GeometryData(None, None, None)
