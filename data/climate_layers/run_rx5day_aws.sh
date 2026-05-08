#!/usr/bin/env bash
# AWS Instance C — RX5day only (pr, 5-day rolling max).
# Single-threaded; runs on its own instance in parallel with run_hot_days_aws.sh on Instance B.
#
# Usage on the EC2 box (m5.large is sufficient — 8 GB RAM, 2 vCPU):
#   nohup bash run_rx5day_aws.sh > rx5day.log 2>&1 &
#   disown
#   tail -f rx5day.log
# Retrieve outputs from your laptop after it finishes:
#   scp -r -i <key> ec2-user@<host>:~/cdp-adapt-ex/data/climate_layers/output/rx5day ./

set +e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PYTHONUNBUFFERED=1
PY="$SCRIPT_DIR/.venv/bin/python"

echo "=== [$(date '+%H:%M:%S')] rx5day: historical baseline ==="
"$PY" calculate_pr_temp_scores.py \
  --var pr --rolling-days 5 \
  --scenarios historical \
  --periods "1985_2014:1985-2015" \
  --output ./output/rx5day

echo "=== [$(date '+%H:%M:%S')] rx5day: futures + scoring ==="
"$PY" calculate_pr_temp_scores.py \
  --var pr --rolling-days 5 \
  --scenarios ssp126 ssp245 ssp370 ssp585 \
  --periods "2020_2039:2020-2040" "2040_2059:2040-2060" "2070_2089:2070-2090" \
  --baseline ./output/rx5day/pr_rx5day_median_mean_historical_1985_2014.nc \
  --compute-scores \
  --output ./output/rx5day

echo "=== [$(date '+%H:%M:%S')] rx5day done ==="
