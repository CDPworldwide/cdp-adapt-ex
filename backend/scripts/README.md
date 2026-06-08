# backend/scripts

Operational scripts for backend dev + the CSTAR 2025 data pipeline.

## Pipeline

Four stages, run end-to-end whenever CSTAR data is refreshed. Each stage's output is the next stage's input - check carefully when re-running portions of the pipeline to see where there are dependencies.

### 1. Notebook → `*_final` BQ tables

[`scripts/CDP CSTAR run-to-rule-them-all-ETL.ipynb`](../../scripts/CDP%20CSTAR%20run-to-rule-them-all-ETL.ipynb) (Colab Enterprise). Translates / summarises / geocodes raw `CSTAR_2025_v2` BigQuery data → writes `CSTAR_2025_processed_v2.*_final`. Covers Public disclosers with structured `ranked_hazards` only.

### 2. Geometry fixes & missing data → `Missing_Data.*` BQ tables

All geometry fixes live in the separate **`cdp-geospatial-ops`** repo (see its README) — that's the source of truth for every correction we've applied. Per-account NDJSON gets loaded into BigQuery as `Missing_Data.geometry-fixes` / `Missing_Data.nondiscloser-geometries`, where the post-notebook script picks them up. For individual jurisdictions where the polygon needs a correction but the ecoregion assignment (and therefore peer jurisdiction matching) doesn't change, one-off Cloud SQL hotpatches live here as `apply_individual_geometry_fix_<org>.sql` (one as of 2026-06-08).

### 3. Post-notebook finalize → `*_TEST` BQ tables

[`scripts/post_notebook_finalize_tables.sql`](../../scripts/post_notebook_finalize_tables.sql)

Finishes what the notebook leaves unfinished. The notebook only covers Public disclosers with structured `ranked_hazards`; this script adds:

- Non-disclosers (GEE-Derived)
- Non-Public disclosers
- Disclosers with NULL or `Other:`-only `ranked_hazards`
- `'All'`-bucket peer_solutions / solution_examples

Plus water-crops mostly-water geometries, COALESCEs Missing_Data fixes, normalizes hazard text, and builds `dim_cdp_geo_and_ecoregion_TEST` — the ecoregion assignment that peer_solutions / solution_examples join on. Without this stage, non-disclosers have no ecoregion → no peer matches → empty Solutions tab.

Run by hand from Cloud Shell between the notebook rebuild and the migration:

```bash
bq query --use_legacy_sql=false --project_id="$PROJECT_ID" \
  < scripts/post_notebook_finalize_tables.sql
```

Transitional — destined to fold into the notebook once stable.

### 4. Migration → Cloud SQL

[`migrate_cstar_2025_via_gcs.sh`](migrate_cstar_2025_via_gcs.sh): BQ `*_TEST` → GCS staging → Cloud SQL (`cdp-test` for dev, `cdp-prod` for prod). Validation runs against staging tables before swapping into the canonical CSTAR tables in one transaction. Source-table mapping:

| Canonical Cloud SQL table        | Default BQ source                |
|----------------------------------|----------------------------------|
| `CSTAR_2025_Dim_Central`         | `dim_cdp_geo_and_ecoregion_TEST` |
| `CSTAR_2025_Fact_Hazard`         | `fact_hazard_final_TEST`         |
| `CSTAR_2025_Fact_Goal`           | `fact_goal_final`                |
| `CSTAR_2025_Fact_Action`         | `fact_action_final_TEST`         |
| `CSTAR_2025_Fact_Funding_Gap`    | `fact_funding_gap_final_TEST`    |
| `CSTAR_2025_Peer_Solutions`      | `peer_solutions_final_TEST`      |
| `CSTAR_2025_Solution_Examples`   | `solution_examples_TEST`         |

> The `_TEST` suffix is a holdover from when stage 3 was still iterating; these are the production migration source. We suggest these are renamed eventually.

See **Migration runbook** below for how to invoke.

## Migration runbook (Cloud Shell)

Run from Cloud Shell — it has `gcloud`, `bq`, `gsutil`, `psql`, and Docker preinstalled, and doesn't depend on your local network or storage. (An older [`migrate_cstar_2025_from_bigquery.sh`](migrate_cstar_2025_from_bigquery.sh) variant also exists but is not kept current — use the `via_gcs` one.)

### Prereqs

- Your Google account has `roles/cloudsql.client` on the project.
- Stage 3's `*_TEST` BQ tables are rebuilt.
- For prod: a recent `SUCCESSFUL` backup on the prod instance (the script checks).
- Set the env vars used below in your shell: `PROJECT_ID`, plus `DB_USER` / `DB_NAME` / `DB_PASSWORD` fetched via your team's secrets workflow.

### Dev migration (`cdp-test`)

**1. Start the proxy** (separate terminal):

```bash
pkill -f cloud-sql-proxy 2>/dev/null
docker rm -f pac-cloud-sql-proxy 2>/dev/null

nohup ./start_cloud_sql_proxy.sh > /tmp/csproxy.log 2>&1 &
disown

sleep 5 && tail -30 /tmp/csproxy.log
# Expect: "The proxy has started successfully and is ready for new connections!"
```

Token TTL is ~1 hour. The token is embedded at container start; long-running connections survive expiry. If you see mid-run auth errors, restart the proxy and resume with `--resume`.

**2. Smoke-test the connection**:

```bash
PGPASSWORD="$DB_PASSWORD" psql \
  "host=127.0.0.1 port=55432 dbname=$DB_NAME user=$DB_USER sslmode=disable" \
  -c "SELECT current_database(), current_user;"
```

**3. Preflight** (no data changes — structural checks against Cloud SQL):

```bash
./migrate_cstar_2025_via_gcs.sh development --preflight-only
```

**4. Full migration in tmux** (survives Cloud Shell disconnect):

```bash
tmux new -s cstar-mig
./migrate_cstar_2025_via_gcs.sh development 2>&1 | tee /tmp/cstar-mig.log
# Detach: Ctrl-b d. Reattach: tmux attach -t cstar-mig
```

Typical runtime against `cdp-test`: ~10-15 minutes (most of it is `gcloud sql import csv`, serialized per-instance).

**5. Resume after mid-run failure**:

```bash
./migrate_cstar_2025_via_gcs.sh development --resume
```

Skips BQ export + Cloud SQL import, jumps to validation + swap. Useful for transient proxy disconnects or dup-PKs that needed an upstream fix in BigQuery.

### Prod migration (`cdp-prod`)

Same flow. Repoint the proxy at `cdp-prod` first (edit `INSTANCE_CONNECTION_NAME` in `start_cloud_sql_proxy.sh`, or run a second proxy on a different port). Then:

```bash
ALLOW_PRODUCTION_MIGRATION=yes \
CONFIRM_TARGET=cdp-prod \
  ./migrate_cstar_2025_via_gcs.sh production 2>&1 | tee /tmp/cstar-prod.log
```

The script refuses to run without both env vars set, and checks for a recent `SUCCESSFUL` backup on the instance.

### Post-deploy smoke test

After a migration (dev or prod), hit a few backend endpoints to confirm the deployed service can serve the new data:

```bash
BACKEND_URL=https://<deployed-backend> \
BACKEND_API_KEY="$API_KEY" \
  ./smoke_test_deployment.sh
```

[`smoke_test_deployment.sh`](smoke_test_deployment.sh) calls `/health`, `/location/<org>`, and a translation endpoint, and asserts expected status codes. Tweak the default test org via `SMOKE_TEST_LOCATION_ORG_ID`.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `psql: server closed the connection unexpectedly` | Proxy not listening / wrong connection name | `tail /tmp/csproxy.log`; restart proxy |
| `gcloud secrets versions access` returns empty | Stale ADC | `gcloud auth login && gcloud auth application-default login` |
| `409: operation already in progress` during import | Two `gcloud sql import csv` calls overlapping | Restart from `--resume` |
| `hazard duplicate primary keys: <n>` | Upstream dedupe regression in `fact_hazard_final_TEST` (Public+Public dup, or Public+GEE-Derived collision on a 3-col PK) | Fix in BQ, re-run `--resume`. PK is 4-col `(org, rank, year, public_status)` — see [`alter_fact_hazard_pk_include_public_status.sql`](alter_fact_hazard_pk_include_public_status.sql) |
| `dim rows missing WKT geometry: <n>` | Notebook didn't materialize a centroid for some dim rows | Re-run the `dim_cdp_geo_and_ecoregion` notebook cell with the buffered-geometry CASE |
| Proxy logs `unauthenticated` mid-run | Token expired (~1hr) | Restart proxy, run `--resume` |

## Schema ALTERs (historical)

Fresh DBs use [`create_empty_tables.sql`](../../scripts/create_empty_tables.sql), which now encodes the full PK shape — no separate ALTERs needed. The files below ran once against the live Cloud SQL instances and are kept for reference.

- [`alter_fact_hazard_pk_include_public_status.sql`](alter_fact_hazard_pk_include_public_status.sql) — adds `public_status` to `CSTAR_2025_Fact_Hazard` PK.
- [`add_row_order_pks.sql`](add_row_order_pks.sql) — adds `row_order` to `CSTAR_2025_Fact_Action` + `CSTAR_2025_Solution_Examples` PKs.

## Local dev

- [`start_cloud_sql_proxy.sh`](start_cloud_sql_proxy.sh) — Docker proxy → `cdp-test:55432`.
- [`start_dev_server.sh`](start_dev_server.sh) — FastAPI dev server, defaults to the proxy port.
