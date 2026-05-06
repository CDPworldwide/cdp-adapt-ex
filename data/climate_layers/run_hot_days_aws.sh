#!/usr/bin/env bash
# AWS Instance B — hot_days only (tasmax > 35°C).
# Single-threaded; runs on its own instance in parallel with run_rx5day_aws.sh on Instance C.
#
# Usage on the EC2 box (m5.large is sufficient — 8 GB RAM, 2 vCPU):
#   nohup bash run_hot_days_aws.sh > hot_days.log 2>&1 &
#   disown
#   tail -f hot_days.log
# Retrieve outputs from your laptop after it finishes:
#   scp -r -i <key> ec2-user@<host>:~/cdp-adapt-ex/data/climate_layers/output/hot_days ./

set +e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PYTHONUNBUFFERED=1
PY="$SCRIPT_DIR/.venv/bin/python"

echo "=== [$(date '+%H:%M:%S')] hot_days: historical baseline ==="
"$PY" calculate_pr_temp_scores.py \
  --var tasmax --threshold 35 \
  --scenarios historical \
  --periods "1985_2014:1985-2015" \
  --output ./output/hot_days

echo "=== [$(date '+%H:%M:%S')] hot_days: futures + scoring ==="
"$PY" calculate_pr_temp_scores.py \
  --var tasmax --threshold 35 \
  --scenarios ssp126 ssp245 ssp370 ssp585 \
  --periods "2020_2039:2020-2040" "2040_2059:2040-2060" "2070_2089:2070-2090" \
  --baseline ./output/hot_days/tasmax_median_mean_hot_days_gt35C_historical_1985_2014.nc \
  --compute-scores \
  --output ./output/hot_days

echo "=== [$(date '+%H:%M:%S')] hot_days done ==="
