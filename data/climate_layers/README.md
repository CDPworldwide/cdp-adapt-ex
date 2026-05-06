# Climate Layer Scoring Tools

This directory contains tools for calculating climate risk scores (1-5) from various climate datasets, following CDP methodology.

## Available Scripts

1. **`calculate_pr_temp_scores.py`** - Temperature and Precipitation scoring from NEX-GDDP-CMIP6
2. **`calculate_fwi_scores.py`** - Fire Weather Index scoring from NASA GDDP-FWI
3. **`calculate_extreme_cold_wind_scores.py`** - Extreme cold & wind scoring from NEX-GDDP-CMIP6
4. **`calculate_flood_scores.py`** - Coastal & Riverine flood scoring from WRI Aqueduct via Google Earth Engine

## Installation

### Requirements

The simplest path is `uv sync` from this directory (a self-contained `pyproject.toml` ships next to the scripts):

```bash
cd cdp-adapt-ex/data/climate_layers
uv sync                        # creates .venv with all required deps
.venv/bin/python <script>.py   # run scripts via the venv
```

Or install directly with pip:

```bash
pip install "xarray" "numpy" "requests" "h5netcdf" "h5py>=3.16" "fsspec[http]>=2026.4" "cftime" "bottleneck" "rioxarray"

# Optional: only needed if running calculate_flood_scores.py against GEE
pip install earthengine-api
```

### Dependencies

- `xarray`: NetCDF / labelled-array workhorse
- `numpy`: numerical computation
- `requests`: HEAD requests for variant discovery (climate scripts)
- `h5netcdf` + `h5py`: NetCDF4 read engine
- `fsspec[http]`: lazy HTTP reads of S3-hosted NetCDFs (pulls in `aiohttp`)
- `cftime`: decodes non-standard CMIP6 calendars (`360_day`, `noleap`, …)
- `bottleneck`: memory-efficient rolling-window reductions (used by `pr` rolling sum); without it, peak memory on RX5day single-year processing exceeds 7 GB
- `rioxarray`: GeoTIFF export with explicit NoData tagging
- `earthengine-api`: GEE batch ingest (only `calculate_flood_scores.py`)

### Google Earth Engine Setup (Flood Scores Only)

The flood scoring script requires a Google Earth Engine account and authenticated access:

1. **Sign up** for GEE at https://earthengine.google.com/
2. **Create a GEE project** in the [Google Cloud Console](https://console.cloud.google.com/) with the Earth Engine API enabled
3. **Authenticate** by running:
   ```bash
   earthengine authenticate
   ```
4. **Create asset folders** in your GEE project for export destinations:
   ```
   projects/YOUR_PROJECT_ID/assets/hazards-v2/coastal-flood/
   projects/YOUR_PROJECT_ID/assets/hazards-v2/riverine-flood/
   ```

---

# 1. Climate Scores (Temperature & Precipitation)

## Data Source

**NEX-GDDP-CMIP6** - NASA's downscaled climate projections from CMIP6
- **Resolution**: ~25km (0.25°)
- **Access**: Public S3 bucket (automatic HTTP download)
- **Documentation**: https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6

## Usage

### Basic Syntax

```bash
python calculate_pr_temp_scores.py --var VARIABLE --scenarios SCENARIO [SCENARIO...] \
  --periods "LABEL:START-END" ["LABEL:START-END"...] --output OUTPUT_DIR \
  [--threshold TEMP] [--rolling-days DAYS] [--baseline BASELINE.nc] [--compute-scores]
```

### Temperature Example (Hot Days)

Calculate hot days above 35°C for multiple scenarios and periods:

```bash
python calculate_pr_temp_scores.py \
  --var tasmax \
  --threshold 35 \
  --scenarios ssp126 ssp245 ssp585 \
  --periods "2020_2039:2020-2040" "2040_2059:2040-2060" "2070_2089:2070-2090" \
  --output ./hot_days_output
```

### Precipitation Example (RX5day)

Calculate 5-day maximum precipitation:

```bash
python calculate_pr_temp_scores.py \
  --var pr \
  --rolling-days 5 \
  --scenarios historical ssp245 ssp585 \
  --periods "1985_2014:1985-2015" "2020_2039:2020-2040" \
  --output ./rx5day_output
```

### Computing Risk Scores

#### Step 1: Create Historical Baseline

```bash
# For temperature
python calculate_pr_temp_scores.py \
  --var tasmax \
  --threshold 35 \
  --scenarios historical \
  --periods "1985_2014:1985-2015" \
  --output ./hot_days_output

# For precipitation
python calculate_pr_temp_scores.py \
  --var pr \
  --rolling-days 5 \
  --scenarios historical \
  --periods "1985_2014:1985-2015" \
  --output ./rx5day_output
```

#### Step 2: Calculate Future Scenarios with Scores

```bash
# For temperature
python calculate_pr_temp_scores.py \
  --var tasmax \
  --threshold 35 \
  --scenarios ssp126 ssp245 ssp585 \
  --periods "2070_2089:2070-2090" \
  --baseline ./hot_days_output/tasmax_median_mean_hot_days_gt35C_historical_1985_2014.nc \
  --compute-scores \
  --output ./hot_days_output

# For precipitation
python calculate_pr_temp_scores.py \
  --var pr \
  --rolling-days 5 \
  --scenarios ssp245 ssp585 \
  --periods "2070_2089:2070-2090" \
  --baseline ./rx5day_output/pr_rx5day_median_mean_historical_1985_2014.nc \
  --compute-scores \
  --output ./rx5day_output
```

## Arguments

### Required Arguments

- `--var`: Climate variable to process
  - Choices: `tasmax` (max temperature), `tasmin` (min temperature), `tas` (mean temperature), `pr` (precipitation)

- `--periods`: Time periods to analyze in format `"label:start-end"`
  - Example: `"2020_2039:2020-2040"` means years 2020-2039 with label "2020_2039"
  - Multiple periods can be specified

- `--output`: Output directory for results

### Variable-Specific Arguments

For **temperature variables** (tasmax, tasmin, tas):
- `--threshold`: Temperature threshold in Celsius (e.g., `35` for 35°C)

For **precipitation** (pr):
- `--rolling-days`: Rolling window size in days (typically `5` for RX5day)

### Optional Arguments

- `--scenarios`: Climate scenarios to process (default: `ssp126`)
  - Choices: `historical`, `ssp126`, `ssp245`, `ssp370`, `ssp585`
  - Can specify multiple scenarios

- `--models`: Specific climate models to use (default: all 35 models)
  - Example: `--models ACCESS-CM2 CanESM5`

- `--lat-min`, `--lat-max`: Latitude bounds (default: -60 to 90)

- `--lon-min`, `--lon-max`: Longitude bounds (default: 0 to 360)

- `--baseline`: Path to baseline NetCDF file for score computation

- `--compute-scores`: Flag to compute 1-5 risk scores (requires `--baseline`)

---

# 2. Fire Weather Index (FWI) Scores

## Data Source

**NASA GDDP-FWI** - Fire Weather Index projections based on CMIP6 models
- **Resolution**: ~25km (0.25°)
- **Download Required**: https://data.nas.nasa.gov/gddpimpact/FWI/
- **File Format**: `MME50_{scenario}_fwi_metrics_yearly_{year}.nc`

## Data Download

Before using the FWI script, you must download data from NASA:

1. Visit https://data.nas.nasa.gov/gddpimpact/FWI/
2. Download the required scenarios:
   - `MME50_historical_fwi_metrics_yearly_*.nc` (for baseline)
   - `MME50_ssp126_fwi_metrics_yearly_*.nc`
   - `MME50_ssp245_fwi_metrics_yearly_*.nc`
   - `MME50_ssp370_fwi_metrics_yearly_*.nc`
   - `MME50_ssp585_fwi_metrics_yearly_*.nc`
3. Place files in a directory (e.g., `./fwi_downloads/`)

## Usage

### Basic Syntax

```bash
python calculate_fwi_scores.py --var VARIABLE --scenarios SCENARIO [SCENARIO...] \
  --periods "LABEL:START-END" ["LABEL:START-END"...] \
  --data-dir DATA_DIR --output OUTPUT_DIR
```

### Example: FWI_N45 (Very High Fire Danger)

Process FWI days exceeding 45 (very high fire danger):

```bash
python calculate_fwi_scores.py \
  --var FWI_N45 \
  --scenarios ssp126 ssp245 ssp585 \
  --periods "2020_2039:2020-2039" "2070_2089:2070-2089" \
  --data-dir ./fwi_downloads \
  --output ./fwi_scores
```

### Example: FWI_mean (Average Fire Weather Index)

```bash
python calculate_fwi_scores.py \
  --var FWI_mean \
  --scenarios ssp370 ssp585 \
  --periods "2040_2059:2040-2059" \
  --data-dir ./fwi_downloads \
  --output ./fwi_scores
```

### Custom Baseline Period

```bash
python calculate_fwi_scores.py \
  --var FWI_N45 \
  --scenarios ssp245 ssp585 \
  --periods "2070_2089:2070-2089" \
  --baseline-start 1990 \
  --baseline-end 2010 \
  --data-dir ./fwi_downloads \
  --output ./fwi_scores
```

## Arguments

### Required Arguments

- `--var`: FWI variable to process
  - Common variables: `FWI_N45`, `FWI_N30`, `FWI_N20`, `FWI_mean`, `FWI_max`

- `--periods`: Time periods in format `"label:start-end"`
  - Example: `"2020_2039:2020-2039"` means years 2020-2039
  - Note: End year is inclusive (different from climate scores script)

- `--data-dir`: Directory containing downloaded FWI NetCDF files

- `--output`: Output directory for GeoTIFF score files

### Optional Arguments

- `--scenarios`: Future climate scenarios (default: all SSPs)
  - Choices: `ssp126`, `ssp245`, `ssp370`, `ssp585`

- `--baseline-scenario`: Scenario for baseline (default: `historical`)

- `--baseline-start`: Baseline start year (default: `1985`)

- `--baseline-end`: Baseline end year (default: `2015`)

- `--pattern`: Filename pattern (default: `MME50_{scenario}_fwi_metrics_yearly_*.nc`)

- `--include-zero`: Include zero values in scoring (default: ignore zeros)

## FWI Variable

We score `FWI_N45` — annual count of days with Fire Weather Index > 45 (very high fire
danger). Pass via `--var FWI_N45` (or omit `--var` since this is the default).


# 3. Extreme Cold & Wind Scores

`calculate_extreme_cold_wind_scores.py` extends the NEX-GDDP-CMIP6 workflow to
count days per year that exceed extreme cold (tasmin below a temperature
threshold) or extreme wind (sfcWind / sfcWindmax above a speed threshold).
It shares the same ensemble-median and percentile scoring approach as the
temperature/precipitation script.

## Usage

### Basic Syntax

```bash
python calculate_extreme_cold_wind_scores.py --metric METRIC --threshold VALUE \
  --scenarios SCENARIO [SCENARIO...] \
  --periods "LABEL:START-END" [...] \
  --output OUTPUT_DIR [--var VARIABLE] [--baseline BASELINE.nc] [--compute-scores]
```

`METRIC` is either `extreme_cold` (counts days with tasmin below the threshold)
or `extreme_wind` (counts days with sfcWind/sfcWindmax above the threshold).

### Example: Extreme Cold Baseline (tasmin < -15°C)

```bash
python calculate_extreme_cold_wind_scores.py \
  --metric extreme_cold \
  --threshold -15 \
  --scenarios historical \
  --periods "1985_2014:1985-2015" \
  --output ./extreme_cold
```

### Parallel download example (4 concurrent years)

```bash
python calculate_extreme_cold_wind_scores.py \
  --metric frost_days \
  --scenarios ssp370 \
  --periods "2040_2059:2040-2060" \
  --max-workers 4 \
  --output ./frost_days_speedup
```


### Example: Frost Days (ETCCDI FD, tasmin < 0°C)

```bash
python calculate_extreme_cold_wind_scores.py \
  --metric frost_days \
  --scenarios historical ssp585 \
  --periods "1985_2014:1985-2015" "2040_2059:2040-2060" \
  --output ./frost_days
```

### Example: Extreme Wind Events (> 25 m/s)

```bash
python calculate_extreme_cold_wind_scores.py \
  --metric extreme_wind \
  --var sfcWindmax \
  --threshold 25 \
  --scenarios ssp245 ssp585 \
  --periods "2020_2039:2020-2040" \
  --output ./extreme_wind
```

### Compute Risk Scores (Requires Baseline)

```bash
python calculate_extreme_cold_wind_scores.py \
  --metric extreme_cold \
  --threshold -15 \
  --scenarios ssp585 \
  --periods "2070_2089:2070-2090" \
  --baseline ./extreme_cold/tasmin_median_mean_cold_days_lt-15C_historical_1985_2014.nc \
  --compute-scores \
  --output ./extreme_cold
```

- `--metric`: `extreme_cold`, `frost_days` (defaults to tasmin < 0°C if no threshold is provided), or `extreme_wind`
- `--var`: Optional override for the model variable (tasmin/tas for cold, sfcWind/sfcWindmax for wind)
- `--threshold`: Temperature (°C) or wind speed (m/s) threshold used to count extreme days
- `--max-workers`: Number of concurrent year downloads (set >1 for parallel HTTP fetches)
- `--scenarios`, `--periods`, `--models`, `--lat-min/max`, `--lon-min/max`, `--baseline`, `--compute-scores`:
  Same semantics as `calculate_pr_temp_scores.py`

Outputs include NetCDF ensemble medians plus GeoTIFF scores saved in
`scores/cold_days_score_*.tif`, `scores/frost_days_score_*.tif`, or
`scores/windy_days_score_*.tif` depending on the metric.

---

# 4. Flood Scores (Coastal & Riverine)

## Data Source

**WRI Aqueduct Flood Hazard Maps V2** - Global flood inundation depth maps
- **Access**: Google Earth Engine (`WRI/Aqueduct_Flood_Hazard_Maps/V2`)
- **Flood Types**: Coastal (`inuncoast`) and Riverine (`inunriver`)
- **Scenarios**: `historical`, `rcp4p5`, `rcp8p5`
- **Return Period**: 100-year (`rp100`) — only `rp100` is exported; the rest are skipped
- **Documentation**: https://www.wri.org/aqueduct

## Prerequisites

- A Google Earth Engine account with an active cloud project
- Authenticated access (run `earthengine authenticate`)
- Asset folders created in your GEE project:
  ```
  projects/<your-project>/assets/hazards-v2/coastal-flood/
  projects/<your-project>/assets/hazards-v2/riverine-flood/
  ```

## Usage

```bash
export GEE_PROJECT_ID="your-gee-project-id"
python calculate_flood_scores.py
```

The script reads `GEE_PROJECT_ID` from the environment and will fail with a clear error if it is not set.

## Horizon years

Only one set of years is exported per `(floodtype, scenario)`:

| Floodtype | Scenario | Years exported |
|-----------|----------|----------------|
| `inuncoast` | `historical` | 2010 (real present-day baseline) |
| `inuncoast` | `rcp4p5` / `rcp8p5` | 2030, 2050, 2080 |
| `inunriver` | `historical` | 1980 (WATCH baseline reanalysis — only year WRI publishes for riverine) |
| `inunriver` | `rcp4p5` / `rcp8p5` | 2030, 2050, 2080 |

WRI also publishes coastal `historical` images at 2030/2050/2080 (baseline projected
forward without climate-change forcing) but those horizons are excluded — the RCP
scenarios already cover them under climate-change forcing.

## Variant collapse

WRI publishes multiple images per `(floodtype, scenario, year, returnperiod)`. The
script collapses them deterministically:

- **Coastal (`inuncoast`)**: WRI publishes up to 3 SLR percentiles
  (`projection ∈ {5, 50, 95}`) × 2 subsidence flags (`subsidence ∈ {nosub, wtsub}`).
  We always pick `projection=95` (high-end / 95th-percentile SLR) and
  `subsidence='wtsub'`. Historical only ships at projection=95 anyway, so using
  the same percentile across historical + rcp keeps the baseline thresholds
  comparable to the future projections rather than mixing a high-end baseline
  against a median future. The 5/50 percentiles and `nosub` variants are useful
  for sensitivity analysis but aren't exported as the canonical layer.
- **Riverine projected**: 5 GCM members (`NorESM1-M`, `GFDL-ESM2M`, `HadGEM2-ES`,
  `IPSL-CM5A-LR`, `MIROC-ESM-CHEM`). We compute the **ensemble median** across
  members via `toBands().reduce(ee.Reducer.median())` rather than
  `ImageCollection.median()`; the latter strips the source projection and lets
  EE fall back to a default grid that fails the polar-edge transform during
  export, while `toBands` preserves the WRI native grid (origin -180, 90).
- **Riverine historical**: single `WATCH` reanalysis image — no aggregation needed.

## Methodology

For each `(floodtype, scenario, year)` after variant collapse:

1. **Mask zeros** — remove pixels with no inundation depth
2. **Trim outliers** — compute 2nd and 98th percentiles, restrict to that range
3. **Quintile classification** — compute 20th/40th/60th/80th percentile thresholds on the trimmed range
4. **Score 0-5** — `0` for no-flood pixels, `1-5` for flooded pixels by quintile, NoData for not-assessed pixels
5. **Export** — submit as a GEE batch export task to your project assets

Exports land at:
```
projects/<GEE_PROJECT_ID>/assets/hazards-v2/coastal-flood/coastal-flood_{scenario}_{year}_rp100
projects/<GEE_PROJECT_ID>/assets/hazards-v2/riverine-flood/riverine-flood_{scenario}_{year}_rp100
```

## Differences from Other Scripts

| Aspect | Flood Scores | Other Scripts |
|--------|-------------|---------------|
| Data access | Google Earth Engine API | HTTP/S3 download or local files |
| Processing | Server-side (GEE) | Client-side (xarray/numpy) |
| Output | GEE Assets | Local GeoTIFF files |
| Scoring basis | Per-image quintiles | Historical baseline percentiles |
| Scenarios | RCP (4.5, 8.5) | SSP (126, 245, 370, 585) |

---

# Common Information

## Risk Score Categories

All scripts use the same 0-5 risk scoring system. Thresholds are quintiles of the
non-zero values in the historical baseline; the four resulting cut-points are then
applied to all future-scenario layers so scores are comparable across scenarios and
periods.

| Score | Category | Meaning |
|-------|----------|---------|
| 0     | No hazard | Input value is exactly 0
| 1     | Very Low | 0 < input ≤ 20th percentile of non-zero baseline |
| 2     | Low      | 20th < input ≤ 40th percentile |
| 3     | Medium   | 40th < input ≤ 60th percentile |
| 4     | High     | 60th < input ≤ 80th percentile |
| 5     | Very High| input > 80th percentile |
| NoData | not assessed | Input was NaN — no source data for that pixel |

The 0-vs-NoData distinction matters: a pixel with score `0` is genuinely "this hazard
does not occur here", whereas NoData means we have no information to say either way.
GeoTIFF outputs explicitly tag NaN as the nodata value (`rio.write_nodata(np.nan,
encoded=True)`) so downstream tools render the two cases differently.

## Climate Scenarios

- **historical**: Historical climate (1950-2014 or 1985-2015)
- **ssp126**: Low emissions (Paris Agreement 1.5°C target)
- **ssp245**: Medium emissions (intermediate pathway)
- **ssp370**: Medium-high emissions
- **ssp585**: High emissions (worst case)

## Common Time Periods

- **Historical Baseline**: `"1985_2014:1985-2015"` (climate scores) or `"1985_2015:1985-2015"` (FWI)
- **Near-term**: `"2020_2039:2020-2040"` or `"2020_2039:2020-2039"`
- **Mid-century**: `"2040_2059:2040-2060"` or `"2040_2059:2040-2059"`
- **End-of-century**: `"2070_2089:2070-2090"` or `"2070_2089:2070-2089"`

**Note**: The climate scores script uses end year + 1 (e.g., 2040 for 2020-2039), while FWI script uses inclusive end year (e.g., 2039 for 2020-2039).

## Output Files

### GeoTIFF Files

GeoTIFF outputs are float32 with:
- **Projection**: EPSG:4326 (WGS84)
- **Longitude Range**: -180 to 180
- **Values**: 0-5 score with explicit `nodata=NaN` tag

**Climate score outputs (frost / hot-days / RX5day):**
```
{metric}_score_1to5_{scenario}_{period}_epsg4326_lon-180_180.tif
```
Examples: `frost_days_score_1to5_ssp126_2020_2039_epsg4326_lon-180_180.tif`,
`hotdays_score_1to5_historical_1985_2014_epsg4326_lon-180_180.tif`.

**FWI output:**
```
{VAR}_score_1to5_{start_year}_{end_year}_epsg4326_lon-180_180_{scenario}.tif
```
Example: `FWI_N45_score_1to5_2020_2039_epsg4326_lon-180_180_ssp245.tif`.

## Methodology

### Processing Steps

1. **Load historical baseline**: read NetCDFs for the baseline period (typically 1985-2014)
2. **Compute thresholds**: 20th / 40th / 60th / 80th percentile of the non-zero baseline
3. **Load future scenarios**: NetCDFs for each `(scenario × period)` combination
4. **Average**: ensemble median across CMIP6 models for that period
5. **Classify**: assign 0/1-5 per pixel using the baseline thresholds
6. **Export**: write GeoTIFF with NaN nodata tagging

## Troubleshooting

### Climate Scores Script

**Missing Data:**
- Normal to see `[WARN] file missing` - not all model/scenario combinations exist
- Script automatically skips missing files and uses available models

**Variant Discovery Failures:**
- Check internet connection
- Verify variable name spelling
- Some models may not have data for all scenarios

### FWI Script

**No Files Found:**
```
RuntimeError: No files found in ./fwi_downloads for historical years 1985-2015
```
**Solution:** Download FWI data from https://data.nas.nasa.gov/gddpimpact/FWI/

**Variable Not Found:**
```
KeyError: FWI_N45 not found in MME50_historical_fwi_metrics_yearly_2000.nc
```
**Solution:** Check available variables in the NetCDF file using `ncdump -h` or open in xarray

### General Issues

**Memory Errors:**
- Process fewer scenarios at once
- Reduce spatial domain with lat/lon bounds (climate scores only)
- Close other applications

**Slow Performance:**
- Climate scores: Network speed affects download time
- FWI: Large file sizes and I/O operations take time
- Consider processing periods separately

## Complete Example Workflows

### Workflow 1: Temperature Risk Assessment

```bash
# Step 1: Create baseline
python calculate_pr_temp_scores.py \
  --var tasmax \
  --threshold 35 \
  --scenarios historical \
  --periods "1985_2014:1985-2015" \
  --output ./heat_risk

# Step 2: Generate future projections with scores
python calculate_pr_temp_scores.py \
  --var tasmax \
  --threshold 35 \
  --scenarios ssp126 ssp245 ssp585 \
  --periods "2020_2039:2020-2040" "2040_2059:2040-2060" "2070_2089:2070-2090" \
  --baseline ./heat_risk/tasmax_median_mean_hot_days_gt35C_historical_1985_2014.nc \
  --compute-scores \
  --output ./heat_risk
```

### Workflow 2: Fire Weather Index Risk Assessment

```bash
# Download FWI data (specifically the multi-model median (MME) files) first from https://data.nas.nasa.gov/gddpimpact/FWI/

# Process FWI scores (baseline computed automatically)
python calculate_fwi_scores.py \
  --var FWI_N45 \
  --scenarios ssp126 ssp245 ssp370 ssp585 \
  --periods "2020_2039:2020-2039" "2040_2059:2040-2059" "2070_2089:2070-2089" \
  --data-dir ./fwi_downloads \
  --output ./fwi_risk
```

### Workflow 3: Precipitation Extremes

```bash
# Step 1: Create baseline
python calculate_pr_temp_scores.py \
  --var pr \
  --rolling-days 5 \
  --scenarios historical \
  --periods "1985_2014:1985-2015" \
  --output ./precip_risk

# Step 2: Future scenarios
python calculate_pr_temp_scores.py \
  --var pr \
  --rolling-days 5 \
  --scenarios ssp245 ssp585 \
  --periods "2070_2089:2070-2090" \
  --baseline ./precip_risk/pr_rx5day_median_mean_historical_1985_2014.nc \
  --compute-scores \
  --output ./precip_risk
```

## Support & References

### Documentation

- **NEX-GDDP-CMIP6**: https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6
- **NASA GDDP-FWI**: https://data.nas.nasa.gov/gddpimpact/FWI/
- **IPCC AR6 Scenarios**: https://www.ipcc.ch/report/ar6/wg1/
- **CDP Climate Methodology**: https://www.cdp.net/

### Getting Help

For issues or questions:
1. Check this README for usage examples
2. Verify data files are downloaded and in the correct location
3. Check script output for specific error messages
4. Review the script code comments for implementation details
