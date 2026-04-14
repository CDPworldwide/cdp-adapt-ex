from unittest.mock import MagicMock, patch

import pytest
from app.schemas.hazard_layer import HazardLayer, ScenarioEnum, TileHazardLayerData
from app.schemas.location_v2 import HazardEnum
from app.services.clients.earth_engine_client import EarthEngineClient
from app.services.impls.earth_engine_hazard_data_provider_impl import (
    EarthEngineHazardDataProviderImpl,
)
from app.shared.exceptions import HazardLayerNotFoundException


@pytest.fixture
def mock_earth_engine_client() -> MagicMock:
    """Fixture for a mocked EarthEngineClient."""
    client = MagicMock(spec=EarthEngineClient)
    client.get_client.return_value = MagicMock()
    return client


@patch("app.services.impls.earth_engine_hazard_data_provider_impl.get_vis_params")
@patch("app.services.impls.earth_engine_hazard_data_provider_impl.get_image_id")
def test_fetchHazardLayer_ValidHazardName_ReturnsHazardLayer(
    mock_get_image_id: MagicMock,
    mock_get_vis_params: MagicMock,
    mock_earth_engine_client: MagicMock,
):
    """Tests that a valid hazard layer is returned for a configured hazard."""
    # Arrange
    hazard_type = HazardEnum.EXTREME_HEAT
    scenario = ScenarioEnum.HISTORICAL
    image_id = "projects/test-project/assets/hazards/heat/hotdays_score_1to5_historical_1985_2014_epsg4326"
    vis_params = {
        "min": 1,
        "max": 5,
        "palette": ["#ffffcc", "#fed976", "#fd8d3c", "#fc4e2a", "#b10026"],
    }
    mock_get_image_id.return_value = image_id
    mock_get_vis_params.return_value = vis_params

    hazard_data_provider_impl = EarthEngineHazardDataProviderImpl(
        earth_engine_client=mock_earth_engine_client
    )
    tile_url = "https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/some-map-id/tiles/{z}/{x}/{y}"

    mock_image = MagicMock()
    mock_earth_engine_client.get_client.return_value.Image.return_value = mock_image

    tile_fetcher_mock = MagicMock()
    tile_fetcher_mock.url_format = tile_url
    mock_image.getMapId.return_value = {"tile_fetcher": tile_fetcher_mock}

    # Act
    result = hazard_data_provider_impl.fetch_hazard_layer(hazard_type, scenario)

    # Assert
    assert isinstance(result, HazardLayer)
    assert result.name == hazard_type
    assert isinstance(result.hazard_data, TileHazardLayerData)
    assert result.hazard_data.tile_url == tile_url

    mock_get_image_id.assert_called_once_with(hazard_type, scenario, None)
    mock_get_vis_params.assert_called_once_with(hazard_type)
    mock_earth_engine_client.get_client.return_value.Image.assert_called_once_with(
        image_id
    )
    mock_image.getMapId.assert_called_once_with(vis_params)


@patch("app.services.impls.earth_engine_hazard_data_provider_impl.get_image_id")
def test_fetchHazardLayer_InvalidHazardLayer_RaisesHazardLayerNotFoundException(
    mock_get_image_id: MagicMock,
    mock_earth_engine_client: MagicMock,
):
    """Tests that HazardLayerNotFoundException is raised for an unconfigured hazard."""
    # Arrange
    hazard_type = HazardEnum.RIVER_FLOODING
    scenario = ScenarioEnum.HISTORICAL
    mock_get_image_id.side_effect = HazardLayerNotFoundException(
        f"Missing config for hazard: {hazard_type}"
    )

    hazard_data_provider_impl = EarthEngineHazardDataProviderImpl(
        earth_engine_client=mock_earth_engine_client
    )
    mock_image = MagicMock()
    mock_earth_engine_client.get_client.return_value.Image.return_value = mock_image

    # Act & Assert
    with pytest.raises(HazardLayerNotFoundException):
        hazard_data_provider_impl.fetch_hazard_layer(hazard_type, scenario)

    mock_image.getMapId.assert_not_called()
