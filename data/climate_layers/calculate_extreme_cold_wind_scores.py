#!/usr/bin/env python3
"""
Extreme Cold & Wind Score Calculator

Calculates climate risk scores (1-5) for extreme cold (tasmin), frost days,
and extreme wind (sfcWind) variables based on NEX-GDDP-CMIP6
climate model data.

Counts days per year exceeding configurable thresholds and optionally converts
the ensemble medians into percentile-based 1-5 risk scores.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Callable
import numpy as np
import xarray as xr
import rioxarray
import requests


# -------------------------
# CONSTANTS
# -------------------------
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

DEFAULT_METRIC_VARS = {
    "extreme_cold": "tasmin",
    "extreme_wind": "sfcWind",
    "frost_days": "tasmin",
}


def format_threshold_label(value: float) -> str:
    """Return a filesystem-friendly label for threshold values."""
    return format(value, "g").replace(".", "p")


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


def _process_year_days(
    year: int,
    var: str,
    model: str,
    scenario: str,
    variant: str,
    lat_slice: slice,
    lon_slice: slice,
    variant_cache: VariantCache,
    predicate: Callable[[xr.DataArray], xr.DataArray],
) -> Optional[xr.DataArray]:
    """Load a single year and return counted days based on predicate."""
    url = variant_cache.http_url(var, model, scenario, variant, year)
    print(f"    {model} {scenario} {year}")

    if not variant_cache.head_exists(url):
        print("      [WARN] file missing, skipping year")
        return None

    try:
        ds = xr.open_dataset(url, engine="h5netcdf")
    except Exception as e:
        print(f"      [WARN] open_dataset failed: {e}")
        return None

    try:
        if var not in ds:
            print(f"      [WARN] {var} not in dataset, skipping year")
            return None

        da = ds[var]
        if lat_slice is not None or lon_slice is not None:
            da = da.sel(lat=lat_slice, lon=lon_slice)

        mask = predicate(da)
        return mask.sum(dim="time").astype("float32")
    finally:
        ds.close()


def _aggregate_years(
    years: range,
    worker: Callable[[int], Optional[xr.DataArray]],
    max_workers: int,
) -> Tuple[Optional[xr.DataArray], int]:
    """Run yearly workers (optionally in parallel) and accumulate results."""
    sum_da = None
    count = 0

    if max_workers <= 1 or len(years) <= 1:
        for year in years:
            res = worker(year)
            if res is None:
                continue
            sum_da = res if sum_da is None else sum_da + res
            count += 1
    else:
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = {pool.submit(worker, year): year for year in years}
            for future in as_completed(futures):
                res = future.result()
                if res is None:
                    continue
                sum_da = res if sum_da is None else sum_da + res
                count += 1

    return sum_da, count


# -------------------------
# DATA PROCESSING
# -------------------------
def calculate_cold_days(
    var: str,
    model: str,
    scenario: str,
    variant: str,
    years: range,
    threshold_k: float,
    lat_slice: slice,
    lon_slice: slice,
    variant_cache: VariantCache,
    max_workers: int,
) -> Optional[xr.DataArray]:
    """Calculate mean extreme cold days (< threshold) per year."""
    predicate = lambda da: da < threshold_k
    worker = lambda year: _process_year_days(
        year, var, model, scenario, variant,
        lat_slice, lon_slice, variant_cache, predicate,
    )

    sum_cold, n_years = _aggregate_years(years, worker, max_workers)

    if n_years == 0 or sum_cold is None:
        print(f"      [WARN] no valid years for {model} {scenario}")
        return None

    mean_cold = (sum_cold / float(n_years)).astype("float32")
    threshold_c = threshold_k - 273.15
    label = format_threshold_label(threshold_c)
    mean_cold.name = f"mean_cold_days_lt_{label}C"
    mean_cold.attrs["units"] = "days"
    return mean_cold


def calculate_windy_days(
    var: str,
    model: str,
    scenario: str,
    variant: str,
    years: range,
    threshold_mps: float,
    lat_slice: slice,
    lon_slice: slice,
    variant_cache: VariantCache,
    max_workers: int,
) -> Optional[xr.DataArray]:
    """Calculate mean days per year above a wind-speed threshold."""
    predicate = lambda da: da > threshold_mps
    worker = lambda year: _process_year_days(
        year, var, model, scenario, variant,
        lat_slice, lon_slice, variant_cache, predicate,
    )

    sum_windy, n_years = _aggregate_years(years, worker, max_workers)

    if n_years == 0 or sum_windy is None:
        print(f"      [WARN] no valid years for {model} {scenario}")
        return None

    mean_windy = (sum_windy / float(n_years)).astype("float32")
    label = format_threshold_label(threshold_mps)
    mean_windy.name = f"mean_windy_days_gt_{label}mps"
    mean_windy.attrs["units"] = "days"
    return mean_windy


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
        .rio.write_nodata(np.nan, encoded=True)
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
        ignore_zero: If True, exclude zeros from the 1-5 classification and
                     assign them score 0 (hazard absent, distinct from NoData)

    Returns:
        DataArray with scores 1-5 (and NaN for no-data pixels). When
        ignore_zero=True, zero-valued inputs receive score 0 instead of NaN.
    """
    p20, p40, p60, p80 = thresholds

    mask = np.isfinite(da)
    if ignore_zero:
        mask &= (da > 0)

    score = xr.full_like(da, np.nan)
    if ignore_zero:
        # Zero hazard → score 0 (NaN == 0 is False, so no-data stays NaN)
        score = xr.where(da == 0, 0, score)
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
    metric: str,
    var: str,
    scenarios: List[str],
    periods: Dict[str, range],
    models: List[str],
    threshold: Optional[float],
    lat_slice: slice,
    lon_slice: slice,
    out_dir: Path,
    baseline_file: Optional[Path] = None,
    compute_scores: bool = False,
    max_workers: int = 1,
):
    """Process a metric (extreme cold or wind) for selected periods."""
    out_dir.mkdir(parents=True, exist_ok=True)
    variant_cache = VariantCache()

    if threshold is None:
        raise ValueError("threshold must be provided (°C for cold, m/s for wind)")

    threshold_label = format_threshold_label(threshold)
    is_cold_metric = metric in ("extreme_cold", "frost_days")
    threshold_k = threshold + 273.15 if is_cold_metric else None

    netcdf_files: List[Path] = []

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

                if metric in ("extreme_cold", "frost_days"):
                    da = calculate_cold_days(
                        var, model, scenario, variant, years,
                        threshold_k, lat_slice, lon_slice, variant_cache,
                        max_workers,
                    )
                elif metric == "extreme_wind":
                    da = calculate_windy_days(
                        var, model, scenario, variant, years,
                        threshold, lat_slice, lon_slice, variant_cache,
                        max_workers,
                    )
                else:
                    raise ValueError(f"Unsupported metric: {metric}")

                if da is None:
                    continue

                da = da.assign_coords(model=model).expand_dims("model")
                model_means.append(da)

            if not model_means:
                print(f"    [WARN] no models produced results for {scenario} {period_label}")
                continue

            ensemble = xr.concat(model_means, dim="model")
            median_result = ensemble.median(dim="model", skipna=True)

            if metric == "extreme_cold":
                median_result.name = f"median_mean_cold_days_lt_{threshold_label}C"
                fname = f"{var}_median_mean_cold_days_lt{threshold_label}C_{scenario}_{period_label}.nc"
            elif metric == "frost_days":
                median_result.name = f"median_mean_frost_days_lt_{threshold_label}C"
                fname = f"{var}_median_mean_frost_days_lt{threshold_label}C_{scenario}_{period_label}.nc"
            else:
                median_result.name = f"median_mean_windy_days_gt_{threshold_label}mps"
                fname = f"{var}_median_mean_windy_days_gt{threshold_label}mps_{scenario}_{period_label}.nc"

            out_path = out_dir / fname
            print(f"  Saving median for {scenario} {period_label} → {out_path}")
            median_result.to_netcdf(out_path)
            netcdf_files.append(out_path)

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

        print(f"\nUsing baseline → {baseline_file.name}")
        baseline_ds = xr.open_dataset(baseline_file)
        baseline_da = baseline_ds[list(baseline_ds.data_vars)[0]]

        thresholds = compute_thresholds(baseline_da, ignore_zero=True)
        p20, p40, p60, p80 = thresholds

        print("\n--- Thresholds (ignoring zero values) ---")
        print(f"20th percentile: {p20:.4f}")
        print(f"40th percentile: {p40:.4f}")
        print(f"60th percentile: {p60:.4f}")
        print(f"80th percentile: {p80:.4f}")

        scores_dir = out_dir / "scores"
        scores_dir.mkdir(exist_ok=True)

        for nc_path in netcdf_files:
            print(f"\nProcessing {nc_path.name}")
            ds = xr.open_dataset(nc_path)
            da = ds[list(ds.data_vars)[0]]

            score = classify_1to5(da, thresholds)
            score_shifted = shift_lon_360_to_180(score)

            parts = nc_path.stem.split("_")
            scenario = parts[-2]
            period = parts[-1]
            tag = f"{scenario}_{period}"

            if metric == "extreme_cold":
                out_tif = scores_dir / f"cold_days_score_1to5_{tag}_epsg4326_lon-180_180.tif"
            elif metric == "frost_days":
                out_tif = scores_dir / f"frost_days_score_1to5_{tag}_epsg4326_lon-180_180.tif"
            else:
                out_tif = scores_dir / f"windy_days_score_1to5_{tag}_epsg4326_lon-180_180.tif"

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
        description="Calculate extreme cold or wind risk scores from NEX-GDDP-CMIP6",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extreme cold: days with tasmin below -15°C
  %(prog)s --metric extreme_cold --threshold -15 \\
    --scenarios historical ssp585 \\
    --periods "1985_2014:1985-2015" "2040_2059:2040-2060" \\
    --output ./extreme_cold

  # Extreme wind: days with sfcWind above 25 m/s
  %(prog)s --metric extreme_wind --var sfcWind --threshold 25 \\
    --scenarios ssp245 ssp585 \\
    --periods "2020_2039:2020-2040" \\
    --output ./extreme_wind

  # With risk scores using a historical baseline
  %(prog)s --metric extreme_cold --threshold -15 \\
    --scenarios ssp585 \\
    --periods "2070_2089:2070-2090" \\
    --baseline ./extreme_cold/tasmin_median_mean_cold_days_lt-15C_historical_1985_2014.nc \\
    --compute-scores \\
    --output ./extreme_cold
        """
    )

    parser.add_argument(
        "--metric",
        required=True,
        choices=["extreme_cold", "frost_days", "extreme_wind"],
        help="Metric to compute"
    )

    parser.add_argument(
        "--var",
        help="Climate variable to process (default: tasmin for cold, sfcWind for wind)"
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
        help="Threshold (°C for cold/frost metrics, m/s for wind). Frost defaults to 0°C if omitted"
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

    parser.add_argument(
        "--max-workers",
        type=int,
        default=1,
        help="Number of concurrent years to download/process (default: 1)"
    )

    args = parser.parse_args()

    # Parse periods
    try:
        periods = parse_periods(args.periods)
    except ValueError as e:
        parser.error(str(e))

    # Use all models if not specified
    models = args.models if args.models else ALL_MODELS

    # Determine variable defaults/validation
    default_var = DEFAULT_METRIC_VARS[args.metric]
    var = args.var if args.var else default_var

    if args.metric in {"extreme_cold", "frost_days"} and var not in {"tasmin", "tas"}:
        parser.error("Cold/frost metrics require tasmin or tas (near-surface temperature) data")
    if args.metric == "extreme_wind" and var not in {"sfcWind", "sfcWindmax"}:
        parser.error("Extreme wind metric requires sfcWind or sfcWindmax data")

    # Determine threshold defaults
    threshold = args.threshold
    if args.metric == "frost_days" and threshold is None:
        threshold = 0.0
    elif args.metric != "frost_days" and threshold is None:
        parser.error("--threshold is required for extreme_cold and extreme_wind metrics")

    # Create slices
    lat_slice = slice(args.lat_min, args.lat_max)
    lon_slice = slice(args.lon_min, args.lon_max)

    # Process
    process_climate_data(
        metric=args.metric,
        var=var,
        scenarios=args.scenarios,
        periods=periods,
        models=models,
        threshold=threshold,
        lat_slice=lat_slice,
        lon_slice=lon_slice,
        out_dir=args.output,
        baseline_file=args.baseline,
        compute_scores=args.compute_scores,
        max_workers=max(1, args.max_workers),
    )

    print("\n" + "="*60)
    print("Processing complete!")
    print("="*60)


if __name__ == "__main__":
    main()
