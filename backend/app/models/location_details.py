"""
Database models for location-related data.
"""

from decimal import Decimal
from typing import Any

import sqlalchemy.types as types
from geoalchemy2 import Geometry
from pydantic import ConfigDict
from sqlmodel import TEXT, Column, Field, SQLModel


class SafeGeometry(types.TypeDecorator):
    """
    A custom type that uses GeoAlchemy2's Geometry in Postgres,
    but safely falls back to standard TEXT in SQLite for testing,
    avoiding missing SpatiaLite function errors.
    """

    impl = types.TypeEngine
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect is None:
            return TEXT()
        if dialect.name == "sqlite":
            return dialect.type_descriptor(TEXT())
        return dialect.type_descriptor(Geometry(geometry_type="GEOMETRY", srid=4326))


class OrganizationSummary(SQLModel):
    """Simplified organization details for location ID lookup."""

    id: int
    name: str | None = None
    country: str | None = None
    population: int | None = None


class LocationGeometry(SQLModel):
    """Simplified location geometry details for pins."""

    name: str
    geometry: str
    org_type: str | None = None
    # Pre-computed centroid coordinates (POINT geometry on DimCentral). When
    # present they are used directly; when NULL the service falls back to
    # extracting the first coordinate pair from `geometry`.
    centroid_lng: float | None = None
    centroid_lat: float | None = None


class DimCentral(SQLModel, table=True):
    """Full model for CSTAR_2025_Dim_Central with all listed columns."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    __tablename__ = "CSTAR_2025_Dim_Central"

    cdp_disclosing_org_number: int = Field(primary_key=True)
    disclosing_organization: str | None = None
    disclosing_org_type: str | None = None
    discloser_country_or_area: str | None = None
    public_status: str | None = None
    current_pop: float | None = None
    ranked_hazards: str | None = None
    ranked_sectors: str | None = None
    requesting_auth: str | None = None
    has_geometry: bool | None = None
    climate_assess_yn: str | None = None
    disclosing_year: int = Field(primary_key=True)
    geometry: Any = Field(
        sa_column=Column(SafeGeometry()),
        default=None,
    )
    centroid: Any = Field(
        sa_column=Column(SafeGeometry()),
        default=None,
    )


class FactAdaptationGoals(SQLModel, table=True):
    """Fact table for adaptation goals."""

    __tablename__ = "CSTAR_2025_Fact_Goal"

    cdp_disclosing_org_number: int = Field(primary_key=True)
    disclosing_organization: str | None = None
    public_status: str | None = None
    goal_english: str
    hazard_addressed_english: str | None = None
    base_year: int | None = None
    target_year: int | None = None
    metric_used_english: str | None = None
    comment_english: str | None = None
    disclosing_year: int = Field(primary_key=True)
    goal_index: int = Field(primary_key=True)


class FactActions(SQLModel, table=True):
    """Partial model for 2025 fact actions."""

    __tablename__ = "CSTAR_2025_Fact_Action"

    cdp_disclosing_org_number: int = Field(primary_key=True)
    disclosing_organization: str | None = None
    public_status: str | None = None
    action_english: str
    hazard_addressed_english: str | None = None
    action_description_english: str | None = None
    sectors_applied_english: str | None = None
    resilience_enhanced_english: str | None = None
    cobenefit_realized_english: str | None = None
    timeframe_english: str | None = None
    funding_source_english: str | None = None
    action_status_english: str | None = None
    total_cost_usd: Decimal | None = None
    action_index: int = Field(primary_key=True)
    disclosing_year: int = Field(primary_key=True)


class FactHazards(SQLModel, table=True):
    """Table for 2025 fact hazards."""

    __tablename__ = "CSTAR_2025_Fact_Hazard"

    cdp_disclosing_org_number: int = Field(primary_key=True)
    hazard_rank: int = Field(primary_key=True)
    hazard_english: str
    population_exposed_english: str | None = None
    sectors_exposed_english: str | None = None
    impacts: str | None = None
    disclosure_cycle: str | None = None
    hazard_probability: str | None = None
    hazard_magnitude: str | None = None
    intensity_change: str | None = None
    frequency_change: str | None = None
    time_frame: str | None = None
    summary_text: str | None = None
    population_range: str | None = None
    public_status: str | None = None
    disclosing_year: int = Field(primary_key=True)


class FactProjects(SQLModel, table=True):
    """Fact table for projects seeking funding."""

    __tablename__ = "CSTAR_2025_Fact_Funding_Gap"

    project_index: int = Field(primary_key=True)
    cdp_disclosing_org_number: int = Field(primary_key=True)
    project_title_english: str | None = None
    disclosing_organization: str | None = None
    public_status: str | None = None
    project_area_english: str | None = None
    development_stage: str | None = None
    finance_status_english: str | None = None
    finance_model_english: str | None = None
    project_descirption_english: str | None = None  # note: typo in actual DB column
    total_cost_usd: float | None = None
    total_needed_usd: float | None = None
    disclosing_year: int = Field(primary_key=True)


class PeerSolutions(SQLModel, table=True):
    """Fact table for peer solutions."""

    __tablename__ = "CSTAR_2025_Peer_Solutions"

    disclosing_year: int = Field(primary_key=True)
    target_org_id: int = Field(primary_key=True)
    hazard_filter: str | None = Field(default=None, primary_key=True)
    solution_category: str | None = None
    solution: str | None = None
    action_rank: int | None = None
    action_english: str | None = None
    action_index: int = Field(primary_key=True)
    hazard_addressed: str | None = None
    peer_org_cnt: int | None = None
    action_count: int | None = None
    pct_peers: Decimal | None = None
    has_local_action: bool


class SolutionsExamples(SQLModel, table=True):
    """Fact table for solution examples."""

    __tablename__ = "CSTAR_2025_Solution_Examples"

    disclosing_year: int = Field(primary_key=True)
    target_org_id: int = Field(primary_key=True)
    hazard_filter: str | None = Field(default=None, primary_key=True)
    action_english: str | None = None
    peer_org_id: int = Field(primary_key=True)
    peer_org_name: str | None = None
    action_index: int = Field(primary_key=True)
    hazard_addressed_english: str | None = None
    action_description_english: str | None = None
    sectors_applied_english: str | None = None
    resilience_enhanced_english: str | None = None
    cobenefit_realized_english: str | None = None
    timeframe_english: str | None = None
    funding_source_english: str | None = None
    action_status_english: str | None = None
    total_cost_usd: Decimal | None = None
    completeness_score: int | None = None
