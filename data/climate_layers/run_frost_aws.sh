#!/usr/bin/env bash
# AWS Instance A — full frost_days run (historical baseline + futures + scoring).
# Uses --max-workers 4 for parallel year fetches.
#
# Usage on the EC2 box:
#   nohup bash run_frost_aws.sh > frost.log 2>&1 &
#   tail -f frost.log
# Retrieve outputs from your laptop after it finishes:
#   scp -r -i <key> ec2-user@<host>:~/cdp-adapt-ex/data/climate_layers/output/frost_days ./

set +e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PYTHONUNBUFFERED=1
PY="$SCRIPT_DIR/.venv/bin/python"

echo "=== [$(date '+%H:%M:%S')] frost_days: historical baseline (max-workers=4) ==="
"$PY" calculate_extreme_cold_wind_scores.py \
  --metric frost_days \
  --scenarios historical \
  --periods "1985_2014:1985-2015" \
  --max-workers 4 \
  --output ./output/frost_days

echo "=== [$(date '+%H:%M:%S')] frost_days: futures + scoring (max-workers=4) ==="
"$PY" calculate_extreme_cold_wind_scores.py \
  --metric frost_days \
  --scenarios ssp126 ssp245 ssp370 ssp585 \
  --periods "2020_2039:2020-2040" "2040_2059:2040-2060" "2070_2089:2070-2090" \
  --baseline ./output/frost_days/tasmin_median_mean_frost_days_lt0C_historical_1985_2014.nc \
  --compute-scores \
  --max-workers 4 \
  --output ./output/frost_days

echo "=== [$(date '+%H:%M:%S')] frost_days done ==="
