#!/usr/bin/env bash

# CSTAR 2025 migration: BigQuery -> GCS -> Cloud SQL. Mirrors
# migrate_cstar_2025_from_bigquery.sh to avoid local connection issues.

set -euo pipefail
shopt -s nullglob

PROJECT_ID="${PROJECT_ID:-project-bb4fd058-24e7-4ccb-b06}"
SOURCE_DATASET="${SOURCE_DATASET:-CSTAR_2025_processed_v2}"
CHUNK_ROWS="${CHUNK_ROWS:-50000}"   # unused; kept for arg-parity with original

SRC_DIM_CENTRAL="${SRC_DIM_CENTRAL:-dim_cdp_geo_and_ecoregion_TEST}"
SRC_FACT_HAZARD="${SRC_FACT_HAZARD:-fact_hazard_final_TEST}"
SRC_FACT_GOAL="${SRC_FACT_GOAL:-fact_goal_final}"
SRC_FACT_ACTION="${SRC_FACT_ACTION:-fact_action_final_TEST}"
SRC_FACT_FUNDING_GAP="${SRC_FACT_FUNDING_GAP:-fact_funding_gap_final_TEST}"
SRC_PEER_SOLUTIONS="${SRC_PEER_SOLUTIONS:-peer_solutions_final_TEST}"
SRC_SOLUTION_EXAMPLES="${SRC_SOLUTION_EXAMPLES:-solution_examples_TEST}"

BUCKET="${BUCKET:-gs://jenny-temp-exports}"
TMP_DATASET="${TMP_DATASET:-$SOURCE_DATASET}"

TARGET_ENV="${1:-development}"
PREFLIGHT_ONLY=false
RESUME=false

usage() {
  printf 'Usage: %s [development|production] [--preflight-only|--resume]\n' "$0" >&2
  printf '  --preflight-only  Run preflight checks and exit (no data changes)\n' >&2
  printf '  --resume          Skip BQ exports + Cloud SQL imports; assume staging is already loaded and jump straight to validation + swap.\n' >&2
  printf '                    Useful for recovering from a failure after data has landed in _stage tables.\n' >&2
}

if [[ $# -gt 0 ]]; then
  TARGET_ENV="$1"
  shift
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --preflight-only)
      PREFLIGHT_ONLY=true
      ;;
    --resume)
      RESUME=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
  shift
done

case "$TARGET_ENV" in
  development|dev|test)
    SECRET_PREFIX="development"
    INSTANCE_NAME="cdp-test"
    LOCAL_PORT="${POSTGRES_PORT_OVERRIDE:-55432}"
    ;;
  production|prod)
    if [[ "$PREFLIGHT_ONLY" != true && "${ALLOW_PRODUCTION_MIGRATION:-}" != "yes" ]]; then
      printf 'Refusing to run production migration without ALLOW_PRODUCTION_MIGRATION=yes\n' >&2
      exit 2
    fi
    if [[ "$PREFLIGHT_ONLY" != true && "${CONFIRM_TARGET:-}" != "cdp-prod" ]]; then
      printf 'Refusing to run production migration without CONFIRM_TARGET=cdp-prod\n' >&2
      exit 2
    fi
    SECRET_PREFIX="production"
    INSTANCE_NAME="cdp-prod"
    LOCAL_PORT="${POSTGRES_PORT_OVERRIDE:-55433}"
    ;;
  *)
    usage
    exit 2
    ;;
esac

WORK_DIR="${WORK_DIR:-/tmp/cstar_2025_migration_${TARGET_ENV}}"
CSV_DIR="$WORK_DIR/csv"                                  # kept for arg-parity; unused
GCS_PREFIX="${GCS_PREFIX:-migration/${TARGET_ENV}}"      # actual data location

secret() {
  # SECRET_<name> env var bypasses Secret Manager for local dev.
  local override_var="SECRET_$1"
  if [[ -n "${!override_var:-}" ]]; then
    printf '%s' "${!override_var}"
    return 0
  fi
  gcloud secrets versions access latest \
    --project "$PROJECT_ID" \
    --secret "${SECRET_PREFIX}-$1"
}

DB_NAME="$(secret POSTGRES_DB)"
DB_USER="$(secret POSTGRES_USER)"
DB_PASSWORD="$(secret POSTGRES_PASSWORD)"
DB_HOST="${POSTGRES_HOST_OVERRIDE:-127.0.0.1}"

PSQL_URI="host=${DB_HOST} port=${LOCAL_PORT} dbname=${DB_NAME} user=${DB_USER} sslmode=disable"

log() {
  printf '\n[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

run_psql() {
  PGPASSWORD="$DB_PASSWORD" psql "$PSQL_URI" -v ON_ERROR_STOP=1 -P pager=off "$@"
}

bq_scalar() {
  bq --quiet --project_id="$PROJECT_ID" query \
    --use_legacy_sql=false --max_rows=1 --format=csv "$1" | tail -n 1 | tr -d '\r'
}

# Materializes the SELECT into a temp BQ table then `bq extract`s to GCS,
# letting BigQuery auto-shard the output across files when >1GB.
export_csv() {
  local name="$1"
  local order_by="$2"     # unused
  local sql="$3"
  local chunk_rows="${4:-$CHUNK_ROWS}"  # unused

  local tmp_table="${name}_export"
  local uri_pattern="${BUCKET}/${GCS_PREFIX}/${name}/${name}_*.csv"
  local total_rows
  total_rows="$(bq_scalar "SELECT COUNT(*) AS row_count FROM (${sql})")"

  local expect_var
  expect_var="EXPECT_$(printf '%s' "$name" | tr '[:lower:]' '[:upper:]')_ROWS"
  if [[ -z "${!expect_var:-}" ]]; then
    printf -v "$expect_var" '%s' "$total_rows"
    export "$expect_var"
  fi

  log "Exporting ${name} (${total_rows} rows) -> ${uri_pattern}"

  bq --quiet --project_id="$PROJECT_ID" query \
    --destination_table="${PROJECT_ID}:${TMP_DATASET}.${tmp_table}" \
    --replace \
    --use_legacy_sql=false \
    "$sql" >/dev/null

  # Wipe prior shards so re-runs don't double-import
  gsutil -m rm -f "${BUCKET}/${GCS_PREFIX}/${name}/${name}_*.csv" 2>/dev/null || true

  bq --quiet extract \
    --project_id="$PROJECT_ID" \
    --destination_format=CSV \
    --field_delimiter=',' \
    --print_header=false \
    "${PROJECT_ID}:${TMP_DATASET}.${tmp_table}" \
    "${uri_pattern}"

  bq --quiet rm -f -t "${PROJECT_ID}:${TMP_DATASET}.${tmp_table}"
}

# Streams each GCS shard into Cloud SQL via `gsutil cat | psql \copy`.
copy_csv() {
  local table="$1"
  local columns_raw="$2"
  local local_dir="$3"
  local name
  name="$(basename "$local_dir")"

  local columns
  columns="$(printf '%s' "$columns_raw" | tr -d '[:space:]')"

  local shards
  shards=$(gsutil ls "${BUCKET}/${GCS_PREFIX}/${name}/${name}_*.csv" 2>/dev/null || true)

  if [[ -z "$shards" ]]; then
    printf 'No CSV shards found in %s/%s\n' "${BUCKET}/${GCS_PREFIX}" "$name" >&2
    exit 1
  fi

  local n=0
  while IFS= read -r uri; do
    [[ -z "$uri" ]] && continue
    log "Loading ${uri} into ${table}"
    gcloud sql import csv "$INSTANCE_NAME" "$uri" \
      --project="$PROJECT_ID" \
      --database="$DB_NAME" \
      --table="$table" \
      --columns="$columns" \
      --quiet >/dev/null
    n=$((n + 1))
  done <<< "$shards"

  log "Completed ${n} import(s) into ${table}"
}

check_recent_backup() {
  if [[ "$TARGET_ENV" == production || "$TARGET_ENV" == prod ]]; then
    log "Checking recent successful backup for ${INSTANCE_NAME}"
    gcloud sql backups list \
      --project "$PROJECT_ID" \
      --instance "$INSTANCE_NAME" \
      --limit=1 \
      --sort-by='~startTime' \
      --format='value(status)' | grep -qx 'SUCCESSFUL'
  fi
}

run_cloudsql_preflight() {
  run_psql <<'SQL'
DO $$
DECLARE
  missing_tables text[];
  fk_dependencies text[];
BEGIN
  SELECT array_agg(t)
  INTO missing_tables
  FROM unnest(ARRAY[
    'CSTAR_2025_Dim_Central',
    'CSTAR_2025_Fact_Hazard',
    'CSTAR_2025_Fact_Goal',
    'CSTAR_2025_Fact_Action',
    'CSTAR_2025_Fact_Funding_Gap',
    'CSTAR_2025_Peer_Solutions',
    'CSTAR_2025_Solution_Examples'
  ]) AS expected(t)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = expected.t
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing canonical CSTAR tables: %', missing_tables;
  END IF;

  WITH cstar_tables AS (
    SELECT c.oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (ARRAY[
        'CSTAR_2025_Dim_Central',
        'CSTAR_2025_Fact_Hazard',
        'CSTAR_2025_Fact_Goal',
        'CSTAR_2025_Fact_Action',
        'CSTAR_2025_Fact_Funding_Gap',
        'CSTAR_2025_Peer_Solutions',
        'CSTAR_2025_Solution_Examples'
      ])
  )
  SELECT array_agg(conname ORDER BY conname)
  INTO fk_dependencies
  FROM pg_constraint con
  WHERE con.contype = 'f'
    AND (
      con.conrelid IN (SELECT oid FROM cstar_tables)
      OR con.confrelid IN (SELECT oid FROM cstar_tables)
    );

  IF fk_dependencies IS NOT NULL THEN
    RAISE EXCEPTION 'Foreign key dependencies block safe TRUNCATE without CASCADE: %', fk_dependencies;
  END IF;
END $$;

SELECT
  'postgis_extension' AS check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')
    THEN 'installed'
    ELSE 'missing; full migration will run CREATE EXTENSION IF NOT EXISTS postgis'
  END AS result;

WITH expected_columns(column_name) AS (
  VALUES ('geometry'), ('centroid'), ('geom_wkt'), ('centroid_wkt')
)
SELECT
  'CSTAR_2025_Dim_Central' AS table_name,
  expected_columns.column_name,
  EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'CSTAR_2025_Dim_Central'
      AND c.column_name = expected_columns.column_name
  ) AS exists
FROM expected_columns
ORDER BY column_name;

SELECT 'CSTAR_2025_Dim_Central' AS table_name, COUNT(*)::bigint AS rows FROM "CSTAR_2025_Dim_Central"
UNION ALL SELECT 'CSTAR_2025_Fact_Hazard', COUNT(*)::bigint FROM "CSTAR_2025_Fact_Hazard"
UNION ALL SELECT 'CSTAR_2025_Fact_Goal', COUNT(*)::bigint FROM "CSTAR_2025_Fact_Goal"
UNION ALL SELECT 'CSTAR_2025_Fact_Action', COUNT(*)::bigint FROM "CSTAR_2025_Fact_Action"
UNION ALL SELECT 'CSTAR_2025_Fact_Funding_Gap', COUNT(*)::bigint FROM "CSTAR_2025_Fact_Funding_Gap"
UNION ALL SELECT 'CSTAR_2025_Peer_Solutions', COUNT(*)::bigint FROM "CSTAR_2025_Peer_Solutions"
UNION ALL SELECT 'CSTAR_2025_Solution_Examples', COUNT(*)::bigint FROM "CSTAR_2025_Solution_Examples"
ORDER BY table_name;

SELECT
  COUNT(*) FILTER (WHERE geometry IS NOT NULL) AS dim_rows_with_geometry,
  COUNT(*) FILTER (WHERE geometry IS NULL) AS dim_rows_without_geometry,
  COUNT(*) FILTER (WHERE public_status = 'Public') AS dim_public_rows,
  COUNT(*) FILTER (WHERE disclosure_status = 'non-disclosed') AS dim_non_disclosed_rows
FROM "CSTAR_2025_Dim_Central";

SELECT table_name AS staging_table_leftover
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '\_cstar\_2025\_%\_stage' ESCAPE '\'
ORDER BY table_name;

SELECT table_name AS cstar_view_reference
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition ILIKE '%CSTAR_2025%'
ORDER BY table_name;

SELECT conrelid::regclass::text AS table_name, conname, contype, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
  'public."CSTAR_2025_Dim_Central"'::regclass,
  'public."CSTAR_2025_Fact_Hazard"'::regclass,
  'public."CSTAR_2025_Fact_Goal"'::regclass,
  'public."CSTAR_2025_Fact_Action"'::regclass,
  'public."CSTAR_2025_Fact_Funding_Gap"'::regclass,
  'public."CSTAR_2025_Peer_Solutions"'::regclass,
  'public."CSTAR_2025_Solution_Examples"'::regclass
)
ORDER BY table_name, contype, conname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'CSTAR_2025_Dim_Central'
ORDER BY indexname;
SQL
}

log "Starting CSTAR 2025 migration for ${TARGET_ENV} (${INSTANCE_NAME})"
log "Using local Cloud SQL proxy at ${DB_HOST}:${LOCAL_PORT}; GCS staging ${BUCKET}/${GCS_PREFIX}"

check_recent_backup

log "Running Cloud SQL preflight"
run_cloudsql_preflight

if [[ "$PREFLIGHT_ONLY" == true ]]; then
  log "Preflight complete for ${TARGET_ENV}; no schema or data changes were made"
  exit 0
fi

if [[ "$RESUME" == true ]]; then
  log "Resume mode: skipping BQ export + Cloud SQL import; assuming _stage tables already loaded."
  # Resume skips export_csv, so EXPECT_*_ROWS aren't set; default to -1 (skip
  # count assertion). Structural checks (dup-PK, WKT) still run.
  : "${EXPECT_DIM_CENTRAL_ROWS:=-1}"
  : "${EXPECT_FACT_HAZARD_ROWS:=-1}"
  : "${EXPECT_FACT_GOAL_ROWS:=-1}"
  : "${EXPECT_FACT_ACTION_ROWS:=-1}"
  : "${EXPECT_FACT_FUNDING_GAP_ROWS:=-1}"
  : "${EXPECT_PEER_SOLUTIONS_ROWS:=-1}"
  : "${EXPECT_SOLUTION_EXAMPLES_ROWS:=-1}"
else
log "Applying full-run Cloud SQL setup"
run_psql <<'SQL'
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE "CSTAR_2025_Dim_Central"
ADD COLUMN IF NOT EXISTS centroid GEOMETRY(Geometry, 4326),
ADD COLUMN IF NOT EXISTS geom_wkt TEXT,
ADD COLUMN IF NOT EXISTS centroid_wkt TEXT;
SQL

log "Exporting target-shaped BigQuery CSVs"
export_csv "dim_central" "cdp_disclosing_org_number, disclosing_year" "
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
  CAST(has_geometry = 1 AS BOOL) AS has_geometry,
  ecoregion,
  ST_ASTEXT(geometry) AS geom_wkt,
  ST_ASTEXT(centroid) AS centroid_wkt
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_DIM_CENTRAL}\`
" 1000

export_csv "fact_hazard" "cdp_disclosing_org_number, hazard_rank, disclosing_year" "
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
  2025 AS disclosing_year
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_FACT_HAZARD}\`
"

export_csv "fact_goal" "cdp_disclosing_org_number, disclosing_year, goal_index" "
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
"

export_csv "fact_action" "cdp_disclosing_org_number, disclosing_year, action_index" "
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
  disclosing_year
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_FACT_ACTION}\`
"

export_csv "fact_funding_gap" "cdp_disclosing_org_number, disclosing_year, project_area_index, project_index" "
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
"

export_csv "peer_solutions" "disclosing_year, target_org_id, hazard_filter, action_index" "
SELECT
  disclosing_year,
  target_org_id,
  hazard_filter,
  solution_category,
  solution,
  action_rank,
  action_english,
  action_index,
  hazard_addressed,
  peer_org_cnt,
  action_count,
  pct_peers,
  has_local_action
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_PEER_SOLUTIONS}\`
-- Drop placeholder rows (action_index IS NULL AND peer_org_cnt = 0)
WHERE action_index IS NOT NULL
"

export_csv "solution_examples" "disclosing_year, target_org_id, hazard_filter, peer_org_id, action_index" "
SELECT
  disclosing_year,
  target_org_id,
  hazard_filter,
  action_english,
  peer_org_id,
  peer_org_name,
  action_index,
  hazard_addressed_english,
  action_description_english,
  sectors_applied_english,
  resilience_enhanced_english,
  cobenefit_realized_english,
  timeframe_english,
  funding_source_english,
  action_status_english,
  total_cost_usd,
  completeness_score
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.${SRC_SOLUTION_EXAMPLES}\`
"

log "Recreating staging tables"
run_psql <<'SQL'
DROP TABLE IF EXISTS "_cstar_2025_dim_central_stage";
DROP TABLE IF EXISTS "_cstar_2025_fact_hazard_stage";
DROP TABLE IF EXISTS "_cstar_2025_fact_goal_stage";
DROP TABLE IF EXISTS "_cstar_2025_fact_action_stage";
DROP TABLE IF EXISTS "_cstar_2025_fact_funding_gap_stage";
DROP TABLE IF EXISTS "_cstar_2025_peer_solutions_stage";
DROP TABLE IF EXISTS "_cstar_2025_solution_examples_stage";

CREATE TABLE "_cstar_2025_dim_central_stage" (LIKE "CSTAR_2025_Dim_Central" INCLUDING DEFAULTS);
ALTER TABLE "_cstar_2025_dim_central_stage" DROP COLUMN IF EXISTS geometry;
ALTER TABLE "_cstar_2025_dim_central_stage" DROP COLUMN IF EXISTS centroid;
ALTER TABLE "_cstar_2025_dim_central_stage" DROP COLUMN IF EXISTS geom_wkt;
ALTER TABLE "_cstar_2025_dim_central_stage" DROP COLUMN IF EXISTS centroid_wkt;
ALTER TABLE "_cstar_2025_dim_central_stage" ADD COLUMN geom_wkt TEXT;
ALTER TABLE "_cstar_2025_dim_central_stage" ADD COLUMN centroid_wkt TEXT;

CREATE TABLE "_cstar_2025_fact_hazard_stage" (LIKE "CSTAR_2025_Fact_Hazard" INCLUDING DEFAULTS);
CREATE TABLE "_cstar_2025_fact_goal_stage" (LIKE "CSTAR_2025_Fact_Goal" INCLUDING DEFAULTS);
CREATE TABLE "_cstar_2025_fact_action_stage" (LIKE "CSTAR_2025_Fact_Action" INCLUDING DEFAULTS);
CREATE TABLE "_cstar_2025_fact_funding_gap_stage" (LIKE "CSTAR_2025_Fact_Funding_Gap" INCLUDING DEFAULTS);
CREATE TABLE "_cstar_2025_peer_solutions_stage" (LIKE "CSTAR_2025_Peer_Solutions" INCLUDING DEFAULTS);
CREATE TABLE "_cstar_2025_solution_examples_stage" (LIKE "CSTAR_2025_Solution_Examples" INCLUDING DEFAULTS);
SQL

copy_csv '"_cstar_2025_dim_central_stage"' \
  'disclosure_cycle, cdp_requesting_org_number, requesting_organization, projects, cdp_requested_org_number, requested_organization, cdp_disclosing_org_number, disclosing_organization, disclosing_org_type, cdp_region, discloser_country_or_area, questionnaire, eligible_pathway, selected_pathway, disclosure_status, public_status, previous_response_status, reporting_language, reporting_gov, next_high_gov, next_low_gov, jdx_areasize, jdx_natural_pct, current_pop, cur_pop_year, proj_pop, proj_pop_year, reporting_currency, reporting_framework, climate_assess_yn, adpt_goal_yn, action_plan_yn, champ_yn, gs_gn, gdp_pc, dev_status, income_group, fx_rate, disclosing_year, ranked_hazards, ranked_sectors, requesting_auth, ided_non_disclosers, has_geometry, ecoregion, geom_wkt, centroid_wkt' \
  "$CSV_DIR/dim_central"

copy_csv '"_cstar_2025_fact_hazard_stage"' \
  'disclosure_cycle, cdp_disclosing_org_number, public_status, hazard_english, population_exposed_english, sectors_exposed_english, impacts, population_range, hazard_probability, hazard_magnitude, intensity_change, frequency_change, time_frame, summary_text, hazard_rank, disclosing_year' \
  "$CSV_DIR/fact_hazard"

copy_csv '"_cstar_2025_fact_goal_stage"' \
  'disclosure_cycle, cdp_disclosing_org_number, disclosing_organization, public_status, goal_english, hazard_addressed_english, base_year, target_year, metric_used_english, comment_english, disclosing_year, goal_index' \
  "$CSV_DIR/fact_goal"

copy_csv '"_cstar_2025_fact_action_stage"' \
  'disclosure_cycle, cdp_disclosing_org_number, disclosing_organization, public_status, action_english, hazard_addressed_english, action_description_english, sectors_applied_english, resilience_enhanced_english, cobenefit_realized_english, timeframe_english, funding_source_english, action_status_english, total_cost_usd, action_index, disclosing_year' \
  "$CSV_DIR/fact_action"

copy_csv '"_cstar_2025_fact_funding_gap_stage"' \
  'disclosure_cycle, cdp_disclosing_org_number, disclosing_organization, public_status, project_area_english, project_title_english, development_stage, finance_status_english, finance_model_english, project_descirption_english, total_cost_usd, total_needed_usd, disclosing_year, project_area_index, project_index' \
  "$CSV_DIR/fact_funding_gap"

copy_csv '"_cstar_2025_peer_solutions_stage"' \
  'disclosing_year, target_org_id, hazard_filter, solution_category, solution, action_rank, action_english, action_index, hazard_addressed, peer_org_cnt, action_count, pct_peers, has_local_action' \
  "$CSV_DIR/peer_solutions"

copy_csv '"_cstar_2025_solution_examples_stage"' \
  'disclosing_year, target_org_id, hazard_filter, action_english, peer_org_id, peer_org_name, action_index, hazard_addressed_english, action_description_english, sectors_applied_english, resilience_enhanced_english, cobenefit_realized_english, timeframe_english, funding_source_english, action_status_english, total_cost_usd, completeness_score' \
  "$CSV_DIR/solution_examples"
fi  # end: !RESUME (full data-movement section)

log "Validating staging tables (expected counts: dim=${EXPECT_DIM_CENTRAL_ROWS}, hazard=${EXPECT_FACT_HAZARD_ROWS}, goal=${EXPECT_FACT_GOAL_ROWS}, action=${EXPECT_FACT_ACTION_ROWS}, funding=${EXPECT_FACT_FUNDING_GAP_ROWS}, peer=${EXPECT_PEER_SOLUTIONS_ROWS}, examples=${EXPECT_SOLUTION_EXAMPLES_ROWS})"
run_psql <<SQL
DO \$\$
DECLARE
  actual bigint;
  invalid_count bigint;
  -- Expected counts come from script env. The script sets each from the BQ
  -- source row count at export time; pass an explicit env override.
  expect_dim      bigint := ${EXPECT_DIM_CENTRAL_ROWS};
  expect_hazard   bigint := ${EXPECT_FACT_HAZARD_ROWS};
  expect_goal     bigint := ${EXPECT_FACT_GOAL_ROWS};
  expect_action   bigint := ${EXPECT_FACT_ACTION_ROWS};
  expect_funding  bigint := ${EXPECT_FACT_FUNDING_GAP_ROWS};
  expect_peer     bigint := ${EXPECT_PEER_SOLUTIONS_ROWS};
  expect_examples bigint := ${EXPECT_SOLUTION_EXAMPLES_ROWS};
BEGIN
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_dim_central_stage";
  IF expect_dim >= 0 AND actual <> expect_dim THEN RAISE EXCEPTION 'dim staging count %, expected %', actual, expect_dim; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_fact_hazard_stage";
  IF expect_hazard >= 0 AND actual <> expect_hazard THEN RAISE EXCEPTION 'hazard staging count %, expected %', actual, expect_hazard; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_fact_goal_stage";
  IF expect_goal >= 0 AND actual <> expect_goal THEN RAISE EXCEPTION 'goal staging count %, expected %', actual, expect_goal; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_fact_action_stage";
  IF expect_action >= 0 AND actual <> expect_action THEN RAISE EXCEPTION 'action staging count %, expected %', actual, expect_action; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_fact_funding_gap_stage";
  IF expect_funding >= 0 AND actual <> expect_funding THEN RAISE EXCEPTION 'funding staging count %, expected %', actual, expect_funding; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_peer_solutions_stage";
  IF expect_peer >= 0 AND actual <> expect_peer THEN RAISE EXCEPTION 'peer staging count %, expected %', actual, expect_peer; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_solution_examples_stage";
  IF expect_examples >= 0 AND actual <> expect_examples THEN RAISE EXCEPTION 'examples staging count %, expected %', actual, expect_examples; END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM (
    SELECT cdp_disclosing_org_number, disclosing_year
    FROM "_cstar_2025_dim_central_stage"
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  ) d;
  IF invalid_count <> 0 THEN RAISE EXCEPTION 'dim duplicate primary keys: %', invalid_count; END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM (
    SELECT cdp_disclosing_org_number, hazard_rank, disclosing_year
    FROM "_cstar_2025_fact_hazard_stage"
    GROUP BY 1, 2, 3
    HAVING COUNT(*) > 1
  ) d;
  IF invalid_count <> 0 THEN RAISE EXCEPTION 'hazard duplicate primary keys: %', invalid_count; END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM (
    SELECT cdp_disclosing_org_number, disclosing_year, goal_index
    FROM "_cstar_2025_fact_goal_stage"
    GROUP BY 1, 2, 3
    HAVING COUNT(*) > 1
  ) d;
  IF invalid_count <> 0 THEN RAISE EXCEPTION 'goal duplicate primary keys: %', invalid_count; END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM (
    SELECT cdp_disclosing_org_number, disclosing_year, action_index
    FROM "_cstar_2025_fact_action_stage"
    GROUP BY 1, 2, 3
    HAVING COUNT(*) > 1
  ) d;
  IF invalid_count <> 0 THEN RAISE EXCEPTION 'action duplicate primary keys: %', invalid_count; END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM (
    SELECT cdp_disclosing_org_number, disclosing_year, project_area_index, project_index
    FROM "_cstar_2025_fact_funding_gap_stage"
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) > 1
  ) d;
  IF invalid_count <> 0 THEN RAISE EXCEPTION 'funding duplicate primary keys: %', invalid_count; END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM (
    SELECT disclosing_year, target_org_id, hazard_filter, action_index
    FROM "_cstar_2025_peer_solutions_stage"
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) > 1
  ) d;
  IF invalid_count <> 0 THEN RAISE EXCEPTION 'peer duplicate primary keys: %', invalid_count; END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM (
    SELECT disclosing_year, target_org_id, hazard_filter, peer_org_id, action_index
    FROM "_cstar_2025_solution_examples_stage"
    GROUP BY 1, 2, 3, 4, 5
    HAVING COUNT(*) > 1
  ) d;
  IF invalid_count <> 0 THEN RAISE EXCEPTION 'examples duplicate primary keys: %', invalid_count; END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM "_cstar_2025_dim_central_stage"
  WHERE geom_wkt IS NULL OR geom_wkt = '';
  IF invalid_count <> 0 THEN RAISE EXCEPTION 'dim rows missing WKT geometry: %', invalid_count; END IF;

  SELECT COUNT(*) INTO invalid_count
  FROM "_cstar_2025_dim_central_stage"
  WHERE centroid_wkt IS NULL OR centroid_wkt = '';
  IF invalid_count <> 0 THEN RAISE EXCEPTION 'dim rows missing WKT centroid: %', invalid_count; END IF;

  PERFORM ST_GeomFromText(NULLIF(geom_wkt, ''), 4326)
  FROM "_cstar_2025_dim_central_stage";

  PERFORM ST_GeomFromText(NULLIF(centroid_wkt, ''), 4326)
  FROM "_cstar_2025_dim_central_stage";
END \$\$;
SQL

log "Replacing canonical CSTAR tables from staging"
run_psql <<'SQL'
BEGIN;

TRUNCATE TABLE
  "CSTAR_2025_Solution_Examples",
  "CSTAR_2025_Peer_Solutions",
  "CSTAR_2025_Fact_Funding_Gap",
  "CSTAR_2025_Fact_Action",
  "CSTAR_2025_Fact_Goal",
  "CSTAR_2025_Fact_Hazard",
  "CSTAR_2025_Dim_Central";

INSERT INTO "CSTAR_2025_Dim_Central" (
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
  disclosing_year,
  ranked_hazards,
  ranked_sectors,
  requesting_auth,
  ided_non_disclosers,
  has_geometry,
  ecoregion,
  geom_wkt,
  centroid_wkt,
  geometry,
  centroid
)
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
  disclosing_year,
  ranked_hazards,
  ranked_sectors,
  REPLACE(requesting_auth, ',', '|'),
  ided_non_disclosers,
  has_geometry,
  ecoregion,
  geom_wkt,
  centroid_wkt,
  ST_GeomFromText(NULLIF(geom_wkt, ''), 4326),
  ST_GeomFromText(NULLIF(centroid_wkt, ''), 4326)
FROM "_cstar_2025_dim_central_stage";

INSERT INTO "CSTAR_2025_Fact_Hazard" (
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
)
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
FROM "_cstar_2025_fact_hazard_stage";

INSERT INTO "CSTAR_2025_Fact_Goal" (
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
)
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
FROM "_cstar_2025_fact_goal_stage";

INSERT INTO "CSTAR_2025_Fact_Action" (
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
  disclosing_year
)
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
  disclosing_year
FROM "_cstar_2025_fact_action_stage";

INSERT INTO "CSTAR_2025_Fact_Funding_Gap" (
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
)
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
FROM "_cstar_2025_fact_funding_gap_stage";

INSERT INTO "CSTAR_2025_Peer_Solutions" (
  disclosing_year,
  target_org_id,
  hazard_filter,
  solution_category,
  solution,
  action_rank,
  action_english,
  action_index,
  hazard_addressed,
  peer_org_cnt,
  action_count,
  pct_peers,
  has_local_action
)
SELECT
  disclosing_year,
  target_org_id,
  hazard_filter,
  solution_category,
  solution,
  action_rank,
  action_english,
  action_index,
  hazard_addressed,
  peer_org_cnt,
  action_count,
  pct_peers,
  has_local_action
FROM "_cstar_2025_peer_solutions_stage";

INSERT INTO "CSTAR_2025_Solution_Examples" (
  disclosing_year,
  target_org_id,
  hazard_filter,
  action_english,
  peer_org_id,
  peer_org_name,
  action_index,
  hazard_addressed_english,
  action_description_english,
  sectors_applied_english,
  resilience_enhanced_english,
  cobenefit_realized_english,
  timeframe_english,
  funding_source_english,
  action_status_english,
  total_cost_usd,
  completeness_score
)
SELECT
  disclosing_year,
  target_org_id,
  hazard_filter,
  action_english,
  peer_org_id,
  peer_org_name,
  action_index,
  hazard_addressed_english,
  action_description_english,
  sectors_applied_english,
  resilience_enhanced_english,
  cobenefit_realized_english,
  timeframe_english,
  funding_source_english,
  action_status_english,
  total_cost_usd,
  completeness_score
FROM "_cstar_2025_solution_examples_stage";

CREATE INDEX IF NOT EXISTS idx_target_table_geom
ON "CSTAR_2025_Dim_Central" USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_cstar_2025_dim_central_centroid
ON "CSTAR_2025_Dim_Central" USING GIST (centroid);

COMMIT;
SQL

log "Validating canonical tables"
run_psql <<'SQL'
SELECT 'CSTAR_2025_Dim_Central' AS table_name, COUNT(*)::bigint AS rows FROM "CSTAR_2025_Dim_Central"
UNION ALL SELECT 'CSTAR_2025_Fact_Hazard', COUNT(*)::bigint FROM "CSTAR_2025_Fact_Hazard"
UNION ALL SELECT 'CSTAR_2025_Fact_Goal', COUNT(*)::bigint FROM "CSTAR_2025_Fact_Goal"
UNION ALL SELECT 'CSTAR_2025_Fact_Action', COUNT(*)::bigint FROM "CSTAR_2025_Fact_Action"
UNION ALL SELECT 'CSTAR_2025_Fact_Funding_Gap', COUNT(*)::bigint FROM "CSTAR_2025_Fact_Funding_Gap"
UNION ALL SELECT 'CSTAR_2025_Peer_Solutions', COUNT(*)::bigint FROM "CSTAR_2025_Peer_Solutions"
UNION ALL SELECT 'CSTAR_2025_Solution_Examples', COUNT(*)::bigint FROM "CSTAR_2025_Solution_Examples"
ORDER BY table_name;

SELECT
  COUNT(*) FILTER (WHERE geometry IS NOT NULL) AS dim_rows_with_geometry,
  COUNT(*) FILTER (WHERE geometry IS NULL) AS dim_rows_without_geometry,
  COUNT(*) FILTER (WHERE centroid IS NOT NULL) AS dim_rows_with_centroid,
  COUNT(*) FILTER (WHERE centroid IS NULL) AS dim_rows_without_centroid,
  COUNT(*) FILTER (WHERE geom_wkt IS NOT NULL AND geom_wkt <> '') AS dim_rows_with_geom_wkt,
  COUNT(*) FILTER (WHERE geom_wkt IS NULL OR geom_wkt = '') AS dim_rows_without_geom_wkt,
  COUNT(*) FILTER (WHERE centroid_wkt IS NOT NULL AND centroid_wkt <> '') AS dim_rows_with_centroid_wkt,
  COUNT(*) FILTER (WHERE centroid_wkt IS NULL OR centroid_wkt = '') AS dim_rows_without_centroid_wkt,
  COUNT(*) FILTER (WHERE public_status = 'Public') AS dim_public_rows,
  COUNT(*) FILTER (WHERE disclosure_status = 'non-disclosed') AS dim_non_disclosed_rows
FROM "CSTAR_2025_Dim_Central";
SQL

log "Migration complete for ${TARGET_ENV}"