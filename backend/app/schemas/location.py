"""
Location V2 Schema.

This module will eventually replace location.py as the response
schema passed to the frontend for constructing location UI components.
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.models.location_details import OrganizationSummary


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    components = string.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


class APIBaseModel(BaseModel):
    """Base model for all API responses with camelCase serialization."""

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
    )


# ==========================================
# Shared Enums
# ==========================================


class OrgTypeEnum(str, Enum):
    """Types of disclosing organizations."""

    CITY = "City"
    STATE_AND_REGION = "StateAndRegion"


class HazardEnum(str, Enum):
    """
    Types of hazards.

    Values exactly match DB strings.
    """

    # Temperature & Heat
    HEAT_STRESS = "HEAT_STRESS"
    EXTREME_HEAT = "EXTREME_HEAT"
    EXTREME_COLD = "EXTREME_COLD"
    SNOW_AND_ICE = "SNOW_AND_ICE"
    FIRE_WEATHER = "FIRE_WEATHER"

    # Water & Drought
    DROUGHT = "DROUGHT"
    WATER_STRESS = "WATER_STRESS"
    INCREASED_WATER_DEMAND = "INCREASED_WATER_DEMAND"

    # Flooding & coastal events
    URBAN_FLOODING = "URBAN_FLOODING"
    RIVER_FLOODING = "RIVER_FLOODING"
    COASTAL_FLOODING = "COASTAL_FLOODING"
    OTHER_COASTAL_EVENTS = "OTHER_COASTAL_EVENTS"
    OCEANIC_EVENTS = "OCEANIC_EVENTS"

    # Storms & Wind
    TROPICAL_CYCLONE = "TROPICAL_CYCLONE"
    EXTREME_WIND = "EXTREME_WIND"
    STORM = "STORM"
    HEAVY_PRECIPITATION = "HEAVY_PRECIPITATION"

    # Landscape & Ecosystem
    MASS_MOVEMENT = "MASS_MOVEMENT"
    LOSS_OF_GREEN_SPACE = "LOSS_OF_GREEN_SPACE"
    SOIL_DEGRADATION_EROSION = "SOIL_DEGRADATION_EROSION"
    LANDSCAPE_SHIFT_DEGRADATION = "LANDSCAPE_SHIFT_DEGRADATION"

    # Health & Biodiversity
    INFECTIOUS_DISEASE = "INFECTIOUS_DISEASE"
    BIODIVERSITY_LOSS = "BIODIVERSITY_LOSS"

    # Other
    OTHERS = "OTHERS"


class Hazard(APIBaseModel):
    """Represents a hazard with optional custom details for OTHERS type."""

    hazard_type: HazardEnum
    other_hazard_details: str | None = Field(
        None, description="Free-text details for a hazard of type OTHERS."
    )


class SectorEnum(str, Enum):
    """Economic sectors affected by climate hazards (exactly matches DB strings)."""

    # Primary Industries
    AGRICULTURE = "AGRICULTURE"
    FORESTRY = "FORESTRY"
    FISHING = "FISHING"
    MINING_QUARRYING = "MINING_QUARRYING"

    # Industrial & Utilities
    MANUFACTURING = "MANUFACTURING"
    ELECTRICITY_GAS_STEAM_AIR = "ELECTRICITY_GAS_STEAM_AIR"
    WATER_SUPPLY = "WATER_SUPPLY"
    SEWERAGE_WASTE_REMEDIATION = "SEWERAGE_WASTE_REMEDIATION"
    WASTE_MANAGEMENT = "WASTE_MANAGEMENT"
    CONSTRUCTION = "CONSTRUCTION"

    # Services & Commercial
    WHOLESALE_RETAIL_TRADE = "WHOLESALE_RETAIL_TRADE"
    TRANSPORTATION_STORAGE = "TRANSPORTATION_STORAGE"
    ACCOMMODATION_FOOD_SERVICE = "ACCOMMODATION_FOOD_SERVICE"
    INFORMATION_COMMUNICATION = "INFORMATION_COMMUNICATION"
    FINANCIAL_INSURANCE = "FINANCIAL_INSURANCE"
    REAL_ESTATE = "REAL_ESTATE"
    PROFESSIONAL_SCIENTIFIC_TECHNICAL = "PROFESSIONAL_SCIENTIFIC_TECHNICAL"
    ADMIN_SUPPORT_SERVICES = "ADMIN_SUPPORT_SERVICES"

    # Public & Social
    PUBLIC_ADMIN_DEFENCE = "PUBLIC_ADMIN_DEFENCE"
    EDUCATION = "EDUCATION"
    HUMAN_HEALTH_SOCIAL_WORK = "HUMAN_HEALTH_SOCIAL_WORK"
    ARTS_ENTERTAINMENT_RECREATION = "ARTS_ENTERTAINMENT_RECREATION"
    CONSERVATION = "CONSERVATION"

    # Other
    OTHERS = "OTHERS"


class Sector(APIBaseModel):
    """Represents a sector with optional custom details for OTHERS type."""

    sector_type: SectorEnum
    other_sector_details: str | None = Field(
        None, description="Free-text details for a sector of type OTHERS."
    )


class ActionStatusEnum(str, Enum):
    """Current status of an adaptation action."""

    SCOPING = "SCOPING"
    PRE_FEASIBILITY_STUDY = "PRE_FEASIBILITY_STUDY"
    FEASIBILITY_FINALIZED_NO_FINANCE = "FEASIBILITY_FINALIZED_NO_FINANCE"
    FEASIBILITY_FINALIZED_PARTIAL_FINANCE = "FEASIBILITY_FINALIZED_PARTIAL_FINANCE"
    FEASIBILITY_FINALIZED_FULL_FINANCE = "FEASIBILITY_FINALIZED_FULL_FINANCE"
    IMPLEMENTATION_COMPLETE_REPORTING_YEAR = "IMPLEMENTATION_COMPLETE_REPORTING_YEAR"
    IMPLEMENTATION_UNDERWAY_COMPLETION_LT_ONE_YEAR = (
        "IMPLEMENTATION_UNDERWAY_COMPLETION_LT_ONE_YEAR"
    )
    IMPLEMENTATION_UNDERWAY_COMPLETION_GT_ONE_YEAR = (
        "IMPLEMENTATION_UNDERWAY_COMPLETION_GT_ONE_YEAR"
    )
    ACTION_IN_OPERATION_JURISDICTION_WIDE = "ACTION_IN_OPERATION_JURISDICTION_WIDE"
    ACTION_IN_OPERATION_MOST_OF_JURISDICTION = (
        "ACTION_IN_OPERATION_MOST_OF_JURISDICTION"
    )
    ACTION_IN_OPERATION_TARGETED = "ACTION_IN_OPERATION_TARGETED"
    OTHERS = "OTHERS"


class ActionStatus(APIBaseModel):
    """Represents the status of an adaptation action (Q9.1)."""

    status_type: ActionStatusEnum
    other_status_details: str | None = Field(
        None, description="Free-text details for a status of type OTHERS."
    )


class PlannedProjectStatusEnum(str, Enum):
    """Status of a planned project seeking funding."""

    SCOPING = "SCOPING"
    PRE_FEASIBILITY = "PRE_FEASIBILITY"
    PROJECT_FEASIBILITY = "PROJECT_FEASIBILITY"
    PROJECT_STRUCTURING = "PROJECT_STRUCTURING"
    TRANSACTION_PREPARATION = "TRANSACTION_PREPARATION"
    IMPLEMENTATION = "IMPLEMENTATION"
    POST_IMPLEMENTATION = "POST_IMPLEMENTATION"


class SolutionCategoryEnum(str, Enum):
    """Solution categories for adaptation actions."""

    ENGINEERED_BUILT_ENVIRONMENT = "ENGINEERED_BUILT_ENVIRONMENT"
    ECONOMIC = "ECONOMIC"
    LAWS_REGULATIONS = "LAWS_REGULATIONS"
    TECHNOLOGICAL = "TECHNOLOGICAL"
    BEHAVIOURAL = "BEHAVIOURAL"
    EDUCATIONAL_INFORMATIONAL = "EDUCATIONAL_INFORMATIONAL"
    ECOSYSTEM_BASED = "ECOSYSTEM_BASED"
    SERVICES = "SERVICES"
    GOVERNMENT_POLICIES_PROGRAMS = "GOVERNMENT_POLICIES_PROGRAMS"


# ==========================================
# Hazard Tab
# ==========================================


class RegionalStatistics(APIBaseModel):
    population_exposed_value: float | None = Field(None, ge=0)
    population_exposed_percentage: float | None = Field(None, ge=0, le=100)
    gdp_at_risk_value: float | None = Field(None, ge=0)
    gdp_at_risk_percentage: float | None = Field(None, ge=0, le=100)
    gdp_at_risk_currency_code: str | None = Field(
        None, pattern="^[A-Z]{3}$"
    )  # ISO 4217 currency code
    vulnerable_sectors: list[Sector] = Field(default_factory=list)


class HazardProfile(APIBaseModel):
    hazard: Hazard
    hazard_rank: int
    source: str | None = Field(None, description="Data source for this hazard profile")
    description: str | None = None
    vulnerable_groups: list[str] = Field(default_factory=list)
    proportion_exposed_range: str | None = Field(
        None, description="Range of proportion exposed (e.g., '10-20%')"
    )
    impact: str | None = None
    most_exposed_sectors: list[Sector] = Field(default_factory=list)


class HazardsTab(APIBaseModel):
    statistics: RegionalStatistics
    hazards: list[HazardProfile] = Field(
        default_factory=list,
        description=(
            "List of hazard profiles, ordered by hazard_rank. Each profile's "
            "`source` field distinguishes disclosed rows from GEE-derived rows; "
            "the frontend can filter on it for any visual distinction."
        ),
    )


# ==========================================
# Actions Tab
# ==========================================


class AdaptationGoal(APIBaseModel):
    title: str
    hazards_addressed: list[Hazard] = Field(default_factory=list)
    metric_indicator: str | None = None
    comment: str | None = None
    base_year: int | None = None
    target_year: int | None = None


class AdaptationAction(APIBaseModel):
    title: str
    status: ActionStatus | None = None
    co_benefits: list[str] = Field(default_factory=list)
    hazards_addressed: list[Hazard] = Field(default_factory=list)
    total_cost_usd: float | None = Field(None, ge=0)
    timeframe: str | None = None
    description: str | None = None
    resilience_enhanced: list[str] = Field(default_factory=list)
    impacted_sectors: list[Sector] = Field(default_factory=list)
    image_url: HttpUrl | None = None

    @field_validator("description", "timeframe", mode="before")
    @classmethod
    def unescape_newlines(cls, v: str | None) -> str | None:
        """Convert escaped newline characters to actual newlines and strip whitespace."""
        if isinstance(v, str):
            return v.replace("\\n", "\n").strip()
        return v


class ProjectSeekingFunding(APIBaseModel):
    title: str
    status: PlannedProjectStatusEnum | None = None
    description: str | None = None
    project_area: str | None = None
    finance_status: str | None = None
    finance_model: list[str] = Field(default_factory=list)
    funded_percent: float | None = Field(None, ge=0, le=100)
    total_amount: float | None = Field(None, ge=0)
    total_needed: float | None = Field(None, ge=0)
    hazards_addressed: list[Hazard] = Field(default_factory=list)
    image_url: HttpUrl | None = None


class ActionsTab(APIBaseModel):
    goals: list[AdaptationGoal] = Field(default_factory=list)
    actions: list[AdaptationAction] = Field(default_factory=list)
    projects: list[ProjectSeekingFunding] = Field(default_factory=list)


# ==========================================
# Solutions Tab
# ==========================================


class PeerAction(APIBaseModel):
    peer_name: str | None = (
        None  # TODO: Remove option None when BE is updated to always return an action for solutions
    )
    # Peer jurisdiction location, resolved from peer_org_id so the detail
    # header can render a map thumbnail and country line for the peer.
    country: str | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    geometry: dict[str, Any] | None = None
    action: AdaptationAction | None = (
        None  # TODO: Remove option None when BE is updated to always return an action for solutions
    )


class SolutionCard(APIBaseModel):
    solution: str | None = (
        None  # TODO: Remove option None when BE is updated to always return a solution for solutions
    )
    solution_category: SolutionCategoryEnum | None = (
        None  # TODO: Remove option None when BE is updated to always return an action for solutions
    )
    peer_actions: list[PeerAction] | None = Field(
        default_factory=list
    )  # TODO: Remove option None when BE is updated to always return an action for solutions
    pct_peer_taking_action: float | None = Field(None, ge=0, le=100)
    solution_hazards_addressed: list[Hazard] | None = Field(default_factory=list)
    hazard_filter: str | None = None
    has_local_action: bool | None = None


class SolutionsTab(APIBaseModel):
    solutions: dict[SolutionCategoryEnum, list[SolutionCard]] = Field(
        default_factory=dict
    )


# ==========================================
# Location Details
# ==========================================


class LocationProfile(APIBaseModel):
    """Defines the complete location details response schema."""

    # Header
    organization_id: int
    name: str
    country_name: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    geometry: dict[str, Any]
    is_reporting_leader: bool = False
    public_status: str | None = Field(
        None,
        description='Disclosure visibility for the org — "Public", "Non-Public", or null when the org has not disclosed (non-discloser).',
    )
    has_climate_risk_assessment: bool | None = Field(
        None,
        description="Whether the org has conducted a climate risk and vulnerability assessment (CRVA).",
    )
    disclosure_year: int | None = None
    reporting_language: str | None = None
    requesters: list[str] = Field(default_factory=list)
    population: float | None = None

    # Tabs
    hazards: HazardsTab
    government_actions: ActionsTab
    solutions: SolutionsTab


class LocationPin(APIBaseModel):
    """Defines the coordinates for a location pin on the map."""

    name: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    org_type: OrgTypeEnum | None = None


# ==========================================
# API Response Wrappers
# ==========================================


class LocationResponse(APIBaseModel):
    """Response wrapper for a single location profile."""

    location: LocationProfile


class LocationNamesResponse(APIBaseModel):
    """Response wrapper for a list of location names."""

    locations: list[OrganizationSummary]


class LocationSeoSummary(APIBaseModel):
    """Lightweight organization summary used to generate crawlable SEO pages."""

    id: int
    name: str
    country: str | None = None
    organization_type: str | None = None
    population: float | None = None
    disclosure_status: str | None = None
    public_status: str | None = None
    disclosure_year: int | None = None
    top_hazards: list[str] = Field(default_factory=list)
    action_count: int = 0
    goal_count: int = 0
    project_count: int = 0
    solution_count: int = 0


class LocationSeoResponse(APIBaseModel):
    """Response wrapper for SEO generation summaries."""

    locations: list[LocationSeoSummary]


class LocationPinsResponse(APIBaseModel):
    """Response wrapper for a list of location pins."""

    pins: list[LocationPin]
