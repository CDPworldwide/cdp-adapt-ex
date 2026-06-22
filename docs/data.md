# Data Integration & Setup Guide

This repository provides the necessary data to replicate the tool. By following this guide, external developers can set up an independent instance of the dashboard in their own environment.

The application database is populated from seven CSTAR 2025 CSV files mapped to Overture geometry data. The files are generated from CDP's processed BigQuery tables; they are not stored directly in this Git repository.

# Data Privacy and Licensing

* **Public Data Only:** The exported CSV files strictly exclude all non-public disclosure data to prevent the release of confidential information.
* **Licensing:** CSTAR data is licensed for non-commercial use.

# Prerequisites

## Local Database
To set up the database locally, you will need:
* **PostgreSQL (v15+)**: The core database engine.

## GCP Cloud SQL
To host your own instance, you will need:

* A Google Cloud Project with billing enabled.
* A Google Cloud Storage (GCS) bucket to act as a temporary staging area for data import.
* A provisioned Cloud SQL (PostgreSQL) instance or a BigQuery dataset.

## CSV Archive Status

The public CSV archive link is not yet published. Until that release artifact exists, external developers cannot complete a data-backed local setup from this repository alone unless they have been granted access to the source BigQuery project or receive the archive directly from CDP.

Maintainers with BigQuery access can generate the archive with:

```bash
BUCKET=gs://<temporary-export-bucket> \
  ./backend/scripts/export_cstar_2025_csv_archive.sh
```

By default, the export script writes the seven CSVs to GCS, downloads them to `/tmp/cstar_2025_csv_archive`, and creates `/tmp/cstar_2025_csv_archive/cstar_2025_public_csv_archive.zip`. The default `PUBLIC_ONLY=true` mode excludes Non-Public disclosure rows while retaining public disclosures and GEE-derived/non-discloser rows used by the public application.

The archive contains:

| CSV file | Cloud SQL table |
| :---- | :---- |
| `CSTAR_2025_Dim_Central.csv` | `CSTAR_2025_Dim_Central` |
| `CSTAR_2025_Fact_Hazard.csv` | `CSTAR_2025_Fact_Hazard` |
| `CSTAR_2025_Fact_Goal.csv` | `CSTAR_2025_Fact_Goal` |
| `CSTAR_2025_Fact_Action.csv` | `CSTAR_2025_Fact_Action` |
| `CSTAR_2025_Fact_Funding_Gap.csv` | `CSTAR_2025_Fact_Funding_Gap` |
| `CSTAR_2025_Peer_Solutions.csv` | `CSTAR_2025_Peer_Solutions` |
| `CSTAR_2025_Solution_Examples.csv` | `CSTAR_2025_Solution_Examples` |

# Setup Instructions

## 1\. Download Data

Download the published CSV archive, or ask a CDP maintainer for the generated archive above while the public release artifact is pending.

## 2\. Prepare Your Database

* ### Cloud SQL

  If you are using Cloud SQL for the backend:
* **Create Instance:** Set up a Cloud SQL for PostgreSQL instance.
* **Define Schema:** Use `backend/scripts/create_empty_tables.sql` to initialize your tables according to the Table Schema Summary. Ensure all Primary Keys are correctly defined during this step.
* **Staging:** Upload the downloaded CSV files to your Google Cloud Storage bucket.

* ### Local Database

  If you want to load the data into a database locally:
* **Create Database:**
  ```bash
  psql -U postgres -c "CREATE DATABASE cdp;"
  ```
* **Define Schema:** Use `backend/scripts/create_empty_tables.sql` to initialize your tables according to the Table Schema Summary. Ensure all Primary Keys are correctly defined during this step.

## 3\. Import Data

* ### Cloud SQL

  Use the following `gcloud` command to import your CSV files from GCS into your Cloud SQL instance:

  `gcloud sql import csv [INSTANCE_NAME] gs://[BUCKET_NAME]/[FILE_NAME].csv --database=[DATABASE_NAME] --table=[TABLE_NAME]`

  Or use Cloud SQL import UI to import the data.

  For the CDP test Cloud SQL instance used by this repo, start the local proxy from the repository root:

  ```bash
  ./backend/scripts/start_cloud_sql_proxy.sh
  ```

  The proxy connects to `project-bb4fd058-24e7-4ccb-b06:us-central1:cdp-test` and exposes PostgreSQL on `localhost:55432`.

  In a second terminal, resolve the Cloud SQL password and create the empty tables:

  ```bash
  export POSTGRES_PASSWORD="$(gcloud secrets versions access latest \
    --secret=cloudsql_cdp-test \
    --project project-bb4fd058-24e7-4ccb-b06 \
    | perl -ne 'print "$1\n" if /^password:\s*(.+)$/')"

  psql "host=localhost port=55432 dbname=cdp user=postgres sslmode=disable" \
    -f backend/scripts/create_empty_tables.sql
  ```

  If you have access to the CDP BigQuery project, prefer generating the full archive with `backend/scripts/export_cstar_2025_csv_archive.sh`. For a one-off table export, make sure the CSV columns are in the same order as `backend/scripts/create_empty_tables.sql`, then load through the proxy with `psql`:

  ```bash
  mkdir -p /tmp/cstar_2025_processed

  bq query --use_legacy_sql=false --format=csv '
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
    FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
    WHERE public_status IN ("Public", "GEE-Derived")
       OR disclosure_status = "non-disclosed"
  ' > /tmp/cstar_2025_processed/CSTAR_2025_Dim_Central.csv

  psql "host=localhost port=55432 dbname=cdp user=postgres sslmode=disable" <<'SQL'
  \copy "CSTAR_2025_Dim_Central" FROM '/tmp/cstar_2025_processed/CSTAR_2025_Dim_Central.csv' WITH (FORMAT csv, HEADER true)
  SQL
  ```

  The current BigQuery source dataset is `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2`. Row counts depend on whether the export is public-only or internal, so verify them during each archive run rather than relying on the historical snapshot below:

  | BigQuery table | Rows | Cloud SQL table |
  | :---- | ---: | :---- |
  | `CSTAR_2025_processed_v2/dim_cdp_geo_and_ecoregion_TEST` | export-dependent | `CSTAR_2025_Dim_Central` |
  | `CSTAR_2025_processed_v2/fact_hazard_final_TEST` | export-dependent | `CSTAR_2025_Fact_Hazard` |
  | `CSTAR_2025_processed_v2/fact_goal_final` | export-dependent | `CSTAR_2025_Fact_Goal` |
  | `CSTAR_2025_processed_v2/fact_action_final_TEST` | export-dependent | `CSTAR_2025_Fact_Action` |
  | `CSTAR_2025_processed_v2/fact_funding_gap_final_TEST` | export-dependent | `CSTAR_2025_Fact_Funding_Gap` |
  | `CSTAR_2025_processed_v2/peer_solutions_final_TEST` | export-dependent | `CSTAR_2025_Peer_Solutions` |
  | `CSTAR_2025_processed_v2/solution_examples_TEST` | export-dependent | `CSTAR_2025_Solution_Examples` |

  The app expects the Cloud SQL table names shown above. After loading all rows, run the post-load cleanup that converts `geom_wkt` and `centroid_wkt` into PostGIS columns used by the location APIs:

  ```bash
  psql "host=localhost port=55432 dbname=cdp user=postgres sslmode=disable" <<'SQL'
  ALTER TABLE "CSTAR_2025_Dim_Central"
  ADD COLUMN IF NOT EXISTS geometry GEOMETRY(Geometry, 4326);

  ALTER TABLE "CSTAR_2025_Dim_Central"
  ADD COLUMN IF NOT EXISTS centroid GEOMETRY(Geometry, 4326);

  UPDATE "CSTAR_2025_Dim_Central"
  SET
    geometry = ST_GeomFromText(NULLIF(geom_wkt, ''), 4326),
    centroid = ST_GeomFromText(NULLIF(centroid_wkt, ''), 4326)
  WHERE geom_wkt IS NOT NULL AND geom_wkt != '';

  CREATE INDEX IF NOT EXISTS idx_target_table_geom
  ON "CSTAR_2025_Dim_Central" USING GIST (geometry);

  CREATE INDEX IF NOT EXISTS idx_cstar_2025_dim_central_centroid
  ON "CSTAR_2025_Dim_Central" USING GIST (centroid);

  UPDATE "CSTAR_2025_Dim_Central"
  SET "requesting_auth" = REPLACE("requesting_auth", ',', '|')
  WHERE "requesting_auth" LIKE '%,%';
  SQL
  ```

* ### Local Database

  Use the PostgreSQL `psql` utility with the `\copy` command to import the seven downloaded CSV files. Run `backend/scripts/create_empty_tables.sql` first, then import each CSV into the table with the matching name:

  ```sql
  \copy "CSTAR_2025_Dim_Central" FROM 'CSTAR_2025_Dim_Central.csv' WITH (FORMAT csv, HEADER true)
  \copy "CSTAR_2025_Fact_Hazard" FROM 'CSTAR_2025_Fact_Hazard.csv' WITH (FORMAT csv, HEADER true)
  \copy "CSTAR_2025_Fact_Goal" FROM 'CSTAR_2025_Fact_Goal.csv' WITH (FORMAT csv, HEADER true)
  \copy "CSTAR_2025_Fact_Action" FROM 'CSTAR_2025_Fact_Action.csv' WITH (FORMAT csv, HEADER true)
  \copy "CSTAR_2025_Fact_Funding_Gap" FROM 'CSTAR_2025_Fact_Funding_Gap.csv' WITH (FORMAT csv, HEADER true)
  \copy "CSTAR_2025_Peer_Solutions" FROM 'CSTAR_2025_Peer_Solutions.csv' WITH (FORMAT csv, HEADER true)
  \copy "CSTAR_2025_Solution_Examples" FROM 'CSTAR_2025_Solution_Examples.csv' WITH (FORMAT csv, HEADER true)
  ```

## 4\. BigQuery Alternative

For users preferring BigQuery, you can load the CSV files directly into your dataset:

* Create a new dataset in BigQuery.
* Create tables by selecting "Upload" or "Google Cloud Storage" as the source and specifying the CSV format.

# Table Schema Summary

| Tables | Primary Key  | Description |
| :---- | :---- | :---- |
| CSTAR\_2025\_Dim\_Central | `disclosing_year + cdp_disclosing_org_number` | Central dimension table with all jurisdiction level info, including self disclosed and publicly available country/jurisdiction level metadata and geometry |
| CSTAR\_2025\_Fact\_Hazard | `disclosing_year + cdp_disclosing_org_number + hazard_rank + public_status` | Hazards and hazard details reported by CSTAR jurisdictions |
| CSTAR\_2025\_Fact\_Goal | `disclosing_year + cdp_disclosing_org_number + goal_index (unique at org level)` | Adaptation goals and related info reported by CSTAR jurisdictions |
| CSTAR\_2025\_Fact\_Action | `disclosing_year + cdp_disclosing_org_number + action_index + row_order` | Adaptation actions and related info reported by CSTAR jurisdictions  |
| CSTAR\_2025\_Fact\_Funding\_Gap | `disclosing_year + cdp_disclosing_org_number +  project_area_index (unique at CSTAR level) + project_index (unique at org level)` | Planned climate-related projects hoping to attract financing and related info reported by CSTAR jurisdictions |
| CSTAR\_2025\_Peer\_Solutions | `disclosing_year + target_org_id + hazard_filter + action_index` | Adaptation actions taken by jurisdictions sharing the same ecoregion and hazards, with adaptation actions addressing at least one of the top 4 hazards for the jurisdiction.  has\_local\_action indicates if the target org has already taken that action or not. The goal is to help jurisdictions identify additional related actions they can take to address their top hazards  |
| CSTAR\_2025\_Solution\_Examples | `disclosing_year + target_org_id + hazard_filter + peer_org_id + action_index + row_order` | For each target\_org and action pair in the solution table, there are multiple peer\_orgs taking the same action, this table contains the top 10 peers taking that action, ranked based on information completeness. If there’re less than 10 peers taking that action, all are included in the table. |

**Detailed table schema** [here](https://docs.google.com/spreadsheets/d/1l5oe5XY4qyUGDynYzo3aa97dwd-0jOCXAD-RZ45Frr4/edit?pli=1&resourcekey=0-DJ1-bVBMw2E_KHGF6YMcWw&gid=0#gid=0)

# Support and Documentation

For detailed information on configuring the dashboard application to point to your new database instance, please refer to [docs/deployment.md](deployment.md).
