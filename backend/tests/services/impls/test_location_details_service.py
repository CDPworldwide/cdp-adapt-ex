"""Tests for LocationDetailsService."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from app.models.location_details import (
    DimCentral,
    FactActions,
    FactAdaptationGoals,
    FactHazards,
    PeerSolutions,
    SolutionsExamples,
)
from app.schemas.location import (
    ActionStatusEnum,
    HazardEnum,
    LocationPin,
    OrgTypeEnum,
    Sector,
    SectorEnum,
    SolutionCategoryEnum,
)
from app.services.clients.database.location_details_repository import (
    LocationDetailsRepository,
)
from app.services.impls.location_details_service import LocationDetailsService
from app.services.interfaces.city_resolution_service import CityResolutionService
from app.shared.exceptions import (
    CityGeometryMissingException,
    CityNotFoundException,
    MultipleCitiesFoundException,
)


def build_mock_metadata(**kwargs):
    defaults = {
        "cdp_disclosing_org_number": 3203,
        "disclosing_organization": "TestCity",
        "discloser_country_or_area": "USA",
        "cdp_requesting_org_number": 3203,
        "has_geometry": True,
        "geometry": json.dumps({"type": "Point", "coordinates": [10.0, 20.0]}),
    }
    defaults.update(kwargs)
    return DimCentral(**defaults)


def build_mock_hazard(**kwargs):
    defaults = {
        "cdp_disclosing_org_number": 3203,
        "hazard_english": "Extreme heat",
        "summary_text": "Default summary",
        "public_status": "Public",
        "hazard_rank": 1,
    }
    defaults.update(kwargs)
    return FactHazards(**defaults)


def build_mock_goal(**kwargs):
    defaults = {
        "cdp_disclosing_org_number": 3203,
        "disclosure_cycle": "2025",
        "disclosing_organization": "TestCity",
        "public_status": "Public",
        "goal_english": "Default goal",
        "hazard_addressed_english": "Extreme heat",
        "base_year": 2026,
        "target_year": 2030,
        "metric_used_english": "Default metric",
        "comment_english": "Default comment",
    }
    defaults.update(kwargs)
    return FactAdaptationGoals(**defaults)


def build_mock_action(**kwargs):
    defaults = {
        "cdp_disclosing_org_number": 3203,
        "action_english": "Default action",
        "hazard_addressed_english": "Extreme heat",
        "action_status_english": "Scoping",
        "cobenefit_realized_english": "Social: Shade",
        "total_cost_usd": 1000.0,
        "timeframe_english": "2021-2023",
        "action_description_english": "Default description",
        "resilience_enhanced_english": "Biodiversity",
        "sectors_applied_english": "Agriculture; Construction",
    }
    defaults.update(kwargs)
    return FactActions(**defaults)


def build_mock_solution(**kwargs):
    defaults = {
        "cdp_disclosing_org_number": 3203,
        "disclosing_year": 2025,
        "target_org_id": 3203,
        "solution_category": "Engineered and built environment actions",
        "solution": None,
        "action_rank": 1,
        "action_english": "Install green roofs",
        "action_index": 1,
        "action_count": 1,
        "peer_org_cnt": 1,
        "pct_peers": 50,
        "hazard_addressed": "Urban flooding",
        "hazard_filter": "All",
        "has_local_action": False,
    }
    defaults.update(kwargs)
    return PeerSolutions(**defaults)


def build_mock_solution_example(**kwargs):
    defaults = {
        "disclosing_year": 2025,
        "target_org_id": 3203,
        "hazard_filter": "All",
        "action_english": "Install green roofs",
        "peer_org_id": 3333,
        "peer_org_name": "Peer Org Name",
        "action_index": 1,
        "hazard_addressed_english": "Urban flooding",
        "action_description_english": "Green roofs reduce runoff",
        "sectors_applied_english": "Construction",
        "resilience_enhanced_english": "Stormwater management",
        "cobenefit_realized_english": "Health: better air",
        "timeframe_english": "2022-2024",
        "action_status_english": "Implementation underway",
        "total_cost_usd": 100000.0,
        "completeness_score": 90,
    }
    defaults.update(kwargs)
    return SolutionsExamples(**defaults)


@pytest.fixture
def mock_repository():
    """Create a mock LocationDetailsRepository with safe defaults."""
    repo = AsyncMock(spec=LocationDetailsRepository)
    repo.get_hazards.return_value = []
    repo.get_goals.return_value = []
    repo.get_actions.return_value = []
    repo.get_projects.return_value = []
    repo.get_solutions.return_value = []
    repo.get_solution_examples.return_value = []
    repo.get_metadata.return_value = build_mock_metadata()
    return repo


@pytest.fixture
def mock_city_resolution_service():
    """Create a mock CityResolutionService with safe defaults."""
    service = AsyncMock(spec=CityResolutionService)
    service.resolve_org_id.return_value = 3203
    return service


@pytest.fixture
def location_details_service(mock_repository, mock_city_resolution_service):
    """Create a LocationDetailsService with mock repository."""
    return LocationDetailsService(mock_repository, mock_city_resolution_service)


class TestGetEligibleLocationDetailsByName:
    """Tests for the get_eligible_location_details_by_name method."""

    async def test_city_not_found_raises_exception(
        self,
        location_details_service: LocationDetailsService,
        mock_city_resolution_service: AsyncMock,
    ):
        """Test that requesting an unknown city raises CityNotFoundException."""
        mock_city_resolution_service.resolve_org_id.return_value = None
        with pytest.raises(CityNotFoundException) as exc_info:
            await location_details_service.get_eligible_location_details_by_name(
                "UnknownCity"
            )
        assert exc_info.value.city_name == "UnknownCity"

    async def test_city_multiple_found_propagates_exception(
        self,
        location_details_service: LocationDetailsService,
        mock_city_resolution_service: AsyncMock,
    ):
        """Test that MultipleCitiesFoundException is propagated."""
        mock_city_resolution_service.resolve_org_id.side_effect = (
            MultipleCitiesFoundException("City", [])
        )
        with pytest.raises(MultipleCitiesFoundException):
            await location_details_service.get_eligible_location_details_by_name("City")

    async def test_get_location_details_happy_path(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test the happy path: orchestrating and aggregating data from all repositories."""
        mock_repository.get_hazards.return_value = [build_mock_hazard()]
        mock_repository.get_goals.return_value = [build_mock_goal()]
        mock_repository.get_actions.return_value = [build_mock_action()]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )

        assert result.name == "TestCity"
        assert result.country_name == "USA"
        assert result.lat == 20.0
        assert result.lng == 10.0
        assert len(result.hazards.hazards) == 1
        assert len(result.government_actions.goals) == 1
        assert len(result.government_actions.actions) == 1
        assert result.solutions.solutions == {}

    async def test_get_location_includes_mapped_solutions(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test that solution rows are mapped into the location profile."""
        mock_repository.get_solutions.return_value = [build_mock_solution()]
        mock_repository.get_solution_examples.return_value = [
            build_mock_solution_example()
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )

        assert len(result.solutions.solutions) == 1
        solution_cards = result.solutions.solutions[
            SolutionCategoryEnum.ENGINEERED_BUILT_ENVIRONMENT
        ]
        assert len(solution_cards) == 1
        solution_card = solution_cards[0]
        assert solution_card.solution_category == (
            SolutionCategoryEnum.ENGINEERED_BUILT_ENVIRONMENT
        )
        assert solution_card.pct_peer_taking_action == 50.0
        assert len(solution_card.peer_actions) == 1
        assert solution_card.peer_actions[0].peer_name == "Peer Org Name"
        assert len(solution_card.solution_hazards_addressed) == 1
        assert (
            solution_card.solution_hazards_addressed[0].hazard_type
            == HazardEnum.URBAN_FLOODING
        )
        assert solution_card.has_local_action is False

    async def test_get_location_maps_has_local_action_true(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        mock_repository.get_solutions.return_value = [
            build_mock_solution(has_local_action=True)
        ]
        mock_repository.get_solution_examples.return_value = [
            build_mock_solution_example()
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )

        solution_cards = result.solutions.solutions[
            SolutionCategoryEnum.ENGINEERED_BUILT_ENVIRONMENT
        ]
        assert solution_cards[0].has_local_action is True

    async def test_get_location_with_missing_metadata(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test retrieving location details when metadata is None."""
        mock_repository.get_metadata.return_value = None
        with pytest.raises(CityNotFoundException):
            await location_details_service.get_eligible_location_details_by_name(
                "TestCity"
            )

    async def test_get_location_with_missing_disclosing_organization_raises_exception(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test that missing disclosing organization is treated as invalid metadata."""
        mock_repository.get_metadata.return_value = build_mock_metadata(
            disclosing_organization=None
        )

        with pytest.raises(CityNotFoundException) as exc_info:
            await location_details_service.get_eligible_location_details_by_name(
                "TestCity"
            )

        assert exc_info.value.city_name == "TestCity"

    async def test_get_location_with_invalid_geometry_coordinates(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test that invalid coordinates in geometry raise CityGeometryMissingException."""
        mock_repository.get_metadata.return_value = build_mock_metadata(
            has_geometry=True,
            geometry=json.dumps({"type": "Point", "coordinates": []}),
        )
        with pytest.raises(CityGeometryMissingException) as exc_info:
            await location_details_service.get_eligible_location_details_by_name(
                "TestCity"
            )
        assert "has invalid or missing geometry data" in str(exc_info.value)

    # ---------------------------------------------------------------------
    # Hazard Mapping Tests
    # ---------------------------------------------------------------------

    async def test_get_location_filters_invalid_hazards(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test that invalid hazard strings are filtered out."""
        mock_repository.get_hazards.return_value = [
            build_mock_hazard(hazard_english="Extreme heat"),
            build_mock_hazard(hazard_english="Unknown hazard type", hazard_rank=2),
        ]
        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )
        assert len(result.hazards.hazards) == 1
        assert result.hazards.hazards[0].hazard.hazard_type == HazardEnum.EXTREME_HEAT

    async def test_hazard_profile_mapping_is_complete(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test that all relevant fields from FactHazards are mapped to HazardProfile."""
        mock_repository.get_hazards.return_value = [
            build_mock_hazard(
                population_exposed_english="Children; Elderly, Low-income households",
                sectors_exposed_english="Agriculture| Construction| Invalid Sector",
                impacts="Test impact description.",
                population_range="10-20%",
            )
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )
        hazard_profile = result.hazards.hazards[0]

        assert hazard_profile.hazard.hazard_type == HazardEnum.EXTREME_HEAT
        assert hazard_profile.description == "Default summary"
        assert hazard_profile.impact == "Test impact description."
        assert hazard_profile.proportion_exposed_range == "10-20%"
        assert hazard_profile.vulnerable_groups == [
            "Children",
            "Elderly",
            "Low-income households",
        ]
        assert hazard_profile.most_exposed_sectors == [
            Sector(sector_type=SectorEnum.AGRICULTURE),
            Sector(sector_type=SectorEnum.CONSTRUCTION),
        ]

    async def test_hazard_profile_mapping_with_null_and_empty_values(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test that null and empty string values are handled gracefully during mapping."""
        mock_repository.get_hazards.return_value = [
            build_mock_hazard(
                hazard_english="Drought",
                summary_text=None,
                population_exposed_english="",
                sectors_exposed_english=None,
                impacts=None,
                population_range=None,
            )
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )
        hazard_profile = result.hazards.hazards[0]

        assert hazard_profile.hazard.hazard_type == HazardEnum.DROUGHT
        assert hazard_profile.description is None
        assert hazard_profile.impact is None
        assert hazard_profile.proportion_exposed_range is None
        assert hazard_profile.vulnerable_groups == []
        assert hazard_profile.most_exposed_sectors == []

    # ---------------------------------------------------------------------
    # Goal Mapping Tests
    # ---------------------------------------------------------------------

    @pytest.mark.parametrize(
        "hazard_str,expected_types",
        [
            (
                "Extreme heat| Urban flooding",
                [HazardEnum.EXTREME_HEAT, HazardEnum.URBAN_FLOODING],
            ),
            (
                "Extreme heat| Invalid type| Urban flooding",
                [HazardEnum.EXTREME_HEAT, HazardEnum.URBAN_FLOODING],
            ),
            (None, []),
        ],
    )
    async def test_goal_hazard_parsing(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
        hazard_str,
        expected_types,
    ):
        """Test parsing of multiple, invalid, and empty hazards in goals."""
        mock_repository.get_goals.return_value = [
            build_mock_goal(hazard_addressed_english=hazard_str)
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )
        hazards_addressed = result.government_actions.goals[0].hazards_addressed

        actual_types = {h.hazard_type for h in hazards_addressed}
        assert actual_types == set(expected_types)

    # ---------------------------------------------------------------------
    # Action Mapping Tests
    # ---------------------------------------------------------------------

    async def test_action_mapping_is_complete(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test that all relevant fields from FactActions are mapped to AdaptationAction."""
        mock_repository.get_actions.return_value = [
            build_mock_action(
                action_english="Test Action",
                action_status_english="Scoping",
                hazard_addressed_english="Extreme heat| Drought",
                cobenefit_realized_english="Social: Benefit 1| Economic: Benefit 2",
                total_cost_usd=5000.0,
                timeframe_english="2025",
                action_description_english="Test action description.",
                resilience_enhanced_english="Test resilience",
                sectors_applied_english="Agriculture| Construction| Invalid Sector",
            )
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )
        action = result.government_actions.actions[0]

        assert action.title == "Test Action"
        assert action.status.status_type == ActionStatusEnum.SCOPING
        assert {h.hazard_type for h in action.hazards_addressed} == {
            HazardEnum.EXTREME_HEAT,
            HazardEnum.DROUGHT,
        }
        assert action.co_benefits == ["Social: Benefit 1", "Economic: Benefit 2"]
        assert action.total_cost_usd == 5000.0
        assert action.timeframe == "2025"
        assert action.description == "Test action description."
        assert action.resilience_enhanced == ["Test resilience"]
        assert action.impacted_sectors == [
            Sector(sector_type=SectorEnum.AGRICULTURE),
            Sector(sector_type=SectorEnum.CONSTRUCTION),
        ]

    async def test_action_mapping_with_null_and_empty_values(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Test that null and empty string values are handled gracefully during action mapping."""
        mock_repository.get_actions.return_value = [
            build_mock_action(
                action_english="Test Action 2",
                action_status_english=None,
                hazard_addressed_english=None,
                cobenefit_realized_english=None,
                total_cost_usd=None,
                timeframe_english=None,
                action_description_english=None,
                resilience_enhanced_english=None,
                sectors_applied_english=None,
            )
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )
        action = result.government_actions.actions[0]

        assert action.title == "Test Action 2"
        assert action.status is None
        assert action.hazards_addressed == []
        assert action.co_benefits == []
        assert action.total_cost_usd is None
        assert action.timeframe is None
        assert action.description is None
        assert action.resilience_enhanced == []
        assert action.impacted_sectors == []

    @pytest.mark.parametrize(
        "cobenefit_str,expected_benefits",
        [
            (
                "Social: Benefit 1| Economic: Benefit 2",
                ["Social: Benefit 1", "Economic: Benefit 2"],
            ),
            ("Public Health: Benefit 3", ["Public Health: Benefit 3"]),
            (None, []),
        ],
    )
    async def test_parses_cobenefits(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
        cobenefit_str,
        expected_benefits,
    ):
        """Co-benefits are split correctly."""
        mock_repository.get_actions.return_value = [
            build_mock_action(cobenefit_realized_english=cobenefit_str)
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )
        assert result.government_actions.actions[0].co_benefits == expected_benefits

    @pytest.mark.parametrize(
        "resilience_str,expected_attributes",
        [
            ("Attribute 1| Attribute 2", ["Attribute 1", "Attribute 2"]),
            ("Attribute 3", ["Attribute 3"]),
            (None, []),
        ],
    )
    async def test_parses_resilience_enhanced(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
        resilience_str,
        expected_attributes,
    ):
        """Resilience attributes are split correctly."""
        mock_repository.get_actions.return_value = [
            build_mock_action(resilience_enhanced_english=resilience_str)
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )
        assert (
            result.government_actions.actions[0].resilience_enhanced
            == expected_attributes
        )

    async def test_ignores_actions_without_title(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Ensure actions lacking titles are filtered before mapping."""
        mock_repository.get_actions.return_value = [
            build_mock_action(action_english=None, action_status_english=None),
            build_mock_action(
                action_english="Valid action",
                action_status_english=None,
                cobenefit_realized_english=None,
            ),
        ]

        result = await location_details_service.get_eligible_location_details_by_name(
            "TestCity"
        )
        assert len(result.government_actions.actions) == 1
        assert result.government_actions.actions[0].title == "Valid action"
        assert result.government_actions.actions[0].status is None
        assert result.government_actions.actions[0].co_benefits == []


class TestGetLocationDetailsByOrgId:
    """Tests for direct organization ID profile lookup."""

    async def test_get_location_by_org_id_allows_non_public_metadata(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Direct org links can load geometry-backed non-public organizations."""
        mock_repository.has_organization.return_value = True
        mock_repository.get_metadata.return_value = build_mock_metadata(
            cdp_disclosing_org_number=72990,
            disclosing_organization="Vestland County",
            public_status=None,
        )

        result = await location_details_service.get_location_details_by_org_id(72990)

        assert result.organization_id == 72990
        assert result.name == "Vestland County"
        assert result.geometry == {"type": "Point", "coordinates": [10.0, 20.0]}
        mock_repository.has_organization.assert_awaited_once_with(72990)

    async def test_get_location_by_org_id_raises_when_org_missing(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        mock_repository.has_organization.return_value = False

        with pytest.raises(CityNotFoundException) as exc_info:
            await location_details_service.get_location_details_by_org_id(999999)

        assert exc_info.value.city_name == "999999"
        mock_repository.get_metadata.assert_not_awaited()


class TestGetAllLocationPins:
    """Tests for the get_all_location_pins method."""

    @pytest.fixture(autouse=True)
    def _reset_pins_cache(self):
        # `_pins_cache` is a class-level attribute, so it persists across tests
        # even with a fresh service instance. Reset it before each test.
        LocationDetailsService._pins_cache = None
        yield
        LocationDetailsService._pins_cache = None

    async def test_get_all_location_pins_falls_back_to_first_vertex(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """When centroid is NULL, pins are derived from the first polygon vertex."""
        mock_geom_1 = MagicMock()
        mock_geom_1.name = "City 1"
        mock_geom_1.org_type = "City"
        mock_geom_1.geometry = json.dumps(
            {"type": "Point", "coordinates": [-87.62, 41.88]}
        )
        mock_geom_1.centroid_lng = None
        mock_geom_1.centroid_lat = None

        mock_geom_2 = MagicMock()
        mock_geom_2.name = "Region 1"
        mock_geom_2.org_type = "States & Regions"
        mock_geom_2.geometry = json.dumps(
            {"type": "MultiPolygon", "coordinates": [[[-100.0, 50.0]]]}
        )
        mock_geom_2.centroid_lng = None
        mock_geom_2.centroid_lat = None

        mock_geom_invalid = MagicMock()
        mock_geom_invalid.name = "Invalid 1"
        mock_geom_invalid.org_type = "Unknown"
        mock_geom_invalid.geometry = json.dumps({"type": "Point", "coordinates": []})
        mock_geom_invalid.centroid_lng = None
        mock_geom_invalid.centroid_lat = None

        mock_repository.get_all_location_geometries.return_value = [
            mock_geom_1,
            mock_geom_2,
            mock_geom_invalid,
        ]

        result = await location_details_service.get_all_location_pins()

        assert len(result) == 2

        assert isinstance(result[0], LocationPin)
        assert result[0].name == "City 1"
        assert result[0].lng == -87.62
        assert result[0].lat == 41.88
        assert result[0].org_type == OrgTypeEnum.CITY

        assert isinstance(result[1], LocationPin)
        assert result[1].name == "Region 1"
        assert result[1].lng == -100.0
        assert result[1].lat == 50.0
        assert result[1].org_type == OrgTypeEnum.STATE_AND_REGION

    async def test_get_all_location_pins_uses_centroid_when_present(
        self,
        location_details_service: LocationDetailsService,
        mock_repository: AsyncMock,
    ):
        """Centroid lng/lat take precedence over the polygon vertex extraction."""
        mock_geom = MagicMock()
        mock_geom.name = "Bacolod City"
        mock_geom.org_type = "City"
        # Polygon's first vertex is intentionally far from the centroid so the
        # test fails loudly if the fallback path runs by accident.
        mock_geom.geometry = json.dumps(
            {"type": "Polygon", "coordinates": [[[0.0, 0.0], [1.0, 0.0], [1.0, 1.0]]]}
        )
        mock_geom.centroid_lng = 122.939129
        mock_geom.centroid_lat = 10.657663

        mock_repository.get_all_location_geometries.return_value = [mock_geom]

        result = await location_details_service.get_all_location_pins()

        assert len(result) == 1
        assert result[0].name == "Bacolod City"
        assert result[0].lng == 122.939129
        assert result[0].lat == 10.657663
        assert result[0].org_type == OrgTypeEnum.CITY
