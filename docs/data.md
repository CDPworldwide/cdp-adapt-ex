#  Data Integration & Setup Guide

This repository provides the necessary data to replicate the tool. By following this guide, external developers can set up an independent instance of the dashboard in their own environment.

We provide a static data dump consisting of CSTAR entities mapped to Overture geometry data. This combined dataset allows for a 1:1 replication of the product without requiring access to CDP's internal services.

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

# Setup Instructions

## 1\. Download Data

Download the data archive (7 CSV files) from (**TODO: ADD LINK**).

## 2\. Prepare Your Database

* ### Cloud SQL

  If you are using Cloud SQL for the backend:
* **Create Instance:** Set up a Cloud SQL for PostgreSQL instance.
* **Define Schema:** Use `scripts/create_empty_tables.sql` to initialize your tables according to the Table Schema Summary. Ensure all Primary Keys are correctly defined during this step.
* **Staging:** Upload the downloaded CSV files to your Google Cloud Storage bucket.

* ### Local Database

  If you want to load the data into a database locally:
* **Create Database:**
  ```bash
  psql -U postgres -c "CREATE DATABASE cdp;"
  ```
* **Define Schema:** Use `scripts/create_empty_tables.sql` to initialize your tables according to the Table Schema Summary. Ensure all Primary Keys are correctly defined during this step.

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
    -f scripts/create_empty_tables.sql
  ```

  If the source data is already staged in BigQuery, export each table to CSV with columns in the same order as `scripts/create_empty_tables.sql`, then load through the proxy with `psql`:

  ```bash
  mkdir -p /tmp/cstar_2025_processed

  bq query --use_legacy_sql=false --format=csv \
    'SELECT * FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.dim_cdp_geo_and_ecoregion_TEST`' \
    > /tmp/cstar_2025_processed/CSTAR_2025_Dim_Central.csv

  psql "host=localhost port=55432 dbname=cdp user=postgres sslmode=disable" <<'SQL'
  \copy "CSTAR_2025_Dim_Central" FROM '/tmp/cstar_2025_processed/CSTAR_2025_Dim_Central.csv' WITH (FORMAT csv, HEADER true)
  SQL
  ```

  The following BigQuery source tables were verified in `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed` on 2026-05-06:

  | BigQuery table | Rows | Cloud SQL table |
  | :---- | ---: | :---- |
  | `CSTAR_2025_processed/dim_cdp_geo_and_ecoregion_TEST` | 1,925 | `CSTAR_2025_Dim_Central` |
  | `CSTAR_2025_processed/fact_hazard_final_TEST` | 8,480 | `CSTAR_2025_Fact_Hazard` |
  | `CSTAR_2025_processed/fact_goal_final_TEST` | 4,577 | `CSTAR_2025_Fact_Goal` |
  | `CSTAR_2025_processed/fact_action_final_TEST` | 5,623 | `CSTAR_2025_Fact_Action` |
  | `CSTAR_2025_processed/fact_funding_gap_final_TEST` | 3,053 | `CSTAR_2025_Fact_Funding_Gap` |
  | `CSTAR_2025_processed/peer_solutions_final_TEST` | 133,466 | `CSTAR_2025_Peer_Solutions` |
  | `CSTAR_2025_processed/solution_examples_TEST` | 566,216 | `CSTAR_2025_Solution_Examples` |

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

  Use the PostgreSQL `psql` utility with the `\copy` command to import the 7 downloaded CSV files:
  `\copy [TABLE_NAME] FROM '[FILE_NAME].csv' WITH (FORMAT CSV, HEADER TRUE, DELIMITER ',');`

## 4\. BigQuery Alternative

For users preferring BigQuery, you can load the CSV files directly into your dataset:

* Create a new dataset in BigQuery.
* Create tables by selecting "Upload" or "Google Cloud Storage" as the source and specifying the CSV format.

# Table Schema Summary

| Tables | Primary Key  | Description |
| :---- | :---- | :---- |
| CSTAR\_2025\_Dim\_Central | `disclosing_year + cdp_disclosing_org_number` | Central dimension table with all jurisdiction level info, including self disclosed and publicly available country/jurisdiction level metadata and geometry |
| CSTAR\_2025\_Fact\_Hazard | `disclosing_year + cdp_disclosing_org_number + hazard_rank` | Hazards and hazard details reported by CSTAR jurisdictions |
| CSTAR\_2025\_Fact\_Goal | `disclosing_year + cdp_disclosing_org_number + goal_index (unique at org level)` | Adaptation goals and related info reported by CSTAR jurisdictions |
| CSTAR\_2025\_Fact\_Action | `disclosing_year + cdp_disclosing_org_number + action_index (unique at CSTAR level for easy solution sample retrieval)` | Adaptation actions and related info reported by CSTAR jurisdictions  |
| CSTAR\_2025\_Fact\_Funding\_Gap | `disclosing_year + cdp_disclosing_org_number +  project_area_index (unique at CSTAR level) + project_index (unique at org level)` | Planned climate-related projects hoping to attract financing and related info reported by CSTAR jurisdictions |
| CSTAR\_2025\_Peer\_Solutions | `disclosing_year + target_org_id + action_index` | Adaptation actions taken by jurisdictions sharing the same ecoregion and hazards, with adaptation actions addressing at least one of the top 4 hazards for the jurisdiction.  has\_local\_action indicates if the target org has already taken that action or not. The goal is to help jurisdictions identify additional related actions they can take to address their top hazards  |
| CSTAR\_2025\_Solution\_Examples | `disclosing_year + target_org_id + peer_org_id + action_index` | For each target\_org and action pair in the solution table, there are multiple peer\_orgs taking the same action, this table contains the top 10 peers taking that action, ranked based on information completeness. If there’re less than 10 peers taking that action, all are included in the table. |

**Detailed table schema** [here](https://docs.google.com/spreadsheets/d/1l5oe5XY4qyUGDynYzo3aa97dwd-0jOCXAD-RZ45Frr4/edit?pli=1&resourcekey=0-DJ1-bVBMw2E_KHGF6YMcWw&gid=0#gid=0)

# Support and Documentation

For detailed information on configuring the dashboard application to point to your new database instance, please refer to [docs/deployment.md](deployment.md).
