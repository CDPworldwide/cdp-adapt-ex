#!/usr/bin/env bash

set -euo pipefail
shopt -s nullglob

PROJECT_ID="${PROJECT_ID:-project-bb4fd058-24e7-4ccb-b06}"
SOURCE_DATASET="${SOURCE_DATASET:-CSTAR_2025_processed}"
CHUNK_ROWS="${CHUNK_ROWS:-50000}"
TARGET_ENV="${1:-development}"
PREFLIGHT_ONLY=false

usage() {
  printf 'Usage: %s [development|production] [--preflight-only]\n' "$0" >&2
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
CSV_DIR="$WORK_DIR/csv"
if [[ "$PREFLIGHT_ONLY" != true ]]; then
  mkdir -p "$CSV_DIR"
fi

secret() {
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

export_csv() {
  local name="$1"
  local order_by="$2"
  local sql="$3"
  local chunk_rows="${4:-$CHUNK_ROWS}"
  local local_dir="$CSV_DIR/$name"
  local raw_chunk_path
  local chunk_path
  local count_output
  local total_rows
  local offset
  local chunk_number

  rm -rf "$local_dir"
  mkdir -p "$local_dir"

  count_output="$(bq --quiet --project_id="$PROJECT_ID" query \
    --use_legacy_sql=false \
    --max_rows=1 \
    --format=csv \
    "SELECT COUNT(*) AS row_count FROM (${sql})")"
  total_rows="$(printf '%s\n' "$count_output" | tail -n 1 | tr -d '\r')"

  log "Exporting ${name} (${total_rows} rows) to ${local_dir} in ${chunk_rows}-row chunks"
  offset=0
  chunk_number=0
  while (( offset < total_rows )); do
    raw_chunk_path="$(printf '%s/%s_%05d.raw.csv' "$local_dir" "$name" "$chunk_number")"
    chunk_path="$(printf '%s/%s_%05d.csv' "$local_dir" "$name" "$chunk_number")"
    bq --quiet --project_id="$PROJECT_ID" query \
      --use_legacy_sql=false \
      --max_rows="$chunk_rows" \
      --format=csv \
      "SELECT * FROM (${sql}) ORDER BY ${order_by} LIMIT ${chunk_rows} OFFSET ${offset}" \
      > "$raw_chunk_path"
    tail -n +2 "$raw_chunk_path" > "$chunk_path"
    rm -f "$raw_chunk_path"
    offset=$((offset + chunk_rows))
    chunk_number=$((chunk_number + 1))
  done
}

copy_csv() {
  local table="$1"
  local columns="$2"
  local local_dir="$3"
  local files=("$local_dir"/*.csv)

  if [[ "${#files[@]}" -eq 0 ]]; then
    printf 'No CSV shards found in %s\n' "$local_dir" >&2
    exit 1
  fi

  for path in "${files[@]}"; do
    log "Loading ${path} into ${table}"
    run_psql -c "\\copy ${table} (${columns}) FROM '${path}' WITH (FORMAT csv)"
  done
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
log "Using local Cloud SQL proxy at ${DB_HOST}:${LOCAL_PORT}; work dir ${WORK_DIR}"

check_recent_backup

log "Running Cloud SQL preflight"
run_cloudsql_preflight

if [[ "$PREFLIGHT_ONLY" == true ]]; then
  log "Preflight complete for ${TARGET_ENV}; no schema or data changes were made"
  exit 0
fi

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
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.dim_cdp_geo_and_ecoregion_TEST\`
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
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.fact_hazard_final_TEST\`
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
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.fact_goal_final_TEST\`
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
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.fact_action_final_TEST\`
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
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.fact_funding_gap_final_TEST\`
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
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.peer_solutions_final_TEST\`
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
FROM \`${PROJECT_ID}.${SOURCE_DATASET}.solution_examples_TEST\`
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

log "Validating staging tables"
run_psql <<'SQL'
DO $$
DECLARE
  actual bigint;
  invalid_count bigint;
BEGIN
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_dim_central_stage";
  IF actual <> 1925 THEN RAISE EXCEPTION 'dim staging count %, expected 1925', actual; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_fact_hazard_stage";
  IF actual <> 8480 THEN RAISE EXCEPTION 'hazard staging count %, expected 8480', actual; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_fact_goal_stage";
  IF actual <> 4577 THEN RAISE EXCEPTION 'goal staging count %, expected 4577', actual; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_fact_action_stage";
  IF actual <> 5623 THEN RAISE EXCEPTION 'action staging count %, expected 5623', actual; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_fact_funding_gap_stage";
  IF actual <> 3053 THEN RAISE EXCEPTION 'funding staging count %, expected 3053', actual; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_peer_solutions_stage";
  IF actual <> 133466 THEN RAISE EXCEPTION 'peer staging count %, expected 133466', actual; END IF;
  SELECT COUNT(*) INTO actual FROM "_cstar_2025_solution_examples_stage";
  IF actual <> 566216 THEN RAISE EXCEPTION 'examples staging count %, expected 566216', actual; END IF;

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
END $$;
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
