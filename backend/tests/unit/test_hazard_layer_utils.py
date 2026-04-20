from unittest.mock import patch

import pytest
from app.schemas.hazard_layer import ScenarioEnum, YearRange
from app.schemas.location import HazardEnum
from app.shared.exceptions import HazardLayerNotFoundException
from app.utils.hazard_layer_utils import get_image_id, get_vis_params

TEST_CASES = [
    # Coastal-Flood
    (
        HazardEnum.COASTAL_FLOODING,
        ScenarioEnum.HISTORICAL,
        None,
        "Coastal-Flood/WRI_Coastal_Flood_historical",
    ),
    # Cold
    (
        HazardEnum.EXTREME_COLD,
        ScenarioEnum.HISTORICAL,
        None,
        "Cold/frost_days_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
    ),
    (
        HazardEnum.EXTREME_COLD,
        ScenarioEnum.SSP126,
        YearRange(start=2020, end=2039),
        "Cold/frost_days_score_1to5_ssp126_2020_2039_epsg4326_lon-180_180",
    ),
    # Fire
    (
        HazardEnum.FIRE_WEATHER,
        ScenarioEnum.HISTORICAL,
        None,
        "Fire/FWI_N45_score_1to5_1985_2015_epsg4326_lon-180_180_historical",
    ),
    (
        HazardEnum.FIRE_WEATHER,
        ScenarioEnum.SSP370,
        YearRange(start=2020, end=2039),
        "Fire/FWI_N45_score_1to5_2020_2039_epsg4326_lon-180_180_ssp370",
    ),
    # Landslides
    (
        HazardEnum.SOIL_DEGRADATION_EROSION,
        ScenarioEnum.HISTORICAL,
        None,
        "Landslides/Landslides_Historical",
    ),
    # Precipitation
    (
        HazardEnum.HEAVY_PRECIPITATION,
        ScenarioEnum.HISTORICAL,
        None,
        "Precipitation/pr_rx5day_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
    ),
    (
        HazardEnum.HEAVY_PRECIPITATION,
        ScenarioEnum.SSP245,
        YearRange(start=2020, end=2039),
        "Precipitation/pr_rx5day_score_1to5_ssp245_2020_2039_epsg4326_lon-180_180",
    ),
    # Riverine-Flood
    (
        HazardEnum.RIVER_FLOODING,
        ScenarioEnum.HISTORICAL,
        None,
        "Riverine-Flood/WRI_Riverine_Flood_historical",
    ),
    # Water-Stress
    (
        HazardEnum.WATER_STRESS,
        ScenarioEnum.HISTORICAL,
        None,
        "Water-Stress/WRI_Water_Stress_historical",
    ),
    (
        HazardEnum.WATER_STRESS,
        ScenarioEnum.SSP126,
        YearRange(start=2030, end=2030),
        "Water-Stress/WRI_Water_Stress_2030_ssp126",
    ),
    # Extreme Heat
    (
        HazardEnum.EXTREME_HEAT,
        ScenarioEnum.HISTORICAL,
        None,
        "heat/hotdays_score_1to5_historical_1985_2014_epsg4326",
    ),
    (
        HazardEnum.EXTREME_HEAT,
        ScenarioEnum.SSP370,
        YearRange(start=2020, end=2039),
        "heat/hotdays_score_1to5_ssp370_2020_2039_epsg4326",
    ),
    # Heat stress
    (
        HazardEnum.HEAT_STRESS,
        ScenarioEnum.HISTORICAL,
        None,
        "heat/hotdays_score_1to5_historical_1985_2014_epsg4326",
    ),
    (
        HazardEnum.HEAT_STRESS,
        ScenarioEnum.SSP585,
        YearRange(start=2020, end=2039),
        "heat/hotdays_score_1to5_ssp585_2020_2039_epsg4326",
    ),
]


@pytest.mark.parametrize(
    "hazard_name, scenario, year_ranges, expected_partial_id", TEST_CASES
)
@patch("app.utils.hazard_layer_utils.settings")
def test_get_image_id_parameterized(
    mock_settings, hazard_name, scenario, year_ranges, expected_partial_id
):
    """
    Tests get_image_id with a wide range of scenarios.
    """
    mock_settings.GCP_PROJECT_ID = "test-project"
    expected_id = f"projects/test-project/assets/hazards/{expected_partial_id}"

    result = get_image_id(hazard_name, scenario, year_ranges)

    assert result == expected_id


@patch("app.utils.hazard_layer_utils.settings")
def test_get_image_id_invalid_scenario_for_hazard(mock_settings):
    """
    Tests that get_image_id raises a ValueError for a hazard that does not have a given scenario.
    """
    mock_settings.GCP_PROJECT_ID = "test-project"
    # Coastal flooding only has a "historical" template
    hazard_name = HazardEnum.COASTAL_FLOODING
    scenario = ScenarioEnum.SSP126

    with pytest.raises(ValueError) as excinfo:
        get_image_id(hazard_name, scenario)

    assert "Invalid template for hazard: COASTAL_FLOODING and scenario: ssp126" in str(
        excinfo.value
    )


@patch("app.utils.hazard_layer_utils.get_hazard_config", return_value={})
def test_get_image_id_missing_hazard_template(mock_get_hazard_config):
    """
    Tests that get_image_id raises a ValueError if the hazard is not in the templates dictionary.
    """
    hazard_name = HazardEnum.EXTREME_HEAT
    scenario = ScenarioEnum.SSP585

    with pytest.raises(HazardLayerNotFoundException) as excinfo:
        get_image_id(hazard_name, scenario)

    assert f"Missing config for hazard: {hazard_name}" in str(excinfo.value)


def test_get_vis_params():
    """
    Tests that get_vis_params returns the correct visualization parameters.
    """
    hazard_name = HazardEnum.EXTREME_HEAT
    expected_vis_params = {
        "min": 1,
        "max": 5,
        "palette": ["#ffffcc", "#fed976", "#fd8d3c", "#fc4e2a", "#b10026"],
    }

    result = get_vis_params(hazard_name)

    assert result == expected_vis_params
