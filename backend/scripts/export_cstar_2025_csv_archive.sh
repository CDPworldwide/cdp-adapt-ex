#!/usr/bin/env bash

# Export the seven CSTAR 2025 application tables from processed BigQuery tables
# into a CSV archive suitable for docs/data.md.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-project-bb4fd058-24e7-4ccb-b06}"
SOURCE_DATASET="${SOURCE_DATASET:-CSTAR_2025_processed_v2}"
TMP_DATASET="${TMP_DATASET:-$SOURCE_DATASET}"
BUCKET="${BUCKET:-}"
GCS_PREFIX="${GCS_PREFIX:-public-csv-archive/cstar_2025_$(date -u +%Y%m%dT%H%M%SZ)}"
OUTPUT_DIR="${OUTPUT_DIR:-/tmp/cstar_2025_csv_archive}"
ARCHIVE_PATH="${ARCHIVE_PATH:-${OUTPUT_DIR%/}/cstar_2025_public_csv_archive.zip}"
PUBLIC_ONLY="${PUBLIC_ONLY:-true}"
DOWNLOAD="${DOWNLOAD:-true}"
KEEP_TEMP="${KEEP_TEMP:-false}"

SRC_DIM_CENTRAL="${SRC_DIM_CENTRAL:-dim_cdp_geo_and_ecoregion_TEST}"
SRC_FACT_HAZARD="${SRC_FACT_HAZARD:-fact_hazard_final_TEST}"
SRC_FACT_GOAL="${SRC_FACT_GOAL:-fact_goal_final}"
SRC_FACT_ACTION="${SRC_FACT_ACTION:-fact_action_final_TEST}"
SRC_FACT_FUNDING_GAP="${SRC_FACT_FUNDING_GAP:-fact_funding_gap_final_TEST}"
SRC_PEER_SOLUTIONS="${SRC_PEER_SOLUTIONS:-peer_solutions_final_TEST}"
SRC_SOLUTION_EXAMPLES="${SRC_SOLUTION_EXAMPLES:-solution_examples_TEST}"

usage() {
  cat >&2 <<EOF
Usage: BUCKET=gs://your-export-bucket $0

Exports the seven CSTAR 2025 CSV files from BigQuery to GCS, then downloads and
zips them locally by default.

Required:
  BUCKET=gs://...                 GCS bucket or bucket/prefix for bq extract

Optional env vars:
  PROJECT_ID                      Default: ${PROJECT_ID}
  SOURCE_DATASET                  Default: ${SOURCE_DATASET}
  TMP_DATASET                     Default: SOURCE_DATASET
  GCS_PREFIX                      Default: public-csv-archive/cstar_2025_<timestamp>
  OUTPUT_DIR                      Default: ${OUTPUT_DIR}
  ARCHIVE_PATH                    Default: OUTPUT_DIR/cstar_2025_public_csv_archive.zip
  PUBLIC_ONLY=true|false          Default: true. Keep true for public release.
  DOWNLOAD=true|false             Default: true. Set false to leave files in GCS only.
  KEEP_TEMP=true|false            Default: false. Keep temporary BQ export tables.

The default PUBLIC_ONLY=true export excludes Non-Public disclosure rows. It keeps
public disclosures plus GEE-derived/non-discloser rows used by the public app.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$BUCKET" ]]; then
  usage
  exit 2
fi

log() {
  printf '\n[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

run_bq_scalar() {
  bq --quiet --project_id="$PROJECT_ID" query \
    --use_legacy_sql=false --max_rows=1 --format=csv "$1" | tail -n 1 | tr -d '\r'
}

extract_csv() {
  local slug="$1"
  local csv_name="$2"
  local sql="$3"
  local tmp_table="${slug}_public_csv_export"
  local destination="${BUCKET%/}/${GCS_PREFIX%/}/${csv_name}"
  local sharded_destination="${BUCKET%/}/${GCS_PREFIX%/}/${csv_name%.csv}/${csv_name%.csv}_*.csv"
  local count

  count="$(run_bq_scalar "SELECT COUNT(*) AS row_count FROM (${sql})")"
  log "Exporting ${csv_name} (${count} rows) -> ${destination}"

  bq --quiet --project_id="$PROJECT_ID" query \
    --destination_table="${PROJECT_ID}:${TMP_DATASET}.${tmp_table}" \
    --replace \
    --use_legacy_sql=false \
    "$sql" >/dev/null

  gsutil rm -f "$destination" 2>/dev/null || true
  gsutil rm -f "$sharded_destination" 2>/dev/null || true

  if ! bq --quiet extract \
    --project_id="$PROJECT_ID" \
    --destination_format=CSV \
    --field_delimiter=',' \
    --print_header=true \
    "${PROJECT_ID}:${TMP_DATASET}.${tmp_table}" \
    "$destination"; then
    log "${csv_name} is too large for one BigQuery extract object; retrying as shards -> ${sharded_destination}"
    bq --quiet extract \
      --project_id="$PROJECT_ID" \
      --destination_format=CSV \
      --field_delimiter=',' \
      --print_header=true \
      "${PROJECT_ID}:${TMP_DATASET}.${tmp_table}" \
      "$sharded_destination"
  fi

  if [[ "$KEEP_TEMP" != true ]]; then
    bq --quiet rm -f -t "${PROJECT_ID}:${TMP_DATASET}.${tmp_table}"
  fi
}

if [[ "$PUBLIC_ONLY" == true ]]; then
  DIM_WHERE="WHERE public_status IN ('Public', 'GEE-Derived') OR disclosure_status = 'non-disclosed'"
  PUBLIC_DIM_CTE="
WITH public_dim AS (
  SELECT DISTINCT cdp_disclosing_org_number
  FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_DIM_CENTRAL}\`
  WHERE public_status IN ('Public', 'GEE-Derived') OR disclosure_status = 'non-disclosed'
)"
  PUBLIC_FACT_WHERE="WHERE public_status = 'Public'"
  PUBLIC_HAZARD_WHERE="WHERE public_status IN ('Public', 'GEE-Derived')"
else
  DIM_WHERE=""
  PUBLIC_DIM_CTE="
WITH public_dim AS (
  SELECT DISTINCT cdp_disclosing_org_number
  FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_DIM_CENTRAL}\`
)"
  PUBLIC_FACT_WHERE=""
  PUBLIC_HAZARD_WHERE=""
fi

log "Starting CSTAR 2025 CSV archive export"
log "Project=${PROJECT_ID}; dataset=${SOURCE_DATASET}; public_only=${PUBLIC_ONLY}"

extract_csv "dim_central" "CSTAR_2025_Dim_Central.csv" "
SELECT
  disclosure_cycle,
  cdp_requesting_org_number,
  requesting_organization,
  projects,
  cdp_requested_org_number,
  requested_organization,
  cdp_disclosing_org_number,
  disclosing_organization,
  disclosing_org_type,
  cdp_region,
  discloser_country_or_area,
  questionnaire,
  eligible_pathway,
  selected_pathway,
  disclosure_status,
  public_status,
  previous_response_status,
  reporting_language,
  reporting_gov,
  next_high_gov,
  next_low_gov,
  jdx_areasize,
  jdx_natural_pct,
  current_pop,
  cur_pop_year,
  proj_pop,
  proj_pop_year,
  reporting_currency,
  reporting_framework,
  climate_assess_yn,
  adpt_goal_yn,
  action_plan_yn,
  champ_yn,
  gs_gn,
  gdp_pc,
  dev_status,
  income_group,
  fx_rate,
  COALESCE(disclosure_year, 2025) AS disclosing_year,
  ranked_hazards,
  ranked_sectors,
  requesting_auth,
  ided_non_disclosers,
  ST_ASTEXT(geometry) AS geom_wkt,
  ST_ASTEXT(centroid) AS centroid_wkt,
  CAST(has_geometry = 1 AS BOOL) AS has_geometry,
  ecoregion
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_DIM_CENTRAL}\`
${DIM_WHERE}
"

extract_csv "fact_hazard" "CSTAR_2025_Fact_Hazard.csv" "
SELECT
  disclosure_cycle,
  cdp_disclosing_org_number,
  public_status,
  hazard_english,
  population_exposed_english,
  sectors_exposed_english,
  impacts,
  population_range,
  hazard_probability,
  hazard_magnitude,
  intensity_change,
  frequency_change,
  time_frame,
  summary_text,
  hazard_rank,
  disclosing_year
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_FACT_HAZARD}\`
${PUBLIC_HAZARD_WHERE}
"

extract_csv "fact_goal" "CSTAR_2025_Fact_Goal.csv" "
SELECT
  disclosure_cycle,
  cdp_disclosing_org_number,
  disclosing_organization,
  public_status,
  goal_english,
  hazard_addressed_english,
  base_year,
  target_year,
  metric_used_english,
  comment_english,
  disclosing_year,
  goal_index
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_FACT_GOAL}\`
${PUBLIC_FACT_WHERE}
"

extract_csv "fact_action" "CSTAR_2025_Fact_Action.csv" "
SELECT
  disclosure_cycle,
  cdp_disclosing_org_number,
  disclosing_organization,
  public_status,
  action_english,
  hazard_addressed_english,
  action_description_english,
  sectors_applied_english,
  resilience_enhanced_english,
  cobenefit_realized_english,
  timeframe_english,
  funding_source_english,
  action_status_english,
  total_cost_usd,
  action_index,
  disclosing_year,
  row_order
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_FACT_ACTION}\`
${PUBLIC_FACT_WHERE}
"

extract_csv "fact_funding_gap" "CSTAR_2025_Fact_Funding_Gap.csv" "
SELECT
  disclosure_cycle,
  cdp_disclosing_org_number,
  disclosing_organization,
  public_status,
  project_area_english,
  project_title_english,
  development_stage,
  finance_status_english,
  finance_model_english,
  project_descirption_english,
  total_cost_usd,
  total_needed_usd,
  disclosing_year,
  project_area_index,
  project_index
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_FACT_FUNDING_GAP}\`
${PUBLIC_FACT_WHERE}
"

extract_csv "peer_solutions" "CSTAR_2025_Peer_Solutions.csv" "
${PUBLIC_DIM_CTE}
SELECT
  ps.disclosing_year,
  ps.target_org_id,
  ps.hazard_filter,
  ps.solution_category,
  ps.solution,
  ps.action_rank,
  ps.action_english,
  ps.action_index,
  ps.hazard_addressed,
  ps.peer_org_cnt,
  ps.action_count,
  ps.pct_peers,
  ps.has_local_action
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_PEER_SOLUTIONS}\` ps
JOIN public_dim d
  ON d.cdp_disclosing_org_number = ps.target_org_id
WHERE ps.action_index IS NOT NULL
"

extract_csv "solution_examples" "CSTAR_2025_Solution_Examples.csv" "
${PUBLIC_DIM_CTE}
SELECT
  se.disclosing_year,
  se.target_org_id,
  se.hazard_filter,
  se.action_english,
  se.peer_org_id,
  se.peer_org_name,
  se.action_index,
  se.hazard_addressed_english,
  se.action_description_english,
  se.sectors_applied_english,
  se.resilience_enhanced_english,
  se.cobenefit_realized_english,
  se.timeframe_english,
  se.funding_source_english,
  se.action_status_english,
  se.total_cost_usd,
  se.completeness_score,
  se.row_order
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_SOLUTION_EXAMPLES}\` se
JOIN public_dim target_dim
  ON target_dim.cdp_disclosing_org_number = se.target_org_id
JOIN public_dim peer_dim
  ON peer_dim.cdp_disclosing_org_number = se.peer_org_id
"

if [[ "$DOWNLOAD" == true ]]; then
  log "Downloading CSV files to ${OUTPUT_DIR}"
  mkdir -p "$OUTPUT_DIR"
  gsutil -m cp "${BUCKET%/}/${GCS_PREFIX%/}/*.csv" "$OUTPUT_DIR/"
  gsutil -m cp -r "${BUCKET%/}/${GCS_PREFIX%/}/*/" "$OUTPUT_DIR/" 2>/dev/null || true
  (
    cd "$OUTPUT_DIR"
    rm -f "$ARCHIVE_PATH"
    zip -qr "$(basename "$ARCHIVE_PATH")" CSTAR_2025_*.csv CSTAR_2025_*/
  )
  log "Archive ready: ${ARCHIVE_PATH}"
else
  log "CSV files are in ${BUCKET%/}/${GCS_PREFIX%/}"
fi
