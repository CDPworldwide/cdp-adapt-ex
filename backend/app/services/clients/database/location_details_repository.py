"""Repository for interacting with persisted LocationDetails records."""

from typing import List, Optional

from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.location_details import (
    DimCentral,
    FactActions,
    FactAdaptationGoals,
    FactHazards,
    FactProjects,
    LocationGeometry,
    OrganizationSummary,
    PeerLocation,
    PeerSolutions,
    SolutionsExamples,
)
from app.schemas.location import LocationSeoSummary


# TODO (#442): Integrate disclosure year filter into data retrieval process
# TODO (#269): Use sql alchemy mixins to simplify the code.
class LocationDetailsRepository:
    def __init__(self, engine: AsyncEngine):
        self.engine = engine

    async def get_hazards(self, org_id: int) -> List[FactHazards]:
        async with AsyncSession(self.engine) as session:
            statement = (
                select(FactHazards)
                .where(
                    FactHazards.cdp_disclosing_org_number == org_id,
                    # Suppress disclosed Non-Public hazards while keeping Public
                    # and GEE-derived (NULL public_status) rows. (`!=` alone
                    # would silently drop NULL rows under SQL three-valued logic.)
                    or_(
                        FactHazards.public_status != "Non-Public",
                        FactHazards.public_status.is_(None),
                    ),
                )
                .order_by(FactHazards.hazard_rank)
            )
            return list((await session.exec(statement)).all())

    async def get_goals(self, org_id: int) -> List[FactAdaptationGoals]:
        async with AsyncSession(self.engine) as session:
            statement = select(FactAdaptationGoals).where(
                FactAdaptationGoals.cdp_disclosing_org_number == org_id,
                FactAdaptationGoals.public_status == "Public",
            )
            return list((await session.exec(statement)).all())

    async def get_projects(self, org_id: int) -> List[FactProjects]:
        async with AsyncSession(self.engine) as session:
            statement = select(FactProjects).where(
                FactProjects.cdp_disclosing_org_number == org_id,
                FactProjects.public_status == "Public",
            )
            return (await session.exec(statement)).all()

    async def get_actions(self, org_id: int) -> List[FactActions]:
        async with AsyncSession(self.engine) as session:
            statement = select(FactActions).where(
                FactActions.cdp_disclosing_org_number == org_id,
                FactActions.public_status == "Public",
            )
            return list((await session.exec(statement)).all())

    async def get_solutions(self, org_id: int) -> List[PeerSolutions]:
        async with AsyncSession(self.engine) as session:
            statement = select(PeerSolutions).where(
                PeerSolutions.target_org_id == org_id,
                PeerSolutions.hazard_filter == "All",
            )
            return list((await session.exec(statement)).all())

    async def get_solution_examples(self, org_id: int) -> List[SolutionsExamples]:
        async with AsyncSession(self.engine) as session:
            statement = select(SolutionsExamples).where(
                SolutionsExamples.target_org_id == org_id,
            )
            return list((await session.exec(statement)).all())

    async def get_metadata(self, org_id: int) -> Optional[DimCentral]:
        """Return metadata for a given organization ID from DimCentral.

        Args:
            org_id: The CDP disclosing organization number.

        Returns:
            The DimCentral record with geometry/centroid as GeoJSON strings, or None if not found.
        """
        async with AsyncSession(self.engine) as session:
            geo_columns = {"geometry", "centroid"}
            columns = [
                func.ST_AsGeoJSON(getattr(DimCentral, c.name)).label(c.name)
                if c.name in geo_columns
                else getattr(DimCentral, c.name)
                for c in DimCentral.__table__.columns
            ]
            statement = select(*columns).where(
                DimCentral.cdp_disclosing_org_number == org_id,
                DimCentral.has_geometry,
            )
            result = (await session.exec(statement)).first()
            if result is None:
                return None
            return DimCentral(**result._mapping)

    async def get_peer_locations(self, org_ids: set[int]) -> List[PeerLocation]:
        """Return geometry/country for each peer organization id.

        Only rows with geometry are returned; peers without geometry are
        simply absent from the result and the caller degrades gracefully
        (no map thumbnail for that peer).

        Args:
            org_ids: The set of peer organization ids to resolve.

        Returns:
            A list of PeerLocation rows with GeoJSON geometry/centroid strings.
        """
        if not org_ids:
            return []
        async with AsyncSession(self.engine) as session:
            # Peer geometry only feeds a ~53px thumbnail, and a single location
            # can have hundreds of peers. Full-resolution polygons would balloon
            # the response past Cloud Run's 32 MB limit, so simplify aggressively
            # (≈0.01° ≈ 1 km) — invisible at thumbnail size, ~99% smaller.
            simplified_geometry = func.ST_SimplifyPreserveTopology(
                DimCentral.geometry, 0.01
            )
            statement = select(
                DimCentral.cdp_disclosing_org_number.label("org_id"),
                DimCentral.discloser_country_or_area.label("country"),
                func.ST_AsGeoJSON(simplified_geometry).label("geometry"),
                func.ST_X(DimCentral.centroid).label("centroid_lng"),
                func.ST_Y(DimCentral.centroid).label("centroid_lat"),
            ).where(
                DimCentral.cdp_disclosing_org_number.in_(org_ids),
                DimCentral.has_geometry,
            )
            results = (await session.exec(statement)).all()
            return [PeerLocation(**row._mapping) for row in results]

    async def has_organization(self, org_id: int) -> bool:
        """Return whether an organization with geometry exists for the provided ID."""
        async with AsyncSession(self.engine) as session:
            statement = select(DimCentral.cdp_disclosing_org_number).where(
                DimCentral.cdp_disclosing_org_number == org_id,
                DimCentral.has_geometry,
            )
            return (await session.exec(statement)).first() is not None

    async def get_orgs_by_name(
        self, organization_name: str
    ) -> List[OrganizationSummary]:
        """Return all organization summaries matching a given organization name.

        Matching is an exact string match but performed case-insensitively
        (e.g. "New York" and "new york" will both match the same records).

        Args:
            organization_name: The name of the disclosing organization (case-insensitive).

        Returns:
            A list of `OrganizationSummary` objects that match `organization_name`.
        """
        async with AsyncSession(self.engine) as session:
            statement = select(
                DimCentral.cdp_disclosing_org_number,
                DimCentral.disclosing_organization,
                DimCentral.discloser_country_or_area,
                DimCentral.current_pop,
            ).where(
                func.lower(DimCentral.disclosing_organization)
                == organization_name.lower(),
                DimCentral.has_geometry,
                # No public_status filter — Public, Non-Public, and non-disclosers
                # all need to resolve so search bar clicks reach the detail page.
            )
            results = (await session.exec(statement)).all()
            return [
                OrganizationSummary(
                    id=row.cdp_disclosing_org_number,
                    name=row.disclosing_organization,
                    country=row.discloser_country_or_area,
                    population=row.current_pop,
                )
                for row in results
            ]

    async def get_all_location_summaries(self) -> List[OrganizationSummary]:
        """Return all organizations with their IDs and names.

        Includes Public disclosers, Non-Public disclosers, and non-disclosers
        (who have an empty `public_status` as of May 7, schema to be updated later). The search bar surfaces all three
        buckets.

        Returns:
            A list of `OrganizationSummary` objects used for search suggestions.
        """
        async with AsyncSession(self.engine) as session:
            statement = (
                select(
                    DimCentral.cdp_disclosing_org_number,
                    DimCentral.disclosing_organization,
                    DimCentral.discloser_country_or_area,
                    DimCentral.current_pop,
                    DimCentral.disclosure_status,
                )
                .where(
                    DimCentral.has_geometry,
                )
                .distinct()
            )
            results = (await session.exec(statement)).all()
            return [
                OrganizationSummary(
                    id=row.cdp_disclosing_org_number,
                    name=row.disclosing_organization,
                    country=row.discloser_country_or_area,
                    population=row.current_pop,
                    disclosure_status=row.disclosure_status,
                )
                for row in results
                if row.disclosing_organization
            ]

    async def get_location_seo_summaries(self) -> List[LocationSeoSummary]:
        """Return lightweight organization data for build-time SEO page generation."""
        async with AsyncSession(self.engine) as session:
            base_statement = (
                select(
                    DimCentral.cdp_disclosing_org_number,
                    DimCentral.disclosing_organization,
                    DimCentral.discloser_country_or_area,
                    DimCentral.disclosing_org_type,
                    DimCentral.current_pop,
                    DimCentral.disclosure_status,
                    DimCentral.public_status,
                    DimCentral.disclosing_year,
                )
                .where(
                    DimCentral.has_geometry,
                    DimCentral.disclosing_organization.is_not(None),
                )
                .distinct()
            )
            base_rows = (await session.exec(base_statement)).all()

            hazard_statement = (
                select(
                    FactHazards.cdp_disclosing_org_number,
                    FactHazards.hazard_rank,
                    FactHazards.hazard_english,
                )
                .where(
                    FactHazards.hazard_rank <= 3,
                    or_(
                        FactHazards.public_status != "Non-Public",
                        FactHazards.public_status.is_(None),
                    ),
                )
                .order_by(
                    FactHazards.cdp_disclosing_org_number,
                    FactHazards.hazard_rank,
                )
            )
            hazard_rows = (await session.exec(hazard_statement)).all()

            goals_by_org = await self._count_public_rows_by_org(
                session,
                FactAdaptationGoals.cdp_disclosing_org_number,
                FactAdaptationGoals.public_status,
            )
            actions_by_org = await self._count_public_rows_by_org(
                session,
                FactActions.cdp_disclosing_org_number,
                FactActions.public_status,
            )
            projects_by_org = await self._count_public_rows_by_org(
                session,
                FactProjects.cdp_disclosing_org_number,
                FactProjects.public_status,
            )
            solutions_by_org = await self._count_solution_rows_by_org(session)

        hazards_by_org: dict[int, list[str]] = {}
        for row in hazard_rows:
            if not row.hazard_english:
                continue
            hazards_by_org.setdefault(row.cdp_disclosing_org_number, []).append(
                row.hazard_english
            )

        return [
            LocationSeoSummary(
                id=row.cdp_disclosing_org_number,
                name=row.disclosing_organization,
                country=row.discloser_country_or_area,
                organization_type=row.disclosing_org_type,
                population=row.current_pop,
                disclosure_status=row.disclosure_status,
                public_status=row.public_status,
                disclosure_year=row.disclosing_year,
                top_hazards=hazards_by_org.get(row.cdp_disclosing_org_number, []),
                action_count=actions_by_org.get(row.cdp_disclosing_org_number, 0),
                goal_count=goals_by_org.get(row.cdp_disclosing_org_number, 0),
                project_count=projects_by_org.get(row.cdp_disclosing_org_number, 0),
                solution_count=solutions_by_org.get(row.cdp_disclosing_org_number, 0),
            )
            for row in base_rows
            if row.disclosing_organization
        ]

    async def _count_public_rows_by_org(
        self,
        session: AsyncSession,
        org_column,
        public_status_column,
    ) -> dict[int, int]:
        statement = (
            select(org_column, func.count())
            .where(public_status_column == "Public")
            .group_by(org_column)
        )
        rows = (await session.exec(statement)).all()
        return {row[0]: row[1] for row in rows}

    async def _count_solution_rows_by_org(
        self, session: AsyncSession
    ) -> dict[int, int]:
        statement = (
            select(PeerSolutions.target_org_id, func.count())
            .where(PeerSolutions.hazard_filter == "All")
            .group_by(PeerSolutions.target_org_id)
        )
        rows = (await session.exec(statement)).all()
        return {row[0]: row[1] for row in rows}

    async def get_all_location_geometries(self) -> List[LocationGeometry]:
        """Return a list of all unique location names, their geometries, and organization type.

        Returns:
            A list of LocationGeometry objects, each containing a location name, its
            GeoJSON polygon, the organization type, and pre-computed centroid lng/lat
            (NULL until the upstream data is backfilled — the service degrades to
            polygon-vertex extraction in that case).
        """
        async with AsyncSession(self.engine) as session:
            statement = (
                select(
                    DimCentral.disclosing_organization.label("name"),
                    func.ST_AsGeoJSON(DimCentral.geometry).label("geometry"),
                    DimCentral.disclosing_org_type.label("org_type"),
                    func.ST_X(DimCentral.centroid).label("centroid_lng"),
                    func.ST_Y(DimCentral.centroid).label("centroid_lat"),
                )
                .where(
                    DimCentral.has_geometry,
                    # Disclosers (Public + Non-Public) only — non-disclosers
                    # (empty public_status as of May 7) appear in search but not on the map.
                    DimCentral.public_status.in_(["Public", "Non-Public"]),
                )
                .distinct(DimCentral.disclosing_organization)
            )
            results = (await session.exec(statement)).all()
            return [LocationGeometry(**row._mapping) for row in results]
