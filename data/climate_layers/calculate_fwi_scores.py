#!/usr/bin/env python3
"""
Fire Weather Index (FWI) Score Calculator

Calculates climate risk scores (1-5) for Fire Weather Index variables
from NASA GDDP-FWI yearly metrics data.

Data must be downloaded from: https://data.nas.nasa.gov/gddpimpact/FWI/
"""

import argparse
from pathlib import Path
from typing import List, Tuple, Optional, Dict
import numpy as np
import xarray as xr
import rioxarray


# -------------------------
# CONSTANTS
# -------------------------
DEFAULT_BASELINE_START = 1985
DEFAULT_BASELINE_END = 2015

# Common FWI variables
FWI_VARIABLES = [
    "FWI_N45",      # FWI exceeding 45 (very high fire danger)
    "FWI_N30",      # FWI exceeding 30 (high fire danger)
    "FWI_N20",      # FWI exceeding 20 (moderate fire danger)
    "FWI_mean",     # Mean FWI
    "FWI_max",      # Maximum FWI
]


# -------------------------
# HELPER FUNCTIONS
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


def compute_thresholds(
    baseline_da: xr.DataArray,
    ignore_zero: bool = True
) -> Tuple[float, float, float, float]:
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

    if len(vals) == 0:
        raise ValueError("No valid values found in baseline data")

    p20, p40, p60, p80 = np.percentile(vals, [20, 40, 60, 80])
    return (p20, p40, p60, p80)


# -------------------------
# DATA LOADING
# -------------------------
def load_period_mean(
    data_dir: Path,
    scenario: str,
    start_year: int,
    end_year: int,
    var_name: str,
    pattern_template: str = "MME50_{scenario}_fwi_metrics_yearly_*.nc",
) -> xr.DataArray:
    """
    Load yearly FWI NetCDFs for a period and return the mean.

    Args:
        data_dir: Directory containing FWI data files
        scenario: Climate scenario (e.g., 'historical', 'ssp126')
        start_year: Start year (inclusive)
        end_year: End year (inclusive)
        var_name: Variable name to extract
        pattern_template: Filename pattern with {scenario} placeholder

    Returns:
        DataArray with mean over the period
    """
    pattern = pattern_template.format(scenario=scenario)
    all_files = sorted(data_dir.glob(pattern))

    files = []
    years = []

    for p in all_files:
        # Expected format: ..._yearly_YYYY.nc
        year_str = p.stem.split("_")[-1]
        try:
            year = int(year_str)
        except ValueError:
            continue

        if start_year <= year <= end_year:
            files.append(p)
            years.append(year)

    if not files:
        raise RuntimeError(
            f"No files found in {data_dir} for {scenario} years {start_year}-{end_year}\n"
            f"Pattern: {pattern}\n"
            f"Please ensure data is downloaded from https://data.nas.nasa.gov/gddpimpact/FWI/"
        )

    print(f"  Loading {len(files)} files for {scenario} {start_year}-{end_year}")

    da_list = []
    for p, year in zip(files, years):
        with xr.open_dataset(p) as ds_i:
            if var_name not in ds_i:
                available_vars = list(ds_i.data_vars)
                raise KeyError(
                    f"{var_name} not found in {p.name}\n"
                    f"Available variables: {available_vars}"
                )

            da_i = ds_i[var_name].load()

            # If there's a single time step, drop it
            if "time" in da_i.dims and da_i.sizes["time"] == 1:
                da_i = da_i.isel(time=0, drop=True)

            # Add year dimension for concatenation
            da_i = da_i.expand_dims(year=[year])
            da_list.append(da_i)

    da_all_years = xr.concat(da_list, dim="year")
    da_mean = da_all_years.mean(dim="year", skipna=True)
    da_mean.name = var_name

    return da_mean


# -------------------------
# MAIN PROCESSING
# -------------------------
def process_fwi_data(
    var: str,
    scenarios: List[str],
    periods: Dict[str, Tuple[int, int]],
    data_dir: Path,
    out_dir: Path,
    baseline_scenario: str = "historical",
    baseline_start: int = DEFAULT_BASELINE_START,
    baseline_end: int = DEFAULT_BASELINE_END,
    pattern_template: str = "MME50_{scenario}_fwi_metrics_yearly_*.nc",
    ignore_zero: bool = True,
):
    """
    Main processing function for FWI data.

    Args:
        var: FWI variable name
        scenarios: List of scenarios to process
        periods: Dict mapping period labels to (start_year, end_year) tuples
        data_dir: Directory containing FWI data files
        out_dir: Output directory for GeoTIFF files
        baseline_scenario: Scenario for baseline (default: 'historical')
        baseline_start: Baseline start year
        baseline_end: Baseline end year
        pattern_template: Filename pattern
        ignore_zero: If True, ignore zero values in scoring
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    print("="*60)
    print("Fire Weather Index (FWI) Score Calculator")
    print("="*60)
    print(f"Variable: {var}")
    print(f"Data directory: {data_dir}")
    print(f"Output directory: {out_dir}")
    print()

    # ============================================================
    # 1. BASELINE: Compute thresholds from historical data
    # ============================================================
    print("="*60)
    print(f"BASELINE: {baseline_scenario} ({baseline_start}-{baseline_end})")
    print("="*60)

    fwi_mean_baseline = load_period_mean(
        data_dir, baseline_scenario, baseline_start, baseline_end,
        var, pattern_template
    )

    thresholds = compute_thresholds(fwi_mean_baseline, ignore_zero=ignore_zero)
    p20, p40, p60, p80 = thresholds

    print(f"\n{var} thresholds from {baseline_start}-{baseline_end} ({baseline_scenario}):")
    print(f"  20th percentile: {p20:.4f}")
    print(f"  40th percentile: {p40:.4f}")
    print(f"  60th percentile: {p60:.4f}")
    print(f"  80th percentile: {p80:.4f}")

    # Score and save baseline
    fwi_score_baseline = classify_1to5(fwi_mean_baseline, thresholds, ignore_zero=ignore_zero)
    fwi_score_baseline_shifted = shift_lon_360_to_180(fwi_score_baseline)

    baseline_output = out_dir / f"{var}_score_1to5_{baseline_start}_{baseline_end}_epsg4326_lon-180_180_{baseline_scenario}.tif"
    save_geotiff(fwi_score_baseline_shifted, baseline_output)

    # ============================================================
    # 2. FUTURE PERIODS FOR EACH SCENARIO
    # ============================================================
    for scenario in scenarios:
        print(f"\n{'='*60}")
        print(f"SCENARIO: {scenario}")
        print("="*60)

        for period_label, (start_year, end_year) in periods.items():
            print(f"\nPeriod: {period_label} ({start_year}-{end_year})")

            try:
                fwi_mean = load_period_mean(
                    data_dir, scenario, start_year, end_year,
                    var, pattern_template
                )

                fwi_score = classify_1to5(fwi_mean, thresholds, ignore_zero=ignore_zero)
                fwi_score_shifted = shift_lon_360_to_180(fwi_score)

                out_path = out_dir / f"{var}_score_1to5_{start_year}_{end_year}_epsg4326_lon-180_180_{scenario}.tif"
                save_geotiff(fwi_score_shifted, out_path)

            except RuntimeError as e:
                print(f"  [ERROR] {e}")
                continue

    print("\n" + "="*60)
    print("Processing complete!")
    print("="*60)


# -------------------------
# CLI
# -------------------------
def parse_periods(period_strings: List[str]) -> Dict[str, Tuple[int, int]]:
    """
    Parse period strings into dict of (start, end) tuples.

    Format: "label:start-end" e.g., "2020_2039:2020-2039"
    """
    periods = {}
    for p_str in period_strings:
        try:
            label, years = p_str.split(":")
            start, end = years.split("-")
            periods[label] = (int(start), int(end))
        except Exception as e:
            raise ValueError(
                f"Invalid period format '{p_str}'. "
                f"Use 'label:start-end' e.g., '2020_2039:2020-2039'"
            ) from e
    return periods


def main():
    parser = argparse.ArgumentParser(
        description="Calculate FWI risk scores from NASA GDDP-FWI data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process FWI_N45 for multiple scenarios
  %(prog)s --var FWI_N45 \\
    --scenarios ssp126 ssp245 ssp585 \\
    --periods "2020_2039:2020-2039" "2070_2089:2070-2089" \\
    --data-dir ./downloads \\
    --output ./fwi_scores

  # Process FWI_mean with custom baseline period
  %(prog)s --var FWI_mean \\
    --scenarios ssp370 ssp585 \\
    --periods "2040_2059:2040-2059" \\
    --baseline-start 1990 \\
    --baseline-end 2010 \\
    --data-dir ./downloads \\
    --output ./fwi_scores

Data Source:
  Download FWI data from: https://data.nas.nasa.gov/gddpimpact/FWI/
  Expected filename format: MME50_{scenario}_fwi_metrics_yearly_{year}.nc
        """
    )

    parser.add_argument(
        "--var",
        required=True,
        help=f"FWI variable to process. Common variables: {', '.join(FWI_VARIABLES)}"
    )

    parser.add_argument(
        "--scenarios",
        nargs="+",
        default=["ssp126", "ssp245", "ssp370", "ssp585"],
        help="Future climate scenarios to process (default: all SSPs)"
    )

    parser.add_argument(
        "--periods",
        nargs="+",
        required=True,
        help="Time periods in format 'label:start-end' e.g., '2020_2039:2020-2039'"
    )

    parser.add_argument(
        "--data-dir",
        type=Path,
        required=True,
        help="Directory containing downloaded FWI NetCDF files"
    )

    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output directory for GeoTIFF score files"
    )

    parser.add_argument(
        "--baseline-scenario",
        default="historical",
        help="Baseline scenario for threshold computation (default: historical)"
    )

    parser.add_argument(
        "--baseline-start",
        type=int,
        default=DEFAULT_BASELINE_START,
        help=f"Baseline start year (default: {DEFAULT_BASELINE_START})"
    )

    parser.add_argument(
        "--baseline-end",
        type=int,
        default=DEFAULT_BASELINE_END,
        help=f"Baseline end year (default: {DEFAULT_BASELINE_END})"
    )

    parser.add_argument(
        "--pattern",
        default="MME50_{scenario}_fwi_metrics_yearly_*.nc",
        help="Filename pattern with {scenario} placeholder (default: MME50_{scenario}_fwi_metrics_yearly_*.nc)"
    )

    parser.add_argument(
        "--include-zero",
        action="store_true",
        help="Include zero values in scoring (default: ignore zeros)"
    )

    args = parser.parse_args()

    # Parse periods
    try:
        periods = parse_periods(args.periods)
    except ValueError as e:
        parser.error(str(e))

    # Validate data directory
    if not args.data_dir.exists():
        parser.error(
            f"Data directory does not exist: {args.data_dir}\n"
            f"Please download FWI data from: https://data.nas.nasa.gov/gddpimpact/FWI/"
        )

    # Process
    process_fwi_data(
        var=args.var,
        scenarios=args.scenarios,
        periods=periods,
        data_dir=args.data_dir,
        out_dir=args.output,
        baseline_scenario=args.baseline_scenario,
        baseline_start=args.baseline_start,
        baseline_end=args.baseline_end,
        pattern_template=args.pattern,
        ignore_zero=not args.include_zero,
    )


if __name__ == "__main__":
    main()
