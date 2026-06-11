# backend/scripts

Operational scripts for backend dev + the CSTAR 2025 data pipeline. Focused on
the **Cloud SQL** side of the world (migration, schema, hot-patches, dev server,
deploy smoke tests). Cloud SQL DDL lives in [`create_empty_tables.sql`](create_empty_tables.sql);
one-off ALTERs and hot-patches that have already been applied live in
[`one-time-applied/`](one-time-applied/); the deprecated pre-Cloud-Shell migration
variant lives in [`deprecated/`](deprecated/) for reference.

The **BigQuery** side of the pipeline — the two Jupyter notebooks, BQ-side SQL
helpers, validation queries — lives in the sibling [`scripts/`](../../scripts/)
directory at the repo root, including `CDP CSTAR
run-to-rule-them-all-ETL.ipynb` (Stage 1), `CDP CSTAR
post-notebook-finalize.ipynb` (Stage 2), `static_other_segments_map.sql`
(loaded by the main notebook at runtime), `cstar_2025_bq_validation.sql`
(BQ-side validation between Stages 2 and 3), or `build_country_metadata_with_fx.py`
(Stage 0 helper).

## Table of contents

- [Data pipeline architecture](#data-pipeline-architecture)
- [Pipeline](#pipeline)
- [Refresh cadence](#refresh-cadence)
- [One-time setup checklist](#one-time-setup-checklist)
- [Migration runbook (Cloud Shell)](#migration-runbook-cloud-shell)
- [Notebook logic updates](#notebook-logic-updates)
- [Schema ALTERs (historical)](#schema-alters-historical)
- [Local dev](#local-dev)

## Data pipeline architecture

```
   [Stage 0] (owned outside this repo, undocumented here)
       CDP XLSX export → CSV → gs://cdp-raw-data-bucket/ → bq LOAD
                                      │
                                      ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  CSTAR_2025_v2 (raw)                                                       │
   │    Q1_1, Q1_2, Q2_1, Q2_2, Q5_1, Q5_1_1, Q8_1, Q8_1_1, Q9_1, Q9_3          │
   │    country_metadata     (FX rates)                                         │
   │    Summary_combined     (disclosure index)                                 │
   └────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │   From Missing_Data:
                                      │     • quezon_Q*           appended to raw data
                                      │     • geometry-fixes      replace default Overture
                                      │     • missing-data        polygon (disclosers)
                                      ▼
                          [Stage 1] CDP CSTAR run-to-rule-them-all-ETL.ipynb
                                      │
                                      ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  CSTAR_2025_processed_v2.*_final                                           │
   │    dim_cdp_geo_and_ecoregion · fact_*_final                                │
   │    peer_solutions · solution_examples                                      │
   │    other_segments_map · translation_model                                  │
   └────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │   From Missing_Data:
                                      │     • geometry-fixes      same replacement,
                                      │     • missing-data        re-run on the merged
                                      │                           set (picks up ~21
                                      │                           nondiscloser fixes)
                                      │     • nondiscloser-       supplies polygons for
                                      │       geometries          nondiscloser orgs
                                      ▼
                          [Stage 2] CDP CSTAR post-notebook-finalize.ipynb
                                      │
                                      ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  CSTAR_2025_processed_v2.*_TEST                                            │
   │    dim_cdp_geo_and_ecoregion_TEST · fact_*_TEST                            │
   │    peer_solutions_final_TEST · solution_examples_TEST                      │
   └────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                          [Stage 3] migrate_cstar_2025_via_gcs.sh
                                      │
                                      ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  Cloud SQL   (cdp-test for dev, cdp-prod for prod)                         │
   │    CSTAR_2025_Dim_Central · CSTAR_2025_Fact_*                              │
   │    CSTAR_2025_Peer_Solutions · CSTAR_2025_Solution_Examples                │
   └────────────────────────────────────────────────────────────────────────────┘

   [Stage 1a] Missing_Data — the feedback loop. Side input that's not a sequential
              step but feeds into Stages 1 and 2. See "Iterating on issues via
              Stage 1a" below.
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  Missing_Data                                                              │
   │    quezon_Q*                  → appended to Stage 1's raw data (CDP's      │
   │                                 XLSX export missed Quezon City)            │
   │    geometry-fixes             → hand-corrected polygons that replace the   │
   │                                 default Overture polygon for the orgs they │
   │                                 cover. Stage 1 applies them for disclosers;│
   │                                 Stage 2 applies them again on the merged   │
   │                                 set so the ~21 entries for nondiscloser    │
   │                                 orgs get picked up too.                    │
   │    missing-data               → same role as geometry-fixes (manual        │
   │                                 polygons for orgs Overture didn't cover at │
   │                                 all)                                       │
   │    nondiscloser-geometries    → supplies polygons for nondiscloser orgs;   │
   │                                 added by Stage 2 only (those orgs don't    │
   │                                 flow through Stage 1)                      │
   └────────────────────────────────────────────────────────────────────────────┘
```

### What's where

- **Stage 0 is owned outside this repo and isn't documented here.** Raw
  `CSTAR_2025_v2.*` tables (the Q-tables, `country_metadata`, `Summary_combined`)
  are loaded from `gs://cdp-raw-data-bucket/CSTAR_2025/` via one-off `bq LOAD`
  jobs by the data team. Refresh cadence and ownership for those loads sit
  with them. If a Q-table or FX rate looks stale, that's where to ask.

### Iterating on issues via Stage 1a

`Missing_Data.*` is the **feedback channel** for the pipeline. It didn't
exist before Stage 1 ran the first time, but we built it as reviewers spotted issues in the rendered Cloud SQL output:

1. Stage 1 (notebook) and Stage 0 (CDP XLSX) have known accuracy gaps —
   the notebook's Overture-based polygon match is imperfect, and CDP's
   XLSX exports occasionally drop disclosed rows entirely (e.g. Quezon
   City was missing from the 2026 export).
2. As issues are spotted in dev or prod, corrections get authored — geometry
   fixes go into the [`cdp-geospatial-ops`](https://github.com/CDPworldwide/cdp-geospatial-ops)
   repo (source of truth for every geometry + nondiscloser correction we've
   applied); raw-data overlays like Quezon's Q-tables get hand-maintained here.
3. Both flow into `Missing_Data.*`:
   - `cdp-geospatial-ops`'s resolver writes per-account GeoJSON, which the
     [`adapt-ex-sql/`](https://github.com/CDPworldwide/cdp-geospatial-ops/tree/main/adapt-ex-sql)
     workflow converts to NDJSON and `bq load`s into
     `Missing_Data.geometry-fixes` (managed) and
     `Missing_Data.nondiscloser-geometries` (external, GCS-backed).
   - `Missing_Data.quezon_Q*` are hand-maintained tables in BQ, mirroring
     the shape of `CSTAR_2025_v2.Q1_1` / `Q2_2` / `Q5_1_1` / `Q9_1` / `Q9_3`.
4. On the **next** pipeline run, the notebook + post-finalize each pull in
   their share of the corrections:
   - `Missing_Data.quezon_Q*` is **appended to the main notebook's raw data**
     at its aggregation step (cells 19/22/28/37). Output `_final` tables
     already include Quezon's rows.
   - `Missing_Data.geometry-fixes` + `Missing_Data.missing-data` are
     **used by the main notebook to replace the default Overture polygon**
     when it builds `dim_cdp_geo_and_ecoregion`. Per-org priority for picking
     the best polygon: `geometry-fixes` > `missing-data` > Overture > base
     `dim_central`. Covers disclosers only.
   - The post-finalize notebook **re-runs that same polygon-replacement on the
     merged disclosers+nondisclosers set** when building
     `dim_cdp_geo_and_ecoregion_TEST` — that re-run is a no-op for disclosers
     but picks up the ~21 `geometry-fixes` rows for nondiscloser org IDs. It
     also brings in `Missing_Data.nondiscloser-geometries`, which supplies
     the polygons for nondiscloser orgs themselves (those orgs never flow
     through the main notebook).

So output gets progressively cleaner over time as corrections accumulate. Later, fixing the upstream root causes should be a priority.

For one-off geometry corrections that need to land in Cloud SQL **without** waiting for a full pipeline re-run, see [Post-hoc fixes applied directly to Cloud SQL](#post-hoc-fixes-applied-directly-to-cloud-sql) — those hot-patches both modify Cloud SQL directly AND get appended to `Missing_Data.geometry-fixes` so the next full run is consistent.

## Pipeline

Four sequential stages (1 → 2 → 3) plus the **Stage 1a** side input — `Missing_Data.*` — which feeds into Stages 1 and 2 (see the architecture diagram and "Iterating on issues via Stage 1a" above). Each sequential stage's output is the next stage's input; check carefully when re-running portions of the pipeline to see where there are dependencies.

### 1. Notebook → `*_final` BQ tables

[`scripts/CDP CSTAR run-to-rule-them-all-ETL.ipynb`](../../scripts/CDP%20CSTAR%20run-to-rule-them-all-ETL.ipynb) (Colab Enterprise). Translates / summarises / geocodes raw `CSTAR_2025_v2` BigQuery data → writes `CSTAR_2025_processed_v2.*_final`. Covers Public disclosers with structured `ranked_hazards` only.

> **You can avoid re-running the translation cells for some fixes.** The `ML.TRANSLATE` cells (action / hazard / funding / goal translations, and the `other_segments_map` build) are the slowest and most expensive part of the run — typically 25–60 min combined, dominated by Google Translation API throughput and subject to backend variability. If you're iterating on downstream logic (peer ranking, `fact_action` grouping, `dim` build, etc.) and haven't changed the source text columns or the `static_other_segments_map.sql` curation file, you can skip the translation cells entirely and reuse the existing `*_translated` tables already in `CSTAR_2025_processed_v2`. Resume from the first cell after the translation block.

### 1a. Geometry fixes & missing data → `Missing_Data.*` BQ tables (side input)

Most of `Missing_Data.*` is produced by the separate **[`cdp-geospatial-ops`](https://github.com/CDPworldwide/cdp-geospatial-ops)** repo (source of truth for every geometry correction). Its resolver writes per-account NDJSON that gets loaded into `Missing_Data.geometry-fixes` (managed), `Missing_Data.missing-data` (managed), and `Missing_Data.nondiscloser-geometries` (external, GCS-backed). The exception is `Missing_Data.quezon_Q*`, which mirrors the raw Q-table shape and is hand-maintained in BQ to backfill the disclosure CDP's XLSX export missed.

The main notebook picks up `quezon_Q*`, `geometry-fixes`, and `missing-data`; the post-notebook finalize picks up `geometry-fixes`, `missing-data`, and `nondiscloser-geometries`. See the architecture diagram above for which table feeds which stage, and "Iterating on issues via Stage 1a" for the iterative feedback-loop framing.

For one-off corrections that need to land in Cloud SQL **without** waiting for a full pipeline re-run, hot-patches live in [`one-time-applied/`](one-time-applied/) as `apply_individual_geometry_fix_<org>.sql` or batched as `apply_individual_geometry_fixes_batch_<date>.sql`. Before applying a batch, run [`scripts/check_ecoregion_changes.sql`](../../scripts/check_ecoregion_changes.sql) to flag any disclosers whose ecoregion would shift. See [Post-hoc fixes applied directly to Cloud SQL](#post-hoc-fixes-applied-directly-to-cloud-sql) below for the apply command and the log of what's been run.

### 2. Post-notebook finalize → `*_TEST` BQ tables

[`scripts/CDP CSTAR post-notebook-finalize.ipynb`](../../scripts/CDP%20CSTAR%20post-notebook-finalize.ipynb)

Finishes what the main notebook leaves unfinished. The main notebook only covers Public disclosers with structured `ranked_hazards`; this notebook adds:

- Non-disclosers (`public_status = 'GEE-Derived'`)
- Non-Public disclosers
- Disclosers with NULL or `Other:`-only `ranked_hazards`
- The `'All'`-bucket cross-hazard view in `peer_solutions` / `solution_examples`

Plus it crops mostly-water polygons to land only, applies the Missing_Data geometry replacements (same priority chain as the main notebook — see Stage 1a above), normalizes hazard text, and rebuilds `dim_cdp_geo_and_ecoregion_TEST` — the ecoregion assignment that `peer_solutions` / `solution_examples` join on. Without this stage, non-disclosers have no ecoregion → no peer matches → empty Solutions tab.

Run cell-by-cell from Colab Enterprise (or Jupyter) between the main-notebook rebuild and the migration. Transitional — designed to fold into the main notebook once the SQL stabilizes.

### 3. Migration → Cloud SQL

[`migrate_cstar_2025_via_gcs.sh`](migrate_cstar_2025_via_gcs.sh): BQ `*_TEST` → GCS staging → Cloud SQL (`cdp-test` for dev, `cdp-prod` for prod). Validation runs against staging tables before swapping into the canonical CSTAR tables in one transaction. Source-table mapping:

| Canonical Cloud SQL table        | Default BQ source                |
|----------------------------------|----------------------------------|
| `CSTAR_2025_Dim_Central`         | `dim_cdp_geo_and_ecoregion_TEST` |
| `CSTAR_2025_Fact_Hazard`         | `fact_hazard_final_TEST`         |
| `CSTAR_2025_Fact_Goal`           | `fact_goal_final` (see note below) |
| `CSTAR_2025_Fact_Action`         | `fact_action_final_TEST`         |
| `CSTAR_2025_Fact_Funding_Gap`    | `fact_funding_gap_final_TEST`    |
| `CSTAR_2025_Peer_Solutions`      | `peer_solutions_final_TEST`      |
| `CSTAR_2025_Solution_Examples`   | `solution_examples_TEST`         |

> Note: `fact_goal_final` is the only source that's not `_TEST` — the post-notebook finalize doesn't currently produce a `fact_goal_final_TEST`, so the migration reads the main notebook's output directly.

> The `_TEST` suffix on the other tables is a holdover from when Stage 2 was still iterating; these are the production migration source. Worth renaming eventually.

See **Migration runbook** below for how to invoke.

## Refresh cadence

| Source | Lives at | Refresh trigger |
|---|---|---|
| Raw Q-tables (`CSTAR_2025_v2.Q*`) | `gs://cdp-raw-data-bucket/CSTAR_2025/` → BQ via `bq LOAD` | End of each CDP disclosure cycle (annual) |
| `country_metadata` (FX rates) | `gs://cdp-raw-data-bucket/CSTAR_2025/Countries Metadata - Country Metadata Master List.csv` → BQ via `bq LOAD` | Annual — should be refreshed each cycle. Most recent: 2026-03-04 |
| `Missing_Data.geometry-fixes` (managed) | BQ; NDJSON loaded from `cdp-geospatial-ops` repo | On every geometry correction merged in `cdp-geospatial-ops` |
| `Missing_Data.nondiscloser-geometries` (external) | `gs://cdp-raw-data-bucket/nondiscloser_geometries.ndjson` | On every non-discloser correction in `cdp-geospatial-ops` |
| `Missing_Data.quezon_Q*` (raw overlay) | BQ; hand-maintained | When CDP-export gaps are discovered |
| Notebook `_final` tables | `CSTAR_2025_processed_v2` | On-demand whenever Stage 0 inputs or `Missing_Data.*` change |
| `_TEST` tables | `CSTAR_2025_processed_v2` | Re-run after Stage 1 notebook (unless the only change lives in `fact_goal_final`) |
| Cloud SQL canonical tables | `cdp-test` / `cdp-prod` | After every `_TEST` rebuild that needs to land in the app |

**Full pipeline runs** are infrequent (typically once per CDP disclosure cycle, plus once or twice per year for upstream data corrections). Between full re-runs, urgent geometry fixes can be hot-patched directly against Cloud SQL via `apply_individual_geometry_fix_<org>.sql` files — see [Post-hoc fixes applied directly to Cloud SQL](#post-hoc-fixes-applied-directly-to-cloud-sql). Note that if the ecoregion changes, this will cause the jurisdiction's action ideas from and for other jurisdictions to appear incorrectly (i.e. they will appear based on their incorrect ecoregion).

**FX rate sourcing — revisit.** We currently pull FX rates from a XLSX dataset provided by the CDP team and apply a single fixed rate per country. The team should revisit the sourcing methodology to make sure (1) it's consistent with CDP's broader financial-reporting conventions across other products, and (2) the rates align with each jurisdiction's reporting period — an org disclosing financial figures for the 2025 cycle in their local currency should be converted with a rate that matches when they reported, not the load date of the master list.

**A-list reporters — temporary JSON.** The list of A-list reporting leaders (used to bubble them to the top of the empty-state search suggestions and tag them in the UI via `LocationSuggestion.isReportingLeader`) currently lives as a static JSON of org IDs at [`backend/app/data/cdp_a_list_2025.json`](../app/data/cdp_a_list_2025.json), loaded once at backend startup by [`location_profile_builder.py`](../app/services/impls/location_profile_builder.py). The filename is year-specific — needs a new JSON each cycle and a code change to point at it. Worth moving onto `dim_central` as a column (or a sibling `Missing_Data`-style overlay) so the list refreshes with the rest of the pipeline rather than via PR.

## One-time setup checklist

Before your first end-to-end run, confirm each of these. None should require more than 5 min if your access is already in place.

- [ ] **GCP project access.** `gcloud auth login && gcloud auth application-default login`. Confirm `gcloud config get-value project` returns `project-bb4fd058-24e7-4ccb-b06`.
- [ ] **`roles/cloudsql.client`** on the project (for Cloud SQL proxy). Ask the project owner if you don't have it.
- [ ] **`roles/bigquery.dataEditor`** on `CSTAR_2025_processed_v2` (for notebook + Stage 2 writes) plus read on `CSTAR_2025_v2` and `Missing_Data`.
- [ ] **`roles/storage.objectAdmin`** on `gs://jenny-temp-exports` (for Stage 3 GCS staging) and read on `gs://cdp-raw-data-bucket` (for Stage 0 inputs).
- [ ] **`roles/secretmanager.secretAccessor`** on the project (for `gcloud secrets versions access` calls used by the migration runbook).
- [ ] **Colab Enterprise access** — the notebook runs there. Open the notebook URL once to confirm the runtime spins up against the project.
- [ ] **Cloud Shell or local toolchain.** Cloud Shell is preferred for Stage 3 (sidesteps the macOS Python 3.13 fork+DNS segfault). For local dev work, install `gcloud`, `bq`, `gsutil`, `psql`, Docker.
- [ ] **Secrets fetch works.** Cycle through:
  ```bash
  export PROJECT_ID="project-bb4fd058-24e7-4ccb-b06"
  for s in development-POSTGRES_USER development-POSTGRES_DB development-POSTGRES_PASSWORD; do
    gcloud secrets versions access latest --secret=$s --project=$PROJECT_ID > /dev/null && echo "$s OK" || echo "$s FAILED"
  done
  ```
- [ ] **Proxy starts.** `cd backend/scripts && ./start_cloud_sql_proxy.sh` should log "ready for new connections!" within 10 sec.
- [ ] **Smoke psql** against the proxy (see [Migration runbook](#migration-runbook-cloud-shell) → smoke-test step).
- [ ] **Read the `cdp-geospatial-ops` README** if you'll be touching geometry. That repo's resolver is the source of truth for `Missing_Data.geometry-fixes` and the per-account override registry.

## Migration runbook (Cloud Shell)

Run from Cloud Shell — it has `gcloud`, `bq`, `gsutil`, `psql`, and Docker preinstalled, and doesn't depend on your local network or storage. (An older [`migrate_cstar_2025_from_bigquery.sh`](deprecated/migrate_cstar_2025_from_bigquery.sh) variant also exists but is not kept current — use the `via_gcs` one.)

### Prereqs

- Your Google account has `roles/cloudsql.client` and `roles/secretmanager.secretAccessor` on the project.
- Stage 2's `*_TEST` BQ tables are rebuilt.
- For prod: a recent `SUCCESSFUL` backup on the prod instance (the script checks).
- Env vars set in your shell. Cycle these once at the start of the session:

  ```bash
  export PROJECT_ID="<project-id>"
  # dev:
  export DB_USER=$(gcloud secrets versions access latest --secret=development-POSTGRES_USER --project=$PROJECT_ID)
  export DB_NAME=$(gcloud secrets versions access latest --secret=development-POSTGRES_DB --project=$PROJECT_ID)
  export DB_PASSWORD=$(gcloud secrets versions access latest --secret=development-POSTGRES_PASSWORD --project=$PROJECT_ID)
  # prod uses the same pattern with secret prefix `production-POSTGRES_*`.
  ```

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

**3b. BQ-side validation** (optional but recommended — runs the structural checks before any Cloud SQL data move so failures fail fast):

```bash
bq query --use_legacy_sql=false --project_id="$PROJECT_ID" \
  < ../../scripts/cstar_2025_bq_validation.sql
```

The [§2 dup-PK block](../../scripts/cstar_2025_bq_validation.sql) should return zero rows; §3 should show max=25; §12 should show only long free-text false positives. Anything else means Stage 2 produced bad `_TEST` tables — fix in BQ and re-run Stage 2 before continuing.

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

[`smoke_test_deployment.sh`](smoke_test_deployment.sh) calls `/health`, `/location/<org>`, and a translation endpoint, and asserts expected status codes. Default test org is **834406** — override via `SMOKE_TEST_LOCATION_ORG_ID` / `SMOKE_TEST_TRANSLATION_ORG_ID` if 834406 is mid-rebuild.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `psql: server closed the connection unexpectedly` | Proxy not listening / wrong connection name | `tail /tmp/csproxy.log`; restart proxy |
| `gcloud secrets versions access` returns empty | Stale ADC | `gcloud auth login && gcloud auth application-default login` |
| `409: operation already in progress` during import | Two `gcloud sql import csv` calls overlapping | Restart from `--resume` |
| `hazard duplicate primary keys: <n>` | Upstream dedupe regression in `fact_hazard_final_TEST` (Public+Public dup, or Public+GEE-Derived collision on a 3-col PK) | Fix in BQ, re-run `--resume`. PK is 4-col `(org, rank, year, public_status)` — see [`alter_fact_hazard_pk_include_public_status.sql`](one-time-applied/alter_fact_hazard_pk_include_public_status.sql) |
| `dim rows missing WKT geometry: <n>` | Notebook didn't materialize a centroid for some dim rows | Re-run the `dim_cdp_geo_and_ecoregion` notebook cell with the buffered-geometry CASE |
| Proxy logs `unauthenticated` mid-run | Token expired (~1hr) | Restart proxy, run `--resume` |
| `Validating staging tables (expected counts: dim=-1, ...)` log line | `--resume` mode; `EXPECT_*_ROWS` are populated automatically by the export step on a full run, but `--resume` skips the export so they default to `-1` (skip count assertion). Structural checks (PK uniqueness, WKT) still run. | Expected. To enforce explicit counts on a `--resume`, set the env vars by hand. |

## Notebook logic updates

Substantive logic decisions baked into the notebook in
[`scripts/CDP CSTAR run-to-rule-them-all-ETL.ipynb`](../../scripts/CDP%20CSTAR%20run-to-rule-them-all-ETL.ipynb) that differ from the hand-off version.

### Peer-solutions ranking (now called "action ideas" on the frontend)

> Terminology: surfaced as **action ideas** in the UI. Internally still
> `peer_solutions` / `solution_examples` — renaming the BQ tables would
> cascade too widely.

**Intended logic**: out of every action used by peers in the target's
ecoregion + hazard pool, surface the **top 25 per `(target, hazard_filter)`**,
with **at most 5 per solution category**. For the "All" filter, surface the top 25 most popular across all hazards, with the same 5 per category limit.

**What it was before**: the ranking only enforced "5 per category" and
emitted whatever rows fell out. There was no overall 25-cap and no consistent
tiebreaker, so the set of categories returned could shift between runs.

**What it is now** (cell `c_VBvGaclotV`):

1. `ActionTotals` — count distinct peers per `(target, solution_category, solution, action_english, action_index)`.
2. `HazardRanked` / `HazardCapped` — rank within `(target, hazard, category)` by `action_count DESC, org_count DESC, solution_category, solution` → keep `action_rank <= 5`. Then re-rank within `(target, hazard)` → keep `overall_rank <= 25`.
3. `AllRanked` / `AllCapped` — same shape for the `'All'`-hazard view (aggregates across hazards).

The `solution_category, solution` columns in the `ORDER BY` are
**idempotency tiebreakers** — without them, ties on `action_count`
resolved nondeterministically and the output set drifted run-to-run.

`solution_examples` keeps the legacy **completeness score** for choosing
which peer examples to surface when an action has >10 peers — score
weighs presence of optional detail fields (description worth 10, others
1 each), ranked + capped at 10 examples per `(target, hazard, action)`.
≤10-peer actions surface every available example. This is instead of the original intended 'randomized' choice of examples.

### Same-title actions kept separate

A target city can report **the same `action_english` multiple times**
with different hazards / status / cost / `row_order` — e.g. Matosinhos
has 17 distinct rows for "Government policies and programs actions:
Development of targeted plan/program to address hazard(s) selected".
These are genuinely-different real-world projects under the same
category label.

Previously the `fact_action` build collapsed them all into one row by
grouping on `action_english`, losing 16 of the 17 rows' detail data. We
now include `row_order` in the GROUP BY so each submission stays
distinct. Matching change in Cloud SQL: `row_order` added to the
`Fact_Action` and `Solution_Examples` PKs (see [`add_row_order_pks.sql`](one-time-applied/add_row_order_pks.sql)).

Downstream consequence: when `peer_solutions` joins `fact_action_final`
to set `has_local_action`, it now uses `EXISTS` rather than `LEFT JOIN`
so the row count doesn't multiply by the number of instances a target
recorded of a given action.

### Translation: acronym protection

When given short phrases, Cloud Translate auto-detects language and translates acronyms it doesn't recognize, producing incorrect English translations for acronyms. Protection lives
in cell `translation-acronym-helper-sql`:

- `protect_acronyms(text)` — wraps acronym-shaped tokens in
  `<span translate="no">...</span>` **before** sending to `ML.TRANSLATE`.
  Translate honours the `translate="no"` HTML attribute and leaves the
  wrapped tokens intact.
- `restore_acronyms(translated, original)` — strips the `<span>`
  wrapping after translation and decodes the HTML entities Translate
  emits for apostrophes / ampersands / quotes.

Fires only on **short, mostly-caps single/double tokens** (`LENGTH <= 15`,
≤2 words) so it doesn't mis-fire on real all-caps words. A complementary
detect-language bypass treats short uppercase-heavy tokens as English
directly without round-tripping through Translate — covers cases the
language detector itself misclassifies.

### Translation: `Other:` free-text segments

`hazard_addressed_english` in `fact_action` / `fact_goal` is a
pipe-joined multi-hazard string. The main translator handles structured
hazards fine (`Extreme heat`, `Urban flooding`) but skipped `Other:`
free-text.

Two-layer fix (`other-hazard-map-query` cell):

1. **Static canonical map** — [`scripts/static_other_segments_map.sql`](../../scripts/static_other_segments_map.sql) covers ~135 known terms in various languages, each a clean 1:1 mapping, tagged with a `col_family` (`hazard` / `sectors` / `populations` / `finance`) so each text column's pipeline applies only the relevant subset. Compound segments (multiple distinct hazards joined by `;` / `,`) are intentionally excluded. They fall through to the ML fallback so the multi-hazard issue stays visible rather than being auto-collapsed.
2. **ML.TRANSLATE fallback** — for any segment not in the static map, detect language + translate, same `translation_model` the rest of the pipeline uses.

The combined `other_segments_map` table is applied at the
`CombinedTranslations` step of each `*_translated` cell via a
`SPLIT(...).LEFT JOIN.STRING_AGG` pattern that swaps each segment
through the map and rejoins. Pipe-joined output preserved. This adds considerable time to the processing pipeline, but it becomes worth it given how widespread the issue is.

The consolidation we did was partial, and the team may choose to go further. The static
map collapses language variants (e.g. `Other: Sequías` / `Other: Seca` /
`Other: Sequia` → `Other: Drought`), but doesn't yet canonicalize
English phrasing variants of the same underlying concept. Mexico City
(org 31172) is an example — its actions currently surface
these distinct `Other:` segments which may be able to be merged:

- `Other: Urban heat island effect` (×3)
- `Other: Urban heat islands` (×2)

This would consolidate the number of hazard filters on the frontend. Eventually, the team may also choose to join peer action ideas to these consolidated "Other" type hazards.

### Geometry overlays from `cdp-geospatial-ops`

For jurisdictions whose Overture polygon is wrong, missing, or wildly
off from the reporter's `jdx_areasize`, fixes live in the separate
**`cdp-geospatial-ops`** repo (source of truth). Per-account NDJSONs
are published into BigQuery as `Missing_Data.geometry-fixes` /
`Missing_Data.nondiscloser-geometries` and `COALESCE`-d in during
[`scripts/CDP CSTAR post-notebook-finalize.ipynb`](../../scripts/CDP%20CSTAR%20post-notebook-finalize.ipynb).

For one-off corrections that don't change ecoregion assignment (so
don't need a full re-run), apply directly to Cloud SQL via
`apply_individual_geometry_fix_<org>.sql` in this directory.

End state the team should work toward: the Overture-matching pipeline
in the original notebook produces clean polygons by default and these
fixes aren't needed. Until then, fixes live in `cdp-geospatial-ops` as the
source of truth and get re-published to BigQuery on re-run.

#### Post-hoc fixes applied directly to Cloud SQL

These are geometry corrections that we ran after deployment (10 Jun 2026) — applied as
one-off Cloud SQL hotpatches via `apply_individual_geometry_fix_<org>.sql`
because re-running the full pipeline wasn't warranted. Each fix below
has also been added to `Missing_Data.geometry-fixes`, so the next
pipeline re-run will pick it up automatically and the hotpatch is no longer needed.

Apply through the proxy (cdp-test first, eyeball the RETURNING centroids against the lat/lng comments in the file header, then repoint the proxy and repeat against cdp-prod):

```bash
PGPASSWORD="$DB_PASSWORD" psql \
  "host=127.0.0.1 port=55432 dbname=$DB_NAME user=$DB_USER sslmode=disable" \
  -v ON_ERROR_STOP=1 \
  -f backend/scripts/one-time-applied/apply_individual_geometry_fixes_batch_<date>.sql
```

| Org | Name | Ecoregion changed? | Current → New ecoregion |
|---|---|---|---|
| 74414 | Boulder County, CO | **CHANGE** | Temperate Grasslands, Savannas & Shrublands → Temperate Conifer Forests |
| 862909 | Blaine County, ID | **CHANGE** | Temperate Broadleaf & Mixed Forests → Temperate Conifer Forests |
| 49335 | Nashville/Davidson, TN | unchanged | Temperate Broadleaf & Mixed Forests |
| 74531 | Santa Fe County, NM | unchanged | Deserts & Xeric Shrublands |
| 74575 | Dane County, WI | unchanged | Temperate Grasslands, Savannas & Shrublands |
| 840428 | Hua-Hin Municipality | unchanged | Tropical & Subtropical Moist Broadleaf Forests |
| 862760 | Oxford, OH | unchanged | Temperate Broadleaf & Mixed Forests |
| 896058 | Cruzeiro do Sul, RS | unchanged | Tropical & Subtropical Moist Broadleaf Forests |
| 2012273 | Ocean County, NJ | unchanged | — |

### What gets handled downstream

The notebook covers **Public disclosers with structured `ranked_hazards`**
only. Groups left for the finalize stage
([`scripts/CDP CSTAR post-notebook-finalize.ipynb`](../../scripts/CDP%20CSTAR%20post-notebook-finalize.ipynb)):

- **Non-Public disclosers** — surfaces their own `ranked_hazards`; keeps them out of the *peer* pool so non-public actions don't leak as solutions.
- **Non-disclosers (`GEE-Derived`)** — synthesizes hazards from GEE rasters keyed on org geometry.
- **Public with NULL `ranked_hazards`** — same GEE-synthesis path as non-disclosers.
- **Public with `Other:`-only `ranked_hazards`** — adds GEE-synthesized structured hazards alongside the `Other:` rows. Structured hazards the org already reported (e.g. `Landslides`) take precedence — no double-synthesis.

### Cloud SQL schema changes (what enabled the above)

To support the new logic, two PKs in Cloud SQL were extended. Fresh
DBs get this shape via [`create_empty_tables.sql`](create_empty_tables.sql);
live instances were brought up via the one-off ALTERs in [Schema ALTERs (historical)](#schema-alters-historical) below.

- **`CSTAR_2025_Fact_Hazard`** — added `public_status` to the PK (now `(org, rank, year, public_status)`). Lets a `Public` row and a `GEE-Derived` row coexist at the same rank when the org's disclosed hazards were `Other:`-only and GEE synthesized structured replacements alongside.
- **`CSTAR_2025_Fact_Action`** — added `row_order` to the PK (now `(org, action_index, year, row_order)`). Lets the same `action_english` (so same `action_index`) appear multiple times per org when the city recorded the same action against different hazards / projects / costs.
- **`CSTAR_2025_Solution_Examples`** — added `row_order` to the PK as well. Mirrors the action change — examples come from peers that may have recorded the same action multiple times.

The migration script's column lists in [`migrate_cstar_2025_via_gcs.sh`](migrate_cstar_2025_via_gcs.sh)
were updated to carry the new columns through from BQ `_TEST` → Cloud SQL.

### Future: action-idea consolidation

The static `Other:` map covers the **hazard** side. The **action-idea**
side has the same kind of drift — same project in slightly different
wording or language — but isn't consolidated yet. Examples in
`peer_solutions_final_TEST` today:

- `Other: Arborización` never gets mapped onto the English equivalent.
- `Other: Servicios ecosistémicos` vs `Other: Ecosystem services` — same concept, different strings.
- `Other: pavimentación`, `Other: peatonalización`, `Other: reconversión de luminarias LED` — translatable but not consolidated.

Volume is small (~12 distinct untranslated strings, ~141 rows across
`peer_solutions_final_TEST` / `solution_examples_TEST`). Next-step
shape: a `static_other_action_subcategory_map.sql` mirroring the hazard
one, applied in the `action_translated` cell at `CombinedTranslations`. These approaches may involve some iterative work with the datasets.

## Schema ALTERs (historical)

Fresh DBs use [`create_empty_tables.sql`](create_empty_tables.sql), which now encodes the full PK shape — no separate ALTERs needed. The files below ran once against the live Cloud SQL instances and are kept for reference.

- [`alter_fact_hazard_pk_include_public_status.sql`](one-time-applied/alter_fact_hazard_pk_include_public_status.sql) — adds `public_status` to `CSTAR_2025_Fact_Hazard` PK.
- [`add_row_order_pks.sql`](one-time-applied/add_row_order_pks.sql) — adds `row_order` to `CSTAR_2025_Fact_Action` + `CSTAR_2025_Solution_Examples` PKs.

## Local dev

- [`start_cloud_sql_proxy.sh`](start_cloud_sql_proxy.sh) — Docker proxy → `cdp-test:55432`.
- [`start_dev_server.sh`](start_dev_server.sh) — FastAPI dev server, defaults to the proxy port.
