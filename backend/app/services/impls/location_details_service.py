"""Service layer for location details operations.

This module combines the hazards, adaptation goals, actions, and projects for
specific locations. It handles the mapping between raw database models and the
structured LocationProfile schema used by the API.
"""

import asyncio
import json
import re
import time
from collections import defaultdict

from app.models.location_details import (
    FactActions,
    FactAdaptationGoals,
    FactHazards,
    FactProjects,
    OrganizationSummary,
    PeerSolutions,
    SolutionsExamples,
)
from app.schemas.location import (
    AdaptationAction,
    AdaptationGoal,
    HazardProfile,
    LocationPin,
    LocationProfile,
    OrgTypeEnum,
    PeerAction,
    ProjectSeekingFunding,
    SolutionCard,
)
from app.services.clients.database.location_details_repository import (
    LocationDetailsRepository,
)
from app.services.impls.hazard_mapper import HazardMapper
from app.services.impls.location_profile_builder import LocationProfileBuilder
from app.services.impls.sector_mapper import SectorMapper
from app.services.impls.solution_category_mapper import SolutionCategoryMapper
from app.services.impls.status_mapper import StatusMapper
from app.services.impls.text_cleanup import clean_disclosed_text
from app.services.interfaces.city_resolution_service import CityResolutionService
from app.shared.exceptions import CityNotFoundException
from app.shared.logging import logger


class LocationDetailsService:
    _summaries_cache = None
    _pins_cache = None

    def __init__(
        self,
        repository: LocationDetailsRepository,
        city_resolution_service: CityResolutionService,
    ):
        self.repository = repository
        self.city_resolution_service = city_resolution_service

        self.hazard_mapper = HazardMapper()
        self.sector_mapper = SectorMapper()
        self.status_mapper = StatusMapper()
        self.solution_category_mapper = SolutionCategoryMapper()
        self.profile_builder = LocationProfileBuilder(self.sector_mapper)

    async def _build_location_profile(
        self, org_id: int, fallback_name: str
    ) -> LocationProfile:
        start_time = time.time()
        (
            metadata,
            hazards,
            goals,
            actions,
            projects,
            solutions,
            peers_actions,
        ) = await asyncio.gather(
            self.repository.get_metadata(org_id),
            self.repository.get_hazards(org_id),
            self.repository.get_goals(org_id),
            self.repository.get_actions(org_id),
            self.repository.get_projects(org_id),
            self.repository.get_solutions(org_id),
            self.repository.get_solution_examples(org_id),
        )

        # Suppress this org's own disclosed adaptation content for Non-Public
        # disclosers — their goals/actions/projects are private. Solutions and
        # peer-actions are NOT suppressed: they're recommendations sourced from
        # other (Public) peer orgs, so showing them doesn't leak anything about
        # the Non-Public target. Public orgs and non-disclosers (empty
        # public_status) pass through; non-disclosers naturally have no
        # disclosed content today but may receive GEE-derived data later, which
        # should not be silently suppressed by a broader `!= "Public"`
        # condition.
        if metadata is not None and metadata.public_status == "Non-Public":
            goals = []
            actions = []
            projects = []

        mapped_hazards = self._map_to_hazard_profiles(hazards, org_id)
        mapped_goals = self._map_to_adaptation_goals(goals, org_id)
        mapped_actions = self._map_to_adaptation_actions(actions, org_id)
        mapped_projects = self._map_to_projects(projects)
        mapped_solution_cards = self._map_solution_cards(solutions, peers_actions)

        profile = self.profile_builder.build_profile(
            org_id=org_id,
            fallback_name=fallback_name,
            metadata=metadata,
            mapped_hazards=mapped_hazards,
            mapped_goals=mapped_goals,
            mapped_actions=mapped_actions,
            mapped_projects=mapped_projects,
            mapped_solution_cards=mapped_solution_cards,
        )

        logger.info(
            "location_profile_built",
            org_id=org_id,
            duration_seconds=round(time.time() - start_time, 3),
        )

        return profile

    def _map_to_hazard_profiles(
        self, hazards: list[FactHazards], org_id: int
    ) -> list[HazardProfile]:
        """Transform ORM hazard models into HazardProfile schemas."""
        return [
            HazardProfile(
                hazard=mapped_hazard,
                hazard_rank=h.hazard_rank,
                source=None,
                description=h.summary_text,
                vulnerable_groups=[
                    group.strip()
                    for group in re.split(r"[,;|]", h.population_exposed_english)
                    if group.strip()
                ]
                if h.population_exposed_english
                else [],
                proportion_exposed_range=h.population_range,
                impact=h.impacts,
                most_exposed_sectors=self.sector_mapper.split_and_map_sectors(
                    h.sectors_exposed_english, org_id=org_id
                ),
            )
            for h in hazards
            if (
                mapped_hazard := self.hazard_mapper.map_string_to_hazard(
                    h.hazard_english, org_id=org_id
                )
            )
            is not None
        ]

    def _map_to_adaptation_goals(
        self, goals: list[FactAdaptationGoals], org_id: int
    ) -> list[AdaptationGoal]:
        """Transform ORM goal models into AdaptationGoal schemas."""
        return [
            AdaptationGoal(
                title=g.goal_english,
                hazards_addressed=self.hazard_mapper.split_and_map_hazards(
                    g.hazard_addressed_english, org_id=org_id
                )
                if g.hazard_addressed_english
                else [],
                metric_indicator=g.metric_used_english,
                comment=g.comment_english,
                base_year=g.base_year,
                target_year=g.target_year,
            )
            for g in goals
            if g.goal_english and g.goal_english.strip()
        ]

    def _build_adaptation_action(
        self,
        title: str,
        hazard_addressed_english: str | None,
        status_text: str | None,
        cobenefit_realized_english: str | None,
        total_cost_usd: float | None,
        timeframe_english: str | None,
        description_english: str | None,
        resilience_enhanced_english: str | None,
        sectors_applied_english: str | None,
        org_id: int,
    ) -> AdaptationAction:
        return AdaptationAction(
            title=clean_disclosed_title(title),
            hazards_addressed=self.hazard_mapper.split_and_map_hazards(
                hazard_addressed_english, org_id=org_id
            )
            if hazard_addressed_english
            else [],
            status=self.status_mapper.map_string_to_status(status_text)
            if status_text
            else None,
            co_benefits=[
                benefit.strip()
                for benefit in re.split(r"\||,(?=[\w\s]+:)", cobenefit_realized_english)
                if benefit.strip()
            ]
            if cobenefit_realized_english
            else [],
            total_cost_usd=float(total_cost_usd)
            if total_cost_usd is not None
            else None,
            timeframe=timeframe_english,
            description=clean_disclosed_text(description_english),
            resilience_enhanced=[
                r.strip() for r in resilience_enhanced_english.split("|") if r.strip()
            ]
            if resilience_enhanced_english
            else [],
            impacted_sectors=self.sector_mapper.split_and_map_sectors(
                sectors_applied_english, org_id=org_id
            ),
        )

    def _map_to_adaptation_actions(
        self, actions: list[FactActions], org_id: int
    ) -> list[AdaptationAction]:
        """Transform ORM action models into AdaptationAction schemas."""
        return [
            self._build_adaptation_action(
                title=a.action_english,
                hazard_addressed_english=a.hazard_addressed_english,
                status_text=a.action_status_english,
                cobenefit_realized_english=a.cobenefit_realized_english,
                total_cost_usd=a.total_cost_usd,
                timeframe_english=a.timeframe_english,
                description_english=a.action_description_english,
                resilience_enhanced_english=a.resilience_enhanced_english,
                sectors_applied_english=a.sectors_applied_english,
                org_id=org_id,
            )
            for a in actions
            if a.action_english and a.action_english.strip()
        ]

    def _map_to_projects(
        self, projects: list[FactProjects]
    ) -> list[ProjectSeekingFunding]:
        """Transform ORM project models into ProjectSeekingFunding schemas."""
        result = []
        for project in projects:
            if not project.project_title_english:
                continue

            status = self.status_mapper.map_string_to_project_status(
                project.development_stage
            )

            funded_percent = None
            if (
                project.total_cost_usd is not None
                and project.total_needed_usd is not None
                and project.total_cost_usd > 0
            ):
                funded_percent = (
                    (project.total_cost_usd - project.total_needed_usd)
                    / project.total_cost_usd
                ) * 100

                if funded_percent < 0 or funded_percent > 100:
                    logger.error(
                        "Data inconsistency: Project '%s' (ID: %s) has invalid funded_percent (%s%%). total_cost_usd=%s, total_needed=%s",
                        project.project_title_english,
                        project.project_index,
                        funded_percent,
                        project.total_cost_usd,
                        project.total_needed_usd,
                    )

                funded_percent = max(0.0, min(100.0, funded_percent))

            # Split pipe-separated finance models into a list
            finance_models = []
            if project.finance_model_english:
                finance_models = [
                    m.strip()
                    for m in project.finance_model_english.split("|")
                    if m.strip()
                ]

            result.append(
                ProjectSeekingFunding(
                    title=clean_disclosed_title(project.project_title_english),
                    status=status,
                    description=clean_disclosed_text(project.project_descirption_english),
                    project_area=project.project_area_english,
                    finance_status=project.finance_status_english,
                    finance_model=finance_models,
                    funded_percent=funded_percent,
                    total_amount=project.total_cost_usd,
                    total_needed=project.total_needed_usd,
                )
            )

        return result

    def _map_peers_actions(
        self, solution_examples: list[SolutionsExamples]
    ) -> list[PeerAction]:
        """Transform solution examples into PeerAction objects."""
        peer_actions: list[PeerAction] = []

        for example in solution_examples:
            action: AdaptationAction | None = None
            if example.action_english:
                action = self._build_adaptation_action(
                    title=example.action_english,
                    hazard_addressed_english=example.hazard_addressed_english,
                    status_text=example.action_status_english,
                    cobenefit_realized_english=example.cobenefit_realized_english,
                    total_cost_usd=example.total_cost_usd,
                    timeframe_english=example.timeframe_english,
                    description_english=example.action_description_english,
                    resilience_enhanced_english=example.resilience_enhanced_english,
                    sectors_applied_english=example.sectors_applied_english,
                    org_id=example.peer_org_id,
                )

            peer_actions.append(
                PeerAction(
                    peer_name=example.peer_org_name,
                    action=action,
                )
            )

        return peer_actions

    def _map_solution_cards(
        self,
        solutions: list[PeerSolutions],
        solution_examples: list[SolutionsExamples],
    ) -> list[SolutionCard]:
        """Transform solution rows into a list of SolutionCard objects."""

        examples_by_solution = defaultdict(list)
        for example in solution_examples:
            key = (
                example.target_org_id,
                example.action_index,
                example.disclosing_year,
                example.hazard_filter,
            )
            examples_by_solution[key].append(example)

        solution_cards: list[SolutionCard] = []
        for s in solutions:
            key = (s.target_org_id, s.action_index, s.disclosing_year, s.hazard_filter)
            filtered_examples = examples_by_solution.get(key, [])

            peer_actions = self._map_peers_actions(filtered_examples)

            solution_cards.append(
                SolutionCard(
                    solution=s.solution,
                    solution_category=self.solution_category_mapper.map_string_to_solution_category(
                        s.solution_category, org_id=s.target_org_id
                    ),
                    peer_actions=peer_actions,
                    pct_peer_taking_action=float(s.pct_peers)
                    if s.pct_peers is not None
                    else None,
                    solution_hazards_addressed=self.hazard_mapper.split_and_map_hazards(
                        s.hazard_addressed, org_id=s.target_org_id
                    )
                    if s.hazard_addressed
                    else [],
                    hazard_filter=self._map_hazard_filter(
                        s.hazard_filter, s.target_org_id
                    ),
                    has_local_action=s.has_local_action,
                )
            )
        return solution_cards

    def _map_hazard_filter(self, hazard_filter: str | None, org_id: int) -> str:
        """Map the raw database hazard_filter string to an enum string or 'All'."""
        if not hazard_filter or hazard_filter == "All":
            return "All"

        mapped_hazard = self.hazard_mapper.map_string_to_hazard(hazard_filter, org_id)
        if mapped_hazard:
            return mapped_hazard.hazard_type.value

        return "All"

    async def get_eligible_location_details_by_name(
        self, city_name: str
    ) -> LocationProfile:
        """Returns the first matching location details for a given city name."""
        org_id = await self.city_resolution_service.resolve_org_id(city_name)

        if org_id is None:
            raise CityNotFoundException(city_name)

        return await self._build_location_profile(
            org_id=org_id, fallback_name=city_name
        )

    async def get_location_details_by_org_id(
        self, organization_id: int
    ) -> LocationProfile:
        if not await self.repository.has_organization(organization_id):
            raise CityNotFoundException(str(organization_id))

        return await self._build_location_profile(
            org_id=organization_id,
            fallback_name=str(organization_id),
        )

    async def get_all_location_summaries(self) -> list[OrganizationSummary]:
        """Returns organization summaries used by location suggestions."""
        if LocationDetailsService._summaries_cache is None:
            LocationDetailsService._summaries_cache = (
                await self.repository.get_all_location_summaries()
            )
        return LocationDetailsService._summaries_cache

    async def get_all_location_pins(self) -> list[LocationPin]:
        """Returns a list of all unique location pins with coordinates."""
        if LocationDetailsService._pins_cache is None:
            LocationDetailsService._pins_cache = await self._fetch_all_location_pins()
        return LocationDetailsService._pins_cache

    async def _fetch_all_location_pins(self) -> list[LocationPin]:
        """Fetches and transforms all unique location pins from the repository.

        Prefers the pre-computed `centroid` POINT column when present. Falls back
        to the legacy "first vertex of polygon" extraction when centroid is NULL,
        which keeps pins working for rows the upstream backfill hasn't reached.
        """
        geometries = await self.repository.get_all_location_geometries()
        pins = []
        for location_geom in geometries:
            org_type = location_geom.org_type
            if org_type == "States & Regions":
                org_type = OrgTypeEnum.STATE_AND_REGION
            elif org_type == "City":
                org_type = OrgTypeEnum.CITY

            if (
                location_geom.centroid_lng is not None
                and location_geom.centroid_lat is not None
            ):
                lng, lat = location_geom.centroid_lng, location_geom.centroid_lat
            else:
                geometry = json.loads(location_geom.geometry)
                coords = self.profile_builder.extract_first_coordinate_pair(geometry)
                if not coords:
                    logger.error(
                        f"Geometry data missing: Location '{location_geom.name}' is missing valid geometry or coordinate data."
                    )
                    continue
                lng, lat = coords

            pins.append(
                LocationPin(
                    name=location_geom.name,
                    lng=lng,
                    lat=lat,
                    org_type=org_type,
                )
            )
        return pins
