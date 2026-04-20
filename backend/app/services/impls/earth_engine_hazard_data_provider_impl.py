from typing import Optional

from app.schemas.hazard_layer import (
    HazardLayer,
    ScenarioEnum,
    TileHazardLayerData,
    YearRange,
)
from app.schemas.location import HazardEnum
from app.services.clients.earth_engine_client import EarthEngineClient
from app.services.interfaces.hazard_data_provider_interface import (
    HazardDataProviderInterface,
)
from app.utils.hazard_layer_utils import get_image_id, get_vis_params


class EarthEngineHazardDataProviderImpl(HazardDataProviderInterface):
    """
    Implementation of HazardsInterface for fetching hazard data from Google Earth Engine.
    """

    def __init__(self, earth_engine_client: EarthEngineClient, **kwargs):
        """
        Initializes the EarthEngineHazardDataProviderImpl with an Earth Engine client.

        Args:
            earth_engine_client: An instance of EarthEngineClient to interact with Earth Engine.
            **kwargs: Arbitrary keyword arguments.
        """
        super().__init__()
        self.earth_engine_client = earth_engine_client.get_client()

    def fetch_hazard_layer(
        self,
        hazard_type: HazardEnum,
        scenario: ScenarioEnum,
        year_range: Optional[YearRange] = None,
    ) -> HazardLayer:
        """
        Fetches a specific hazard layer from Earth Engine.

        Args:
            hazard_type: The type of hazard layer to fetch.
            scenario: The scenario for which to fetch the layer.
            year_range: An optional tuple representing the year range.

        Returns:
            A HazardLayer object containing the name and tile data for the requested layer.
        """
        image_id = get_image_id(hazard_type, scenario, year_range)
        vis_params = get_vis_params(hazard_type)

        image = self.earth_engine_client.Image(image_id)
        map_id = image.getMapId(vis_params)

        return HazardLayer(
            name=hazard_type,
            hazard_data=TileHazardLayerData(tile_url=map_id["tile_fetcher"].url_format),
        )
