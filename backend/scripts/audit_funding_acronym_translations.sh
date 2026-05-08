#!/usr/bin/env bash

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-project-bb4fd058-24e7-4ccb-b06}"
RAW_DATASET="${RAW_DATASET:-CSTAR_2025}"
PROCESSED_DATASET="${PROCESSED_DATASET:-CSTAR_2025_processed}"
RAW_TABLE="${RAW_TABLE:-Q9_3}"
TRANSLATED_TABLE="${TRANSLATED_TABLE:-funding_translated}"
FORMAT="${FORMAT:-prettyjson}"
LIMIT="${LIMIT:-1000}"
MAX_ROWS="${MAX_ROWS:-100000}"
ACRONYM_TYPE="${ACRONYM_TYPE:-all}"
UNCHANGED_FILTER="${UNCHANGED_FILTER:-all}"
ORG_ID="${ORG_ID:-}"
DISCLOSURE_CYCLE="${DISCLOSURE_CYCLE:-}"
OUTPUT_PATH="${OUTPUT_PATH:-}"
PRINT_SQL=false
DRY_RUN=false

usage() {
  cat <<'EOF'
Usage: backend/scripts/audit_funding_acronym_translations.sh [options]

Runs Laura's funding-title acronym audit against BigQuery, with a few filters.

Options:
  --project-id ID             GCP project ID.
  --raw-dataset DATASET       Raw dataset containing Q9_3.
  --processed-dataset DATASET Processed dataset containing funding_translated.
  --raw-table TABLE           Raw funding question table. Default: Q9_3.
  --translated-table TABLE    Processed translation table. Default: funding_translated.
  --acronym-type TYPE         all, dotted, all-caps. Default: all.
  --unchanged FILTER          all, changed, unchanged. Default: all.
  --org-id ID                 Restrict to one cdp_disclosing_org_number.
  --disclosure-cycle VALUE    Restrict to one disclosure_cycle.
  --limit N                   Limit returned rows. Use none for no LIMIT. Default: 1000.
  --max-rows N                Max rows for bq to print when query is not dry-run. Default: 100000.
  --format FORMAT             bq output format. Default: prettyjson.
  --output PATH               Write bq output to a file.
  --print-sql                 Print the SQL and exit.
  --dry-run                   Ask BigQuery to validate and estimate the query.
  -h, --help                  Show this help.

Examples:
  backend/scripts/audit_funding_acronym_translations.sh --unchanged changed --limit 200
  backend/scripts/audit_funding_acronym_translations.sh --acronym-type dotted --format csv --output /tmp/dotted.csv
  PROCESSED_DATASET=CSTAR_2025_processed_achinoam_test backend/scripts/audit_funding_acronym_translations.sh
EOF
}

quote_sql_string() {
  local value="$1"
  printf "'%s'" "${value//\'/\'\'}"
}

require_identifier() {
  local label="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    printf 'Invalid %s: %s\n' "$label" "$value" >&2
    exit 2
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-id)
      PROJECT_ID="$2"
      shift 2
      ;;
    --raw-dataset)
      RAW_DATASET="$2"
      shift 2
      ;;
    --processed-dataset)
      PROCESSED_DATASET="$2"
      shift 2
      ;;
    --raw-table)
      RAW_TABLE="$2"
      shift 2
      ;;
    --translated-table)
      TRANSLATED_TABLE="$2"
      shift 2
      ;;
    --acronym-type)
      ACRONYM_TYPE="$2"
      shift 2
      ;;
    --unchanged)
      UNCHANGED_FILTER="$2"
      shift 2
      ;;
    --org-id)
      ORG_ID="$2"
      shift 2
      ;;
    --disclosure-cycle)
      DISCLOSURE_CYCLE="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --max-rows)
      MAX_ROWS="$2"
      shift 2
      ;;
    --format)
      FORMAT="$2"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --print-sql)
      PRINT_SQL=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

require_identifier "raw dataset" "$RAW_DATASET"
require_identifier "processed dataset" "$PROCESSED_DATASET"
require_identifier "raw table" "$RAW_TABLE"
require_identifier "translated table" "$TRANSLATED_TABLE"

case "$ACRONYM_TYPE" in
  all|dotted|all-caps) ;;
  *)
    printf 'Invalid --acronym-type: %s\n' "$ACRONYM_TYPE" >&2
    exit 2
    ;;
esac

case "$UNCHANGED_FILTER" in
  all|changed|unchanged) ;;
  *)
    printf 'Invalid --unchanged: %s\n' "$UNCHANGED_FILTER" >&2
    exit 2
    ;;
esac

if [[ "$LIMIT" != "none" && ! "$LIMIT" =~ ^[0-9]+$ ]]; then
  printf 'Invalid --limit: %s\n' "$LIMIT" >&2
  exit 2
fi

if [[ ! "$MAX_ROWS" =~ ^[0-9]+$ ]]; then
  printf 'Invalid --max-rows: %s\n' "$MAX_ROWS" >&2
  exit 2
fi

DOTTED_REGEX="\\b(?:[A-Za-z]{1,2}\\.)+[A-Za-z]\\.?($|[^A-Za-z0-9_])"
ALL_CAPS_REGEX="\\b[A-Z]{2,8}\\b"

where_clauses=(
  "q.col2_Project_title IS NOT NULL"
  "TRIM(q.col2_Project_title) != ''"
)

case "$ACRONYM_TYPE" in
  dotted)
    where_clauses+=("REGEXP_CONTAINS(q.col2_Project_title, r'${DOTTED_REGEX}')")
    ;;
  all-caps)
    where_clauses+=("REGEXP_CONTAINS(q.col2_Project_title, r'${ALL_CAPS_REGEX}')")
    ;;
  all)
    where_clauses+=("(REGEXP_CONTAINS(q.col2_Project_title, r'${DOTTED_REGEX}') OR REGEXP_CONTAINS(q.col2_Project_title, r'${ALL_CAPS_REGEX}'))")
    ;;
esac

case "$UNCHANGED_FILTER" in
  changed)
    where_clauses+=("q.col2_Project_title IS DISTINCT FROM ft.project_title_english")
    ;;
  unchanged)
    where_clauses+=("q.col2_Project_title = ft.project_title_english")
    ;;
esac

if [[ -n "$ORG_ID" ]]; then
  if [[ ! "$ORG_ID" =~ ^[0-9]+$ ]]; then
    printf 'Invalid --org-id: %s\n' "$ORG_ID" >&2
    exit 2
  fi
  where_clauses+=("q.cdp_disclosing_org_number = ${ORG_ID}")
fi

if [[ -n "$DISCLOSURE_CYCLE" ]]; then
  where_clauses+=("q.disclosure_cycle = $(quote_sql_string "$DISCLOSURE_CYCLE")")
fi

where_sql="$(printf '  AND %s\n' "${where_clauses[@]}")"
where_sql="${where_sql#  AND }"

limit_sql=""
if [[ "$LIMIT" != "none" ]]; then
  limit_sql="LIMIT ${LIMIT}"
fi

read -r -d '' SQL <<EOF || true
SELECT
  q.disclosure_cycle,
  q.cdp_disclosing_org_number,
  q.row_order,
  q.col2_Project_title AS source_title,
  ft.project_title_english AS translated_title,
  q.col2_Project_title = ft.project_title_english AS unchanged,
  CASE
    WHEN REGEXP_CONTAINS(q.col2_Project_title, r'${DOTTED_REGEX}')
      THEN 'dotted (M.O.S.E. style)'
    WHEN REGEXP_CONTAINS(q.col2_Project_title, r'${ALL_CAPS_REGEX}')
      THEN 'all-caps token (MOSE, EPA style)'
    ELSE 'other'
  END AS acronym_type
FROM \`${PROJECT_ID}.${RAW_DATASET}.${RAW_TABLE}\` q
LEFT JOIN \`${PROJECT_ID}.${PROCESSED_DATASET}.${TRANSLATED_TABLE}\` ft
  USING (disclosure_cycle, cdp_disclosing_org_number, row_order)
WHERE
  ${where_sql}
ORDER BY unchanged ASC, q.cdp_disclosing_org_number, q.row_order
${limit_sql}
EOF

if [[ "$PRINT_SQL" == true ]]; then
  printf '%s\n' "$SQL"
  exit 0
fi

bq_args=(
  --quiet
  --project_id="$PROJECT_ID"
  query
  --use_legacy_sql=false
  --format="$FORMAT"
)

if [[ "$DRY_RUN" == true ]]; then
  bq_args+=(--dry_run)
else
  bq_args+=(--max_rows="$MAX_ROWS")
fi

if [[ -n "$OUTPUT_PATH" ]]; then
  bq "${bq_args[@]}" "$SQL" > "$OUTPUT_PATH"
  printf 'Wrote acronym audit results to %s\n' "$OUTPUT_PATH"
else
  bq "${bq_args[@]}" "$SQL"
fi
