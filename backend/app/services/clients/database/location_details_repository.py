"""Repository for interacting with persisted LocationDetails records."""

from typing import List, Optional

from sqlalchemy import func
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
    PeerSolutions,
    SolutionsExamples,
)


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
                    FactHazards.public_status == "Public",
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
                SolutionsExamples.hazard_filter == "All",
            )
            return list((await session.exec(statement)).all())

    async def get_metadata(self, org_id: int) -> Optional[DimCentral]:
        """Return metadata for a given organization ID from DimCentral.

        Args:
            org_id: The CDP disclosing organization number.

        Returns:
            The DimCentral record with geometry as GeoJSON string, or None if not found.
        """
        async with AsyncSession(self.engine) as session:
            columns = [
                func.ST_AsGeoJSON(DimCentral.geometry).label("geometry")
                if c.name == "geometry"
                else getattr(DimCentral, c.name)
                for c in DimCentral.__table__.columns
            ]
            statement = select(*columns).where(
                DimCentral.cdp_disclosing_org_number == org_id,
                DimCentral.has_geometry,
                DimCentral.public_status == "Public",
            )
            result = (await session.exec(statement)).first()
            if result is None:
                return None
            return DimCentral(**result._mapping)

    async def has_organization(self, org_id: int) -> bool:
        """Return whether a public organization exists for the provided ID."""
        async with AsyncSession(self.engine) as session:
            statement = select(DimCentral.cdp_disclosing_org_number).where(
                DimCentral.cdp_disclosing_org_number == org_id,
                DimCentral.public_status == "Public",
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
                DimCentral.public_status == "Public",
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
                )
                .where(
                    DimCentral.has_geometry,
                    DimCentral.public_status == "Public",
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
                )
                for row in results
                if row.disclosing_organization
            ]

    async def get_all_location_geometries(self) -> List[LocationGeometry]:
        """Return a list of all unique location names, their geometries, and organization type.

        Returns:
            A list of LocationGeometry objects, where each object contains a location name, its GeoJSON geometry dictionary, and the organization type.
        """
        async with AsyncSession(self.engine) as session:
            statement = (
                select(
                    DimCentral.disclosing_organization.label("name"),
                    func.ST_AsGeoJSON(DimCentral.geometry).label("geometry"),
                    DimCentral.disclosing_org_type.label("org_type"),
                )
                .where(
                    DimCentral.has_geometry,
                    DimCentral.public_status == "Public",
                )
                .distinct(DimCentral.disclosing_organization)
            )
            results = (await session.exec(statement)).all()
            return [LocationGeometry(**row._mapping) for row in results]
