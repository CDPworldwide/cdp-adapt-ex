# This module provides utility functions for constructing Earth Engine image
# IDs and visualization parameters based on hazard configurations.
from typing import Optional

from app.schemas.hazard_layer import HazardLayerOptions, ScenarioEnum, YearRange
from app.schemas.location import HazardEnum
from app.shared.config import settings
from app.shared.exceptions import HazardLayerNotFoundException

_WRI_AQUEDUCT_SOURCE = "World Resources Institute (WRI) Aqueduct Floods"
_NEX_GDDP_CMIP6_SOURCE = (
    "NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6)"
)
_NEX_GDDP_FWI_SOURCE = "NASA Earth Exchange-Global Daily Downscaled Projections-Fire Weather Index (NEX-GDDP-FWI)"
_WORLD_BANK_LANDSLIDE_SOURCE = "World Bank Global Landslide Hazard Map"
_WRI_AQUEDUCT_4_SOURCE = "World Resources Institute (WRI) Aqueduct Water Risk Atlas 4.0, including baseline and projected datasets"

# Each palette is 6 colors: index 0 = "no hazard / 0" (a near-white tinted with the
# hazard's primary hue), indices 1-5 = severity scores. NoData is rendered as
# transparent (the EE tile is masked outside assessed pixels and the basemap shows
# through). See get_vis_params below for the min/max wiring.


_HAZARD_LAYER_CONFIG: dict[HazardEnum, HazardLayerOptions] = {
    HazardEnum.COASTAL_FLOODING: HazardLayerOptions(
        scenarios=[ScenarioEnum.HISTORICAL, ScenarioEnum.SSP245, ScenarioEnum.SSP585],
        # Historical = 2010 (closest to a present-day baseline; WRI publishes
        # only projection=95 for inuncoast historical). RCP scenarios use
        # 2030/2050/2080 horizons. All scored against the 2010 baseline's
        # quintile thresholds for cross-scenario comparability.
        historical_year_range=YearRange(start=2010, end=2010),
        year_ranges=[
            YearRange(start=2030, end=2030),
            YearRange(start=2050, end=2050),
            YearRange(start=2080, end=2080),
        ],
        palette=["#EAF6FF", "#C4EBFF", "#47BFFF", "#3BA7E1", "#0082C7", "#005C8F"],
        source=_WRI_AQUEDUCT_SOURCE,
        partial_image_id_templates={
            "historical": "coastal-flood/coastal-flood_historical_{year1}_rp100",
            "projected": "coastal-flood/coastal-flood_{scenario}_{year1}_rp100"
        },
    ),
    HazardEnum.EXTREME_COLD: HazardLayerOptions(
        scenarios=[
            ScenarioEnum.HISTORICAL,
            ScenarioEnum.SSP126,
            ScenarioEnum.SSP245,
            ScenarioEnum.SSP370,
            ScenarioEnum.SSP585,
        ],
        year_ranges=[
            YearRange(start=2020, end=2039),
            YearRange(start=2040, end=2059),
            YearRange(start=2070, end=2089),
        ],
        historical_year_range=YearRange(start=1985, end=2014),
        palette=["#F5EDFF", "#D194FF", "#A64AED", "#7D00DB", "#6900B8", "#540094"],
        source=_NEX_GDDP_CMIP6_SOURCE,
        partial_image_id_templates={
            "historical": "cold/frost_days_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
            "projected": "cold/frost_days_score_1to5_{scenario}_{year1}_{year2}_epsg4326_lon-180_180",
        },
    ),
    HazardEnum.FIRE_WEATHER: HazardLayerOptions(
        scenarios=[
            ScenarioEnum.HISTORICAL,
            ScenarioEnum.SSP126,
            ScenarioEnum.SSP245,
            ScenarioEnum.SSP370,
            ScenarioEnum.SSP585,
        ],
        year_ranges=[
            YearRange(start=2020, end=2039),
            YearRange(start=2040, end=2059),
            YearRange(start=2070, end=2089),
        ],
        historical_year_range=YearRange(start=1985, end=2014),
        palette=["#FCE8EC", "#E88594", "#DE5070", "#E81647", "#A12638", "#6B1A26"],
        source=_NEX_GDDP_FWI_SOURCE,
        partial_image_id_templates={
            "historical": "fire/FWI_N45_score_1to5_1985_2014_epsg4326_lon-180_180_historical",
            "projected": "fire/FWI_N45_score_1to5_{year1}_{year2}_epsg4326_lon-180_180_{scenario}",
        },
    ),
    HazardEnum.SOIL_DEGRADATION_EROSION: HazardLayerOptions(
        scenarios=[ScenarioEnum.HISTORICAL],
        historical_year_range=YearRange(start=1980, end=2018),
        palette=["#FFE2D0", "#FFAD8F", "#FF7847", "#FF4500", "#F03800", "#CC3303"],
        source=_WORLD_BANK_LANDSLIDE_SOURCE,
        partial_image_id_templates={
            "historical": "landslides/Landslides_Historical",
        },
    ),
    HazardEnum.HEAVY_PRECIPITATION: HazardLayerOptions(
        scenarios=[
            ScenarioEnum.HISTORICAL,
            ScenarioEnum.SSP126,
            ScenarioEnum.SSP245,
            ScenarioEnum.SSP370,
            ScenarioEnum.SSP585,
        ],
        year_ranges=[
            YearRange(start=2020, end=2039),
            YearRange(start=2040, end=2059),
            YearRange(start=2070, end=2089),
        ],
        historical_year_range=YearRange(start=1985, end=2014),
        palette=["#EAFBF1", "#9CFAB5", "#72E884", "#72F478", "#00B233", "#00661C"],
        source=_NEX_GDDP_CMIP6_SOURCE,
        partial_image_id_templates={
            "historical": "precip/pr_rx5day_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
            "projected": "precip/pr_rx5day_score_1to5_{scenario}_{year1}_{year2}_epsg4326_lon-180_180",
        },
    ),
    HazardEnum.RIVER_FLOODING: HazardLayerOptions(
        scenarios=[ScenarioEnum.SSP245,
                   ScenarioEnum.SSP585],
        historical_year_range=YearRange(start=1979, end=2019),
        year_ranges=[
            YearRange(start=2020, end=2039),
            YearRange(start=2040, end=2059),
            YearRange(start=2070, end=2089),
        ],
        palette=["#EAF6FF", "#8FD9FF", "#47BFFF", "#00A6FF", "#0082C7", "#005C8F"],
        source=_WRI_AQUEDUCT_SOURCE,
        partial_image_id_templates={
            "projected": "riverine-flood/riverine-flood_{scenario}_{year1}_rp100"
        },
    ),
    HazardEnum.WATER_STRESS: HazardLayerOptions(
        scenarios=[
            ScenarioEnum.HISTORICAL,
            ScenarioEnum.SSP126,
            ScenarioEnum.SSP370,
            ScenarioEnum.SSP585,
        ],
        year_ranges=[
            YearRange(start=2030, end=2030),
            YearRange(start=2050, end=2050),
            YearRange(start=2080, end=2080),
        ],
        historical_year_range=YearRange(start=1979, end=2019),
        palette=["#FFFCEB", "#ffffcc", "#fed976", "#fd8d3c", "#fc4e2a", "#b10026"],
        source=_WRI_AQUEDUCT_4_SOURCE,
        partial_image_id_templates={
            "historical": "water-stress/WRI_Water_Stress_historical",
            "projected": "water-stress/WRI_Water_Stress_{year1}_{scenario}",
        },
    ),
    HazardEnum.HEAT_STRESS: HazardLayerOptions(
        scenarios=[
            ScenarioEnum.HISTORICAL,
            ScenarioEnum.SSP126,
            ScenarioEnum.SSP245,
            ScenarioEnum.SSP370,
            ScenarioEnum.SSP585,
        ],
        year_ranges=[
            YearRange(start=2020, end=2039),
            YearRange(start=2040, end=2059),
            YearRange(start=2070, end=2089),
        ],
        historical_year_range=YearRange(start=1985, end=2014),
        palette=["#FFFCEB", "#ffffcc", "#fed976", "#fd8d3c", "#fc4e2a", "#b10026"],
        source=_NEX_GDDP_CMIP6_SOURCE,
        partial_image_id_templates={
            "historical": "heat/hotdays_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
            "projected": "heat/hotdays_score_1to5_{scenario}_{year1}_{year2}_epsg4326_lon-180_180",
        },
    ),
    HazardEnum.EXTREME_HEAT: HazardLayerOptions(
        scenarios=[
            ScenarioEnum.HISTORICAL,
            ScenarioEnum.SSP126,
            ScenarioEnum.SSP245,
            ScenarioEnum.SSP370,
            ScenarioEnum.SSP585,
        ],
        year_ranges=[
            YearRange(start=2020, end=2039),
            YearRange(start=2040, end=2059),
            YearRange(start=2070, end=2089),
        ],
        historical_year_range=YearRange(start=1985, end=2014),
        palette=["#FFFCEB", "#ffffcc", "#fed976", "#fd8d3c", "#fc4e2a", "#b10026"],
        source=_NEX_GDDP_CMIP6_SOURCE,
        partial_image_id_templates={
            "historical": "heat/hotdays_score_1to5_historical_1985_2014_epsg4326_lon-180_180",
            "projected": "heat/hotdays_score_1to5_{scenario}_{year1}_{year2}_epsg4326_lon-180_180",
        },
    ),
}


def get_hazard_config() -> dict[HazardEnum, HazardLayerOptions]:
    return _HAZARD_LAYER_CONFIG


def get_image_id(
    hazard_name: HazardEnum,
    scenario: ScenarioEnum,
    year_range: Optional[YearRange] = None,
) -> str:
    """
    Constructs a hazard string for Earth Engine based on hazard name, scenario, and year range.
    """
    hazard_prefix = f"projects/{settings.GCP_PROJECT_ID}/assets/hazards-v2/"

    config = get_hazard_config().get(hazard_name)
    if not config:
        raise HazardLayerNotFoundException(f"Missing config for hazard: {hazard_name}")

    templates = config.partial_image_id_templates

    if scenario == ScenarioEnum.HISTORICAL:
        template_key = "historical"
    elif scenario in [
        ScenarioEnum.SSP126,
        ScenarioEnum.SSP245,
        ScenarioEnum.SSP370,
        ScenarioEnum.SSP585,
    ]:
        template_key = "projected"
    else:
        raise ValueError(
            f"Invalid scenario: {scenario.value} for hazard: {hazard_name.value}"
        )

    partial_image_id = templates.get(template_key)

    if not partial_image_id:
        raise ValueError(
            f"Invalid template for hazard: {hazard_name.value} and scenario: {scenario.value}"
        )

    format_kwargs = {
        "scenario": scenario.value,
    }

    # WRI Aqueduct V2 flood assets use RCP scenario naming, not SSP.
    if hazard_name in (HazardEnum.COASTAL_FLOODING, HazardEnum.RIVER_FLOODING):
        ssp_to_rcp = {
            ScenarioEnum.SSP245: "rcp4p5",
            ScenarioEnum.SSP585: "rcp8p5",
        }
        if scenario in ssp_to_rcp:
            format_kwargs["scenario"] = ssp_to_rcp[scenario]

    if year_range:
        format_kwargs["year1"] = year_range.start
        format_kwargs["year2"] = year_range.end

    if hazard_name == HazardEnum.WATER_STRESS and template_key == "projected":
        # Water stress projected only supports one year, so remove year2
        format_kwargs.pop("year2", None)

    return hazard_prefix + partial_image_id.format(**format_kwargs)


def get_vis_params(hazard_name: HazardEnum) -> dict:
    """
    Retrieves the visualization parameters for a given hazard.

    Args:
        hazard_name: The name of the hazard for which to retrieve visualization parameters.
    Returns:
        A dictionary containing visualization parameters such as min, max, and palette.
    """
    config = get_hazard_config().get(hazard_name)
    if not config:
        raise ValueError(f"Missing config for hazard: {hazard_name.value}")
    return {"min": 0, "max": 5, "palette": config.palette}
