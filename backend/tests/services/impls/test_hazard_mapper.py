"""Tests for HazardMapper."""

import pytest
from app.schemas.location import Hazard, HazardEnum
from app.services.impls.hazard_mapper import HazardMapper


@pytest.fixture
def hazard_mapper():
    return HazardMapper()


def test_map_string_to_hazard_known(hazard_mapper):
    assert hazard_mapper.map_string_to_hazard("Extreme heat") == Hazard(
        hazard_type=HazardEnum.EXTREME_HEAT
    )
    assert hazard_mapper.map_string_to_hazard("   Drought   ") == Hazard(
        hazard_type=HazardEnum.DROUGHT
    )


def test_map_string_to_hazard_other(hazard_mapper):
    assert hazard_mapper.map_string_to_hazard("Other: Wildfire") == Hazard(
        hazard_type=HazardEnum.OTHERS, other_hazard_details="Wildfire"
    )
    assert hazard_mapper.map_string_to_hazard("Other:    ") is None


def test_map_string_to_hazard_label_override(hazard_mapper):
    """Strings routed to a specific enum but with a display-label override
    should retain the original label in other_hazard_details"""
    assert hazard_mapper.map_string_to_hazard("Mass movement") == Hazard(
        hazard_type=HazardEnum.SOIL_DEGRADATION_EROSION,
        other_hazard_details="Mass movement",
    )
    assert hazard_mapper.map_string_to_hazard("Other: Landslides") == Hazard(
        hazard_type=HazardEnum.SOIL_DEGRADATION_EROSION,
        other_hazard_details="Landslides",
    )
    assert hazard_mapper.map_string_to_hazard("Other: Landslide") == Hazard(
        hazard_type=HazardEnum.SOIL_DEGRADATION_EROSION,
        other_hazard_details="Landslides",
    )
    # Soil degradation/erosion keeps no override — the enum translation is correct
    assert hazard_mapper.map_string_to_hazard("Soil degradation/erosion") == Hazard(
        hazard_type=HazardEnum.SOIL_DEGRADATION_EROSION
    )


def test_map_string_to_hazard_unknown(hazard_mapper):
    # Unknown hazards should be logged and return None
    assert hazard_mapper.map_string_to_hazard("Something else") is None


def test_map_string_to_hazard_empty(hazard_mapper):
    assert hazard_mapper.map_string_to_hazard("") is None
    assert hazard_mapper.map_string_to_hazard("   ") is None


def test_split_and_map_hazards_single(hazard_mapper):
    input_str = "Extreme heat"
    expected = [Hazard(hazard_type=HazardEnum.EXTREME_HEAT)]
    assert hazard_mapper.split_and_map_hazards(input_str) == expected


def test_split_and_map_hazards_with_empty_parts(hazard_mapper):
    input_str = "Extreme heat| | Drought|"
    expected = [
        Hazard(hazard_type=HazardEnum.EXTREME_HEAT),
        Hazard(hazard_type=HazardEnum.DROUGHT),
    ]
    assert hazard_mapper.split_and_map_hazards(input_str) == expected


def test_split_and_map_hazards_empty_string(hazard_mapper):
    assert hazard_mapper.split_and_map_hazards("") == []
    assert hazard_mapper.split_and_map_hazards(None) == []
