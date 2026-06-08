-- One-time schema migration for CSTAR_2025_Fact_Action and
-- CSTAR_2025_Solution_Examples.
--
-- Adds `row_order` as a PK component on both tables so two distinct rows
-- with the same (org/year/action_index — plus peer_org_id on Solution_Examples)
-- can coexist (orgs that disclosed two actions with the same action_english
-- title). `action_index` stays global per title to keep peer_solutions /
-- solution_examples aggregation working.
--
-- Apply via the Cloud SQL proxy:
--   PGPASSWORD="$DB_PASSWORD" psql "host=127.0.0.1 port=55432 dbname=$DB_NAME user=$DB_USER sslmode=disable" \
--     -v ON_ERROR_STOP=1 -f backend/scripts/add_row_order_pks.sql

BEGIN;

-- CSTAR_2025_Fact_Action --------------------------------------------------

ALTER TABLE "CSTAR_2025_Fact_Action"
  ADD COLUMN IF NOT EXISTS row_order INTEGER;

UPDATE "CSTAR_2025_Fact_Action" SET row_order = 0 WHERE row_order IS NULL;

ALTER TABLE "CSTAR_2025_Fact_Action"
  ALTER COLUMN row_order SET NOT NULL;

DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = '"CSTAR_2025_Fact_Action"'::regclass
    AND contype = 'p';
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "CSTAR_2025_Fact_Action" DROP CONSTRAINT %I', pk_name);
  END IF;
END $$;

ALTER TABLE "CSTAR_2025_Fact_Action"
  ADD CONSTRAINT "CSTAR_2025_Fact_Action_pkey"
  PRIMARY KEY (cdp_disclosing_org_number, disclosing_year, action_index, row_order);

-- CSTAR_2025_Solution_Examples --------------------------------------------

ALTER TABLE "CSTAR_2025_Solution_Examples"
  ADD COLUMN IF NOT EXISTS row_order INTEGER;

UPDATE "CSTAR_2025_Solution_Examples" SET row_order = 0 WHERE row_order IS NULL;

ALTER TABLE "CSTAR_2025_Solution_Examples"
  ALTER COLUMN row_order SET NOT NULL;

DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT conname INTO pk_name
  FROM pg_constraint
  WHERE conrelid = '"CSTAR_2025_Solution_Examples"'::regclass
    AND contype = 'p';
  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "CSTAR_2025_Solution_Examples" DROP CONSTRAINT %I', pk_name);
  END IF;
END $$;

ALTER TABLE "CSTAR_2025_Solution_Examples"
  ADD CONSTRAINT "CSTAR_2025_Solution_Examples_pkey"
  PRIMARY KEY (disclosing_year, target_org_id, hazard_filter, peer_org_id, action_index, row_order);

COMMIT;

-- Sanity check: verify both PKs.
SELECT
  c.conrelid::regclass AS table_name,
  c.conname AS pk_name,
  pg_get_constraintdef(c.oid) AS pk_definition
FROM pg_constraint c
WHERE c.conrelid IN (
    '"CSTAR_2025_Fact_Action"'::regclass,
    '"CSTAR_2025_Solution_Examples"'::regclass
  )
  AND c.contype = 'p'
ORDER BY table_name;