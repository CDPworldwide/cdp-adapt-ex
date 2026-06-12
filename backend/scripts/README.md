# backend/scripts

Operational scripts for the **Cloud SQL** side of backend dev — proxy + dev
server, the BQ → Cloud SQL migration, post-deploy smoke tests, and DDL +
applied hot-patch SQL.

For the full BQ → Cloud SQL data-pipeline runbook (Stage 1 notebook → Stage
2 finalize → Stage 3 migration), see
[`docs/data_pipeline.md`](../../docs/data_pipeline.md).

## Contents

- [`migrate_cstar_2025_via_gcs.sh`](migrate_cstar_2025_via_gcs.sh) — BQ
  `*_TEST` → GCS staging → Cloud SQL migration (Stage 3 of the data pipeline).
  Full runbook: [`docs/data_pipeline.md`](../../docs/data_pipeline.md#migration-runbook-cloud-shell).
- [`start_cloud_sql_proxy.sh`](start_cloud_sql_proxy.sh) — Docker Cloud SQL
  Auth Proxy → `cdp-test:55432`. Repoint at `cdp-prod` by editing
  `INSTANCE_CONNECTION_NAME`.
- [`start_dev_server.sh`](start_dev_server.sh) — FastAPI dev server,
  defaults to the proxy port.
- [`smoke_test_deployment.sh`](smoke_test_deployment.sh) — post-deploy
  endpoint smoke test (`/health`, `/location/<org>`, translation).
- [`create_empty_tables.sql`](create_empty_tables.sql) — canonical Cloud SQL
  DDL. Fresh DBs use this and inherit the full PK shape.
- [`audit_funding_acronym_translations.sh`](audit_funding_acronym_translations.sh)
  — one-off audit script for translation acronym handling.
- [`one-time-applied/`](one-time-applied/) — ALTERs and geometry hot-patches
  that have already run against the live Cloud SQL instances. Kept for
  reference (and so the next full pipeline run picks them up).
- [`deprecated/`](deprecated/) — older `migrate_cstar_2025_from_bigquery.sh`
  variant; not kept current. Use `migrate_cstar_2025_via_gcs.sh` instead.
