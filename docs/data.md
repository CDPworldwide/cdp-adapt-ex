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
* **Define Schema:** Use the [this SQL script](create_empty_tables.sql) to initialize your tables according to the Table Schema Summary. Ensure all Primary Keys are correctly defined during this step.
* **Staging:** Upload the downloaded CSV files to your Google Cloud Storage bucket.

* ### Local Database

  If you want to load the data into a database locally:
* **Create Database:**
  ```bash
  psql -U postgres -c "CREATE DATABASE cdp;"
  ```
* **Define Schema:** Use the [this SQL script](create_empty_tables.sql) to initialize your tables according to the Table Schema Summary. Ensure all Primary Keys are correctly defined during this step.

## 3\. Import Data

* ### Cloud SQL

  Use the following `gcloud` command to import your CSV files from GCS into your Cloud SQL instance:

  `gcloud sql import csv [INSTANCE_NAME] gs://[BUCKET_NAME]/[FILE_NAME].csv --database=[DATABASE_NAME] --table=[TABLE_NAME]`

  Or use Cloud SQL import UI to import the data.

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

For detailed information on configuring the dashboard application to point to your new database instance, please refer to the technical documentation at `docs/deployment/README.md`.
