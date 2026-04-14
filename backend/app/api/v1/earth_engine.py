"""API endpoints for Earth Engine."""

from typing import Optional

from app.api.v1.deps import get_earth_engine_hazard_data_provider
from app.schemas.hazard_layer import (
    HazardLayer,
    HazardLayerOptions,
    ScenarioEnum,
    YearRange,
)
from app.schemas.location_v2 import HazardEnum
from app.services.interfaces.hazard_data_provider_interface import (
    HazardDataProviderInterface,
)
from app.shared.exceptions import HazardLayerNotFoundException
from app.utils.hazard_layer_utils import get_hazard_config
from fastapi import APIRouter, Depends, HTTPException, Query

router = APIRouter()


@router.get("/layer-config", response_model=dict[HazardEnum, HazardLayerOptions])
def get_hazard_layer_config():
    """
    Retrieve the configuration for all hazard layers.

    Returns:
        A dictionary containing the configuration for each hazard layer.
    """
    return get_hazard_config()


@router.get("/hazard/{hazard_type}", response_model=HazardLayer)
def get_ee_hazard_layer(
    hazard_type: HazardEnum,
    scenario: ScenarioEnum,
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    ee_hazard_data_provider: HazardDataProviderInterface = Depends(
        get_earth_engine_hazard_data_provider
    ),
):
    """
    Retrieve Earth Engine hazard layer to render on a map.

    Args:
        hazard_type: The type of hazard to retrieve.
        scenario: The scenario for the hazard layer.
        start_year: An optional start year for the hazard layer.
        end_year: An optional end year for the hazard layer.
        ee_hazard_data_provider: Dependency-injected hazard data provider.

    Returns:
        The requested HazardLayer instance.
    """
    try:
        year_range = None
        if start_year and end_year:
            year_range = YearRange(start=start_year, end=end_year)
        elif start_year:
            year_range = YearRange(start=start_year, end=start_year)

        return ee_hazard_data_provider.fetch_hazard_layer(
            hazard_type, scenario, year_range
        )
    except HazardLayerNotFoundException as hlnfe:
        raise HTTPException(status_code=404, detail=str(hlnfe)) from hlnfe
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
