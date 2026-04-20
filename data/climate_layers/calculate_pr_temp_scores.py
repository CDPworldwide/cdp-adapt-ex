#!/usr/bin/env python3
"""
Climate Risk Score Calculator

Calculates climate risk scores (1-5) for temperature and precipitation variables
based on NEX-GDDP-CMIP6 climate model data.

Based on CDP methodology for climate layer scoring.
"""

import argparse
from pathlib import Path
from typing import List, Tuple, Optional, Dict
import numpy as np
import xarray as xr
import rioxarray
import requests


# -------------------------
# CONSTANTS
# -------------------------
SEC_PER_DAY = 86400.0
HTTP_BASE = "https://nex-gddp-cmip6.s3.us-west-2.amazonaws.com/NEX-GDDP-CMIP6"

ALL_MODELS = [
    "ACCESS-CM2", "ACCESS-ESM1-5", "BCC-CSM2-MR", "CESM2", "CESM2-WACCM",
    "CMCC-CM2-SR5", "CMCC-ESM2", "CNRM-CM6-1", "CNRM-ESM2-1", "CanESM5",
    "EC-Earth3", "EC-Earth3-Veg-LR", "FGOALS-g3", "GFDL-CM4", "GFDL-ESM4",
    "GISS-E2-1-G", "HadGEM3-GC31-LL", "HadGEM3-GC31-MM", "IITM-ESM",
    "INM-CM4-8", "INM-CM5-0", "IPSL-CM6A-LR", "KACE-1-0-G", "KIOST-ESM",
    "MIROC-ES2L", "MIROC6", "MPI-ESM1-2-HR", "MPI-ESM1-2-LR", "MRI-ESM2-0",
    "NESM3", "NorESM2-LM", "NorESM2-MM", "TaiESM1", "UKESM1-0-LL",
]

CANDIDATE_VARIANTS = [
    f"r{r}i1p{p}f{f}"
    for r in range(1, 6)  # r1..r5
    for p in (1, 2)       # p1..p2
    for f in range(1, 4)  # f1..f3
]


# -------------------------
# VARIANT DISCOVERY
# -------------------------
class VariantCache:
    """Cache for discovered model variants."""
    def __init__(self):
        self._cache: Dict[str, str] = {}

    def http_url(self, var: str, model: str, scenario: str, variant: str, year: int) -> str:
        """Construct HTTP URL for a data file."""
        fname = f"{var}_day_{model}_{scenario}_{variant}_gn_{year}.nc"
        return f"{HTTP_BASE}/{model}/{scenario}/{variant}/{var}/{fname}"

    def head_exists(self, url: str, timeout: float = 5.0) -> bool:
        """Check if URL exists via HEAD request."""
        try:
            r = requests.head(url, timeout=timeout)
            return r.status_code == 200
        except Exception:
            return False

    def discover_variant(self, var: str, model: str, test_scenario: str = "historical",
                        test_year: int = 2000) -> Optional[str]:
        """Discover a working variant for a model."""
        print(f"  Discovering variant for {model}...")
        for v in CANDIDATE_VARIANTS:
            url = self.http_url(var, model, test_scenario, v, test_year)
            if self.head_exists(url):
                print(f"  ✓ Found variant {v} for {model}")
                return v
        print(f"  [WARN] No variant found for {model}")
        return None

    def get_variant(self, var: str, model: str, fixed_map: Optional[Dict[str, str]] = None) -> Optional[str]:
        """Get variant for model (from cache or by discovery)."""
        if fixed_map and model in fixed_map:
            return fixed_map[model]
        if model in self._cache:
            return self._cache[model]
        v = self.discover_variant(var, model)
        if v:
            self._cache[model] = v
        return v


# -------------------------
# DATA PROCESSING
# -------------------------
def calculate_hot_days(
    var: str,
    model: str,
    scenario: str,
    variant: str,
    years: range,
    threshold_k: float,
    lat_slice: slice,
    lon_slice: slice,
    variant_cache: VariantCache,
) -> Optional[xr.DataArray]:
    """
    Calculate mean hot days per year for temperature data.

    Args:
        var: Variable name (e.g., 'tasmax')
        model: Model name
        scenario: Scenario name (e.g., 'ssp585')
        variant: Variant string (e.g., 'r1i1p1f1')
        years: Range of years to process
        threshold_k: Temperature threshold in Kelvin
        lat_slice: Latitude slice
        lon_slice: Longitude slice
        variant_cache: VariantCache instance

    Returns:
        DataArray with mean hot days per year, or None if no valid data
    """
    sum_hot = None
    n_years = 0

    for year in years:
        url = variant_cache.http_url(var, model, scenario, variant, year)
        print(f"    {model} {scenario} {year}")

        if not variant_cache.head_exists(url):
            print("      [WARN] file missing, skipping year")
            continue

        try:
            ds = xr.open_dataset(url, engine="h5netcdf")
        except Exception as e:
            print(f"      [WARN] open_dataset failed: {e}")
            continue

        try:
            if var not in ds:
                print(f"      [WARN] {var} not in dataset, skipping year")
                continue

            da = ds[var]
            if lat_slice is not None or lon_slice is not None:
                da = da.sel(lat=lat_slice, lon=lon_slice)

            hot = da > threshold_k
            hot_days = hot.sum(dim="time").astype("float32")

            if sum_hot is None:
                sum_hot = hot_days
            else:
                sum_hot = sum_hot + hot_days
            n_years += 1
        finally:
            ds.close()

    if n_years == 0 or sum_hot is None:
        print(f"      [WARN] no valid years for {model} {scenario}")
        return None

    mean_hot = (sum_hot / float(n_years)).astype("float32")
    mean_hot.name = f"mean_hot_days_gt_{int(threshold_k - 273.15)}C"
    return mean_hot


def calculate_rx5day(
    var: str,
    model: str,
    scenario: str,
    variant: str,
    years: range,
    rolling_days: int,
    lat_slice: slice,
    lon_slice: slice,
    variant_cache: VariantCache,
) -> Optional[xr.DataArray]:
    """
    Calculate mean RX5day (max 5-day precipitation) for precipitation data.

    Args:
        var: Variable name (e.g., 'pr')
        model: Model name
        scenario: Scenario name
        variant: Variant string
        years: Range of years to process
        rolling_days: Number of days for rolling window (typically 5)
        lat_slice: Latitude slice
        lon_slice: Longitude slice
        variant_cache: VariantCache instance

    Returns:
        DataArray with mean RX5day values, or None if no valid data
    """
    sum_rx5day = None
    n_years = 0

    for year in years:
        url = variant_cache.http_url(var, model, scenario, variant, year)
        print(f"    {model} {scenario} {year}")

        if not variant_cache.head_exists(url):
            print("      [WARN] file missing, skipping year")
            continue

        try:
            ds = xr.open_dataset(url, engine="h5netcdf")
        except Exception as e:
            print(f"      [WARN] open_dataset failed: {e}")
            continue

        try:
            if var not in ds:
                print(f"      [WARN] {var} not in dataset, skipping year")
                continue

            da = ds[var].sel(lat=lat_slice, lon=lon_slice)

            # Convert kg m-2 s-1 → mm/day
            pr_mm_day = da * SEC_PER_DAY

            # Calculate rolling sum
            pr_rolling = pr_mm_day.rolling(time=rolling_days).sum()

            # RX5day = annual max
            rx5day = pr_rolling.max(dim="time").astype("float32")

            if sum_rx5day is None:
                sum_rx5day = rx5day
            else:
                sum_rx5day = sum_rx5day + rx5day
            n_years += 1
        finally:
            ds.close()

    if n_years == 0 or sum_rx5day is None:
        print(f"      [WARN] no valid years for {model} {scenario}")
        return None

    mean_rx5day = (sum_rx5day / n_years).astype("float32")
    mean_rx5day.name = f"mean_rx{rolling_days}day"
    mean_rx5day.attrs["units"] = "mm"
    return mean_rx5day


# -------------------------
# SCORING FUNCTIONS
# -------------------------
def infer_lat_lon_names(da: xr.DataArray) -> Tuple[str, str]:
    """Infer latitude and longitude dimension names."""
    dims = da.dims

    # Latitude
    if "lat" in dims:
        lat = "lat"
    elif "latitude" in dims:
        lat = "latitude"
    elif "y" in dims:
        lat = "y"
    else:
        raise ValueError(f"No latitude dim in {dims}")

    # Longitude
    if "lon" in dims:
        lon = "lon"
    elif "longitude" in dims:
        lon = "longitude"
    elif "x" in dims:
        lon = "x"
    else:
        raise ValueError(f"No longitude dim in {dims}")

    return lat, lon


def shift_lon_360_to_180(da: xr.DataArray) -> xr.DataArray:
    """Shift longitude coordinates from 0-360 to -180-180."""
    lat_name, lon_name = infer_lat_lon_names(da)
    lon = da[lon_name]
    lon_new = ((lon + 180) % 360) - 180
    da = da.assign_coords({lon_name: lon_new})
    da = da.sortby(lon_name)
    return da


def save_geotiff(da: xr.DataArray, out_path: Path):
    """Save DataArray as GeoTIFF."""
    lat_name, lon_name = infer_lat_lon_names(da)
    da_rio = (
        da
        .rio.write_crs("EPSG:4326", inplace=False)
        .rio.set_spatial_dims(x_dim=lon_name, y_dim=lat_name, inplace=False)
    )
    da_rio.rio.to_raster(out_path)
    print(f"  Saved → {out_path}")


def classify_1to5(
    da: xr.DataArray,
    thresholds: Tuple[float, float, float, float],
    ignore_zero: bool = True,
) -> xr.DataArray:
    """
    Classify data into 1-5 risk scores based on percentile thresholds.

    Args:
        da: Input DataArray
        thresholds: Tuple of (p20, p40, p60, p80) threshold values
        ignore_zero: If True, ignore zero values when creating mask

    Returns:
        DataArray with scores 1-5 (and NaN for invalid/masked values)
    """
    p20, p40, p60, p80 = thresholds

    mask = np.isfinite(da)
    if ignore_zero:
        mask &= (da > 0)

    score = xr.full_like(da, np.nan)
    score = xr.where(mask & (da <= p20), 1, score)
    score = xr.where(mask & (da > p20) & (da <= p40), 2, score)
    score = xr.where(mask & (da > p40) & (da <= p60), 3, score)
    score = xr.where(mask & (da > p60) & (da <= p80), 4, score)
    score = xr.where(mask & (da > p80), 5, score)

    score.name = da.name + "_score_1to5"
    return score


def compute_thresholds(baseline_da: xr.DataArray, ignore_zero: bool = True) -> Tuple[float, float, float, float]:
    """
    Compute percentile thresholds from baseline data.

    Args:
        baseline_da: Baseline DataArray
        ignore_zero: If True, ignore zero values

    Returns:
        Tuple of (p20, p40, p60, p80) threshold values
    """
    vals = baseline_da.where(np.isfinite(baseline_da))
    if ignore_zero:
        vals = vals.where(vals > 0)

    vals = vals.values.flatten()
    vals = vals[~np.isnan(vals)]

    p20, p40, p60, p80 = np.percentile(vals, [20, 40, 60, 80])
    return (p20, p40, p60, p80)


# -------------------------
# MAIN PROCESSING
# -------------------------
def process_climate_data(
    var: str,
    scenarios: List[str],
    periods: Dict[str, range],
    models: List[str],
    threshold_c: Optional[float],
    rolling_days: Optional[int],
    lat_slice: slice,
    lon_slice: slice,
    out_dir: Path,
    baseline_file: Optional[Path] = None,
    compute_scores: bool = False,
):
    """
    Main processing function for climate data.

    Args:
        var: Variable name ('tasmax', 'pr', etc.)
        scenarios: List of scenarios to process
        periods: Dict mapping period labels to year ranges
        models: List of model names
        threshold_c: Temperature threshold in Celsius (for tasmax)
        rolling_days: Number of days for rolling window (for pr)
        lat_slice: Latitude slice
        lon_slice: Longitude slice
        out_dir: Output directory
        baseline_file: Path to baseline file for scoring
        compute_scores: If True, compute 1-5 scores
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    variant_cache = VariantCache()

    # Determine processing type
    is_temperature = var in ["tasmax", "tasmin", "tas"]
    is_precipitation = var == "pr"

    if is_temperature and threshold_c is None:
        raise ValueError("threshold_c must be specified for temperature variables")
    if is_precipitation and rolling_days is None:
        raise ValueError("rolling_days must be specified for precipitation variable")

    threshold_k = threshold_c + 273.15 if is_temperature else None

    # Process each scenario and period
    netcdf_files = []

    for scenario in scenarios:
        print(f"\n{'='*60}")
        print(f"Scenario: {scenario}")
        print(f"{'='*60}")

        for period_label, years in periods.items():
            print(f"\n  Period {period_label}: {years.start}–{years.stop - 1}")

            model_means = []

            for model in models:
                print(f"  Model: {model}")
                variant = variant_cache.get_variant(var, model)
                if variant is None:
                    print(f"    [WARN] skipping {model}: no variant found")
                    continue

                # Calculate metric based on variable type
                if is_temperature:
                    da = calculate_hot_days(
                        var, model, scenario, variant, years,
                        threshold_k, lat_slice, lon_slice, variant_cache
                    )
                elif is_precipitation:
                    da = calculate_rx5day(
                        var, model, scenario, variant, years,
                        rolling_days, lat_slice, lon_slice, variant_cache
                    )
                else:
                    raise ValueError(f"Unsupported variable: {var}")

                if da is None:
                    continue

                # Add model dimension
                da = da.assign_coords(model=model).expand_dims("model")
                model_means.append(da)

            if not model_means:
                print(f"    [WARN] no models produced results for {scenario} {period_label}")
                continue

            # Stack over model and compute median
            ensemble = xr.concat(model_means, dim="model")
            median_result = ensemble.median(dim="model", skipna=True)

            # Set appropriate name
            if is_temperature:
                median_result.name = f"median_mean_hot_days_gt_{int(threshold_c)}C"
                fname = f"{var}_median_mean_hot_days_gt{int(threshold_c)}C_{scenario}_{period_label}.nc"
            elif is_precipitation:
                median_result.name = f"median_mean_rx{rolling_days}day"
                fname = f"{var}_rx{rolling_days}day_median_mean_{scenario}_{period_label}.nc"

            out_path = out_dir / fname
            print(f"  Saving median for {scenario} {period_label} → {out_path}")
            median_result.to_netcdf(out_path)
            netcdf_files.append(out_path)

    # Compute scores if requested
    if compute_scores:
        print("\n" + "="*60)
        print("Computing Risk Scores (1-5)")
        print("="*60)

        if baseline_file is None:
            print("[ERROR] baseline_file must be specified for score computation")
            return

        if not baseline_file.exists():
            print(f"[ERROR] Baseline file not found: {baseline_file}")
            return

        # Load baseline and compute thresholds
        print(f"\nUsing baseline → {baseline_file.name}")
        baseline_ds = xr.open_dataset(baseline_file)
        baseline_da = baseline_ds[list(baseline_ds.data_vars)[0]]  # Get first data variable

        thresholds = compute_thresholds(baseline_da, ignore_zero=True)
        p20, p40, p60, p80 = thresholds

        print("\n--- Thresholds (ignoring zero values) ---")
        print(f"20th percentile: {p20:.4f}")
        print(f"40th percentile: {p40:.4f}")
        print(f"60th percentile: {p60:.4f}")
        print(f"80th percentile: {p80:.4f}")

        # Create scores directory
        scores_dir = out_dir / "scores"
        scores_dir.mkdir(exist_ok=True)

        # Process all NetCDF files
        for nc_path in netcdf_files:
            print(f"\nProcessing {nc_path.name}")
            ds = xr.open_dataset(nc_path)
            da = ds[list(ds.data_vars)[0]]  # Get first data variable

            # Classify into 1-5
            score = classify_1to5(da, thresholds)

            # Shift lon to -180..180
            score_shifted = shift_lon_360_to_180(score)

            # Generate output filename
            stem = nc_path.stem
            if is_temperature:
                # Extract scenario and period from filename
                parts = stem.split("_")
                scenario = parts[-2]
                period = parts[-1]
                tag = f"{scenario}_{period}"
                out_tif = scores_dir / f"hotdays_score_1to5_{tag}_epsg4326_lon-180_180.tif"
            elif is_precipitation:
                # Extract scenario and period from filename
                parts = stem.split("_")
                scenario = parts[-2]
                period = parts[-1]
                tag = f"{scenario}_{period}"
                out_tif = scores_dir / f"pr_rx{rolling_days}day_score_1to5_{tag}_epsg4326_lon-180_180.tif"

            save_geotiff(score_shifted, out_tif)


# -------------------------
# CLI
# -------------------------
def parse_periods(period_strings: List[str]) -> Dict[str, range]:
    """
    Parse period strings into dict of ranges.

    Format: "label:start-end" e.g., "2020_2039:2020-2040"
    """
    periods = {}
    for p_str in period_strings:
        try:
            label, years = p_str.split(":")
            start, end = years.split("-")
            periods[label] = range(int(start), int(end))
        except Exception as e:
            raise ValueError(f"Invalid period format '{p_str}'. Use 'label:start-end' e.g., '2020_2039:2020-2040'") from e
    return periods


def main():
    parser = argparse.ArgumentParser(
        description="Calculate climate risk scores from NEX-GDDP-CMIP6 data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Temperature (hot days above 35°C)
  %(prog)s --var tasmax --threshold 35 \\
    --scenarios ssp126 ssp585 \\
    --periods "2020_2039:2020-2040" "2070_2089:2070-2090" \\
    --output ./hot_days_output

  # Precipitation (RX5day)
  %(prog)s --var pr --rolling-days 5 \\
    --scenarios historical ssp245 \\
    --periods "1985_2014:1985-2015" "2040_2059:2040-2060" \\
    --output ./rx5day_output

  # With scoring (requires baseline)
  %(prog)s --var tasmax --threshold 35 \\
    --scenarios ssp585 \\
    --periods "2070_2089:2070-2090" \\
    --baseline ./hot_days_output/tasmax_median_mean_hot_days_gt35C_historical_1985_2014.nc \\
    --compute-scores \\
    --output ./hot_days_output
        """
    )

    parser.add_argument(
        "--var",
        required=True,
        choices=["tasmax", "tasmin", "tas", "pr"],
        help="Climate variable to process"
    )

    parser.add_argument(
        "--scenarios",
        nargs="+",
        default=["ssp126"],
        choices=["historical", "ssp126", "ssp245", "ssp370", "ssp585"],
        help="Climate scenarios to process (default: ssp126)"
    )

    parser.add_argument(
        "--periods",
        nargs="+",
        required=True,
        help="Time periods in format 'label:start-end' e.g., '2020_2039:2020-2040'"
    )

    parser.add_argument(
        "--models",
        nargs="+",
        default=None,
        help="Models to use (default: all available models)"
    )

    parser.add_argument(
        "--threshold",
        type=float,
        help="Temperature threshold in Celsius (required for temperature variables)"
    )

    parser.add_argument(
        "--rolling-days",
        type=int,
        help="Rolling window size in days (required for precipitation, typically 5)"
    )

    parser.add_argument(
        "--lat-min",
        type=float,
        default=-60,
        help="Minimum latitude (default: -60)"
    )

    parser.add_argument(
        "--lat-max",
        type=float,
        default=90,
        help="Maximum latitude (default: 90)"
    )

    parser.add_argument(
        "--lon-min",
        type=float,
        default=0,
        help="Minimum longitude (default: 0)"
    )

    parser.add_argument(
        "--lon-max",
        type=float,
        default=360,
        help="Maximum longitude (default: 360)"
    )

    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output directory for results"
    )

    parser.add_argument(
        "--baseline",
        type=Path,
        help="Baseline NetCDF file for score computation"
    )

    parser.add_argument(
        "--compute-scores",
        action="store_true",
        help="Compute 1-5 risk scores (requires --baseline)"
    )

    args = parser.parse_args()

    # Parse periods
    try:
        periods = parse_periods(args.periods)
    except ValueError as e:
        parser.error(str(e))

    # Use all models if not specified
    models = args.models if args.models else ALL_MODELS

    # Create slices
    lat_slice = slice(args.lat_min, args.lat_max)
    lon_slice = slice(args.lon_min, args.lon_max)

    # Process
    process_climate_data(
        var=args.var,
        scenarios=args.scenarios,
        periods=periods,
        models=models,
        threshold_c=args.threshold,
        rolling_days=args.rolling_days,
        lat_slice=lat_slice,
        lon_slice=lon_slice,
        out_dir=args.output,
        baseline_file=args.baseline,
        compute_scores=args.compute_scores,
    )

    print("\n" + "="*60)
    print("Processing complete!")
    print("="*60)


if __name__ == "__main__":
    main()
