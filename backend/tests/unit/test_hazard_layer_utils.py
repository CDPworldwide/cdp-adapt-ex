from unittest.mock import patch

import pytest
from app.schemas.hazard_layer import ScenarioEnum, YearRange
from app.schemas.location import HazardEnum
from app.shared.exceptions import HazardLayerNotFoundException
from app.utils.hazard_layer_utils import get_image_id, get_vis_params

TEST_CASES = [
    # Coastal flood — historical at year 2010 baseline; SSP scenarios are
    # rendered with the SSP→RCP shim into rcp4p5 / rcp8p5.
    (
        HazardEnum.COASTAL_FLOODING,
        ScenarioEnum.HISTORICAL,
        YearRange(start=2010, end=2010),
        "coastal-flood/coastal-flood_historical_2010_rp100",
    ),
    (
        HazardEnum.COASTAL_FLOODING,
        ScenarioEnum.SSP245,
        YearRange(start=2030, end=2030),
        "coastal-flood/coastal-flood_rcp4p5_2030_rp100",
    ),
    (
        HazardEnum.COASTAL_FLOODING,
        ScenarioEnum.SSP585,
        YearRange(start=2080, end=2080),
        "coastal-flood/coastal-flood_rcp8p5_2080_rp100",
    ),
    # Cold
    (
        HazardEnum.EXTREME_COLD,
        ScenarioEnum.HISTORICAL,
        None,
        "cold/frost_days_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
    ),
    (
        HazardEnum.EXTREME_COLD,
        ScenarioEnum.SSP126,
        YearRange(start=2020, end=2039),
        "cold/frost_days_score_1to5_ssp126_2020_2039_epsg4326_lon-180_180",
    ),
    # Fire
    (
        HazardEnum.FIRE_WEATHER,
        ScenarioEnum.HISTORICAL,
        None,
        "fire/FWI_N45_score_1to5_1985_2014_epsg4326_lon-180_180_historical",
    ),
    (
        HazardEnum.FIRE_WEATHER,
        ScenarioEnum.SSP370,
        YearRange(start=2020, end=2039),
        "fire/FWI_N45_score_1to5_2020_2039_epsg4326_lon-180_180_ssp370",
    ),
    # Landslides
    (
        HazardEnum.SOIL_DEGRADATION_EROSION,
        ScenarioEnum.HISTORICAL,
        None,
        "landslides/Landslides_Historical",
    ),
    # Precipitation
    (
        HazardEnum.HEAVY_PRECIPITATION,
        ScenarioEnum.HISTORICAL,
        None,
        "precip/pr_rx5day_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
    ),
    (
        HazardEnum.HEAVY_PRECIPITATION,
        ScenarioEnum.SSP245,
        YearRange(start=2020, end=2039),
        "precip/pr_rx5day_score_1to5_ssp245_2020_2039_epsg4326_lon-180_180",
    ),
    # Riverine flood — projected only (no historical asset published);
    # SSP→RCP shim applies.
    (
        HazardEnum.RIVER_FLOODING,
        ScenarioEnum.SSP245,
        YearRange(start=2030, end=2030),
        "riverine-flood/riverine-flood_rcp4p5_2030_rp100",
    ),
    (
        HazardEnum.RIVER_FLOODING,
        ScenarioEnum.SSP585,
        YearRange(start=2050, end=2050),
        "riverine-flood/riverine-flood_rcp8p5_2050_rp100",
    ),
    # Water stress
    (
        HazardEnum.WATER_STRESS,
        ScenarioEnum.HISTORICAL,
        None,
        "water-stress/WRI_Water_Stress_historical",
    ),
    (
        HazardEnum.WATER_STRESS,
        ScenarioEnum.SSP126,
        YearRange(start=2030, end=2030),
        "water-stress/WRI_Water_Stress_2030_ssp126",
    ),
    # Extreme Heat — note the _lon-180_180 suffix that's actually in the assets
    (
        HazardEnum.EXTREME_HEAT,
        ScenarioEnum.HISTORICAL,
        None,
        "heat/hotdays_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
    ),
    (
        HazardEnum.EXTREME_HEAT,
        ScenarioEnum.SSP370,
        YearRange(start=2020, end=2039),
        "heat/hotdays_score_1to5_ssp370_2020_2039_epsg4326_lon-180_180",
    ),
    # Heat stress
    (
        HazardEnum.HEAT_STRESS,
        ScenarioEnum.HISTORICAL,
        None,
        "heat/hotdays_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
    ),
    (
        HazardEnum.HEAT_STRESS,
        ScenarioEnum.SSP585,
        YearRange(start=2020, end=2039),
        "heat/hotdays_score_1to5_ssp585_2020_2039_epsg4326_lon-180_180",
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
    expected_id = f"projects/test-project/assets/hazards-v2/{expected_partial_id}"

    result = get_image_id(hazard_name, scenario, year_ranges)

    assert result == expected_id


@patch("app.utils.hazard_layer_utils.settings")
def test_get_image_id_invalid_scenario_for_hazard(mock_settings):
    """
    Tests that get_image_id raises a ValueError for a hazard that does not have a given scenario.
    """
    mock_settings.GCP_PROJECT_ID = "test-project"
    # SOIL_DEGRADATION_EROSION only ships a "historical" template; passing a
    # projected-only scenario should fall through to the missing-template path.
    hazard_name = HazardEnum.SOIL_DEGRADATION_EROSION
    scenario = ScenarioEnum.SSP126

    with pytest.raises(ValueError) as excinfo:
        get_image_id(hazard_name, scenario)

    assert (
        "Invalid template for hazard: SOIL_DEGRADATION_EROSION and scenario: ssp126"
        in str(excinfo.value)
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
    # min=0 because palette[0] is the no-hazard tint (score 0 = assessed but
    # no hazard); max=5 covers severity scores 1-5.
    expected_vis_params = {
        "min": 0,
        "max": 5,
        "palette": ["#FFFCEB", "#ffffcc", "#fed976", "#fd8d3c", "#fc4e2a", "#b10026"],
    }

    result = get_vis_params(hazard_name)

    assert result == expected_vis_params
