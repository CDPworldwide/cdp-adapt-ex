# Hazard Data Service

The hazard data service integrates with **Google Earth Engine (GEE)** to provide geospatial hazard layers (e.g., heatwaves, flooding) for map visualization.

## Features

### 1. Layer Configuration
The `/api/v1/hazards/layer-config` endpoint returns the metadata for all supported hazard layers, including:
- Available scenarios (e.g., historical, SSP126, SSP245, SSP370, SSP585)
- Year ranges for projected data
- Color scales (palettes) and legends
- Data source information (e.g., NASA NEX-GDDP-CMIP6, WRI Aqueduct)

### 2. Geospatial Data Retrieval
The `/api/v1/hazards/{hazard_type}` endpoint retrieves the specific Earth Engine asset for a hazard. It handles:
- **Scenarios:** Filtering by climate scenario (e.g., Historical, SSP245, SSP585).
- **Time Periods:** Selecting the appropriate year range for projected data.
- **Tiling:** Providing a `tile_url` format for the frontend to render GEE tiles directly.

## EarthEngineClient

The `EarthEngineClient` handles initialization and communication with the Google Earth Engine Python API.

### Authentication
The service initializes the Earth Engine client using the Google Cloud Project ID configured in the environment:
- It uses the default application credentials (ADC) available in the environment.
- The project is set via `PROJECT_ID` (mapped to `settings.GCP_PROJECT_ID`).

## Hazard Data Provider

The `EarthEngineHazardDataProvider` acts as a high-level provider that maps domain-specific hazard types (e.g., `extreme_heat`) to specific Earth Engine Image assets.

## Integration Details

- **Asset Locations:** Hazard assets are stored as Earth Engine Images under `projects/{PROJECT_ID}/assets/hazards/`.
- **Mapping:** Asset IDs are dynamically constructed based on templates defined in `backend/app/utils/hazard_layer_utils.py`.
- **Pre-scored Data:** Most hazard layers are pre-scored on a scale of 1 to 5, allowing for consistent visualization across different hazard types.
- **Visualization:** The `get_vis_params` utility provides the appropriate color palette and min/max values (typically 1-5) for Earth Engine to generate tiles.
