"""Repository for dataset-wide disclosure trend aggregations."""

from collections import defaultdict

from sqlalchemy import func, union
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.location_details import (
    DimCentral,
    FactActions,
    FactAdaptationGoals,
    FactHazards,
    FactProjects,
)
from app.schemas.disclosure_trends import DisclosureTrendsSummary, TopHazard
from app.schemas.location import HazardEnum
from app.services.impls.hazard_mapper import HAZARD_STRING_TO_ENUM

# Mirrors WATER_HAZARD_TYPES in
# frontend/src/app/features/location-card/disclosure-trends/disclosure-trends.stats.ts.
# Keep both lists in sync if the definition of "water security risk" changes.
_WATER_HAZARD_ENUMS: set[HazardEnum] = {
    HazardEnum.WATER_STRESS,
    HazardEnum.DROUGHT,
    HazardEnum.INCREASED_WATER_DEMAND,
}
WATER_HAZARD_DB_STRINGS: list[str] = [
    s for s, e in HAZARD_STRING_TO_ENUM.items() if e in _WATER_HAZARD_ENUMS
]
KNOWN_HAZARD_DB_STRINGS: list[str] = list(HAZARD_STRING_TO_ENUM.keys())


def _bracket(pct: int) -> str | None:
    """Bucket a 0-100 integer into a "lower-upper%" 10-point bracket label.

    Returns None for 0% so the UI can render "—" instead of a misleading "1-10%".
    """
    if pct <= 0:
        return None
    lower = ((pct - 1) // 10) * 10 + 1
    upper = lower + 9
    return f"{lower}-{upper}%"


class DisclosureTrendsRepository:
    def __init__(self, engine: AsyncEngine):
        self.engine = engine

    async def get_summary(self, year: int) -> DisclosureTrendsSummary:
        async with AsyncSession(self.engine) as session:
            total_orgs = await self._count_public_jurisdictions(session, year)
            adaptation_plan_count = await self._count_orgs_with_actions_or_goals(
                session, year
            )
            water_security_risks_count = await self._count_orgs_with_water_hazards(
                session, year
            )
            top_hazards = await self._top_hazards(session, year, total_orgs)
            projects_seeking_finance_count = await self._count_funding_projects(
                session, year
            )
            exposed_orgs = await self._count_orgs_with_any_hazard(session, year)

        jurisdictions_exposed_pct = (
            round(exposed_orgs / total_orgs * 100) if total_orgs else None
        )

        return DisclosureTrendsSummary(
            adaptation_plan_count=adaptation_plan_count,
            water_security_risks_count=water_security_risks_count,
            top_hazards=top_hazards,
            projects_seeking_finance_count=projects_seeking_finance_count,
            jurisdictions_exposed_pct=jurisdictions_exposed_pct,
        )

    async def _count_public_jurisdictions(
        self, session: AsyncSession, year: int
    ) -> int:
        # No has_geometry filter: trends count all public disclosing orgs for
        # the year, including those without map geometry.
        stmt = select(
            func.count(func.distinct(DimCentral.cdp_disclosing_org_number))
        ).where(
            DimCentral.public_status == "Public",
            DimCentral.disclosing_year == year,
        )
        return (await session.exec(stmt)).one() or 0

    async def _count_orgs_with_actions_or_goals(
        self, session: AsyncSession, year: int
    ) -> int:
        actions = select(FactActions.cdp_disclosing_org_number).where(
            FactActions.public_status == "Public",
            FactActions.disclosing_year == year,
        )
        goals = select(FactAdaptationGoals.cdp_disclosing_org_number).where(
            FactAdaptationGoals.public_status == "Public",
            FactAdaptationGoals.disclosing_year == year,
        )
        unioned = union(actions, goals).subquery()
        stmt = select(func.count()).select_from(unioned)
        return (await session.exec(stmt)).one() or 0

    async def _count_orgs_with_water_hazards(
        self, session: AsyncSession, year: int
    ) -> int:
        stmt = select(
            func.count(func.distinct(FactHazards.cdp_disclosing_org_number))
        ).where(
            FactHazards.public_status == "Public",
            FactHazards.disclosing_year == year,
            FactHazards.hazard_english.in_(WATER_HAZARD_DB_STRINGS),  # type: ignore[attr-defined]
        )
        return (await session.exec(stmt)).one() or 0

    async def _top_hazards(
        self, session: AsyncSession, year: int, total_orgs: int
    ) -> list[TopHazard]:
        # Group by raw DB string, then aggregate into enums in Python.
        # Keeps the SQL portable and lets multiple DB strings collapse into one
        # enum if the mapping ever becomes many-to-one.
        org_count = func.count(func.distinct(FactHazards.cdp_disclosing_org_number))
        stmt = (
            select(FactHazards.hazard_english, org_count.label("org_count"))
            .where(
                FactHazards.public_status == "Public",
                FactHazards.disclosing_year == year,
                FactHazards.hazard_english.in_(KNOWN_HAZARD_DB_STRINGS),  # type: ignore[attr-defined]
            )
            .group_by(FactHazards.hazard_english)
        )
        rows = (await session.exec(stmt)).all()

        per_enum: dict[HazardEnum, int] = defaultdict(int)
        for db_string, count in rows:
            enum_value = HAZARD_STRING_TO_ENUM[db_string]
            per_enum[enum_value] += count

        ranked = sorted(per_enum.items(), key=lambda kv: kv[1], reverse=True)[:3]
        return [
            TopHazard(
                rank=rank,
                type=hazard,
                range=_bracket(round(count / total_orgs * 100) if total_orgs else 0),
            )
            for rank, (hazard, count) in enumerate(ranked, start=1)
        ]

    async def _count_funding_projects(self, session: AsyncSession, year: int) -> int:
        stmt = select(func.count()).where(
            FactProjects.public_status == "Public",
            FactProjects.disclosing_year == year,
        )
        return (await session.exec(stmt)).one() or 0

    async def _count_orgs_with_any_hazard(
        self, session: AsyncSession, year: int
    ) -> int:
        stmt = select(
            func.count(func.distinct(FactHazards.cdp_disclosing_org_number))
        ).where(
            FactHazards.public_status == "Public",
            FactHazards.disclosing_year == year,
        )
        return (await session.exec(stmt)).one() or 0
