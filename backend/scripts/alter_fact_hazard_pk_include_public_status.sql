-- Extend CSTAR_2025_Fact_Hazard PK to include public_status.
--
-- Reason: the GEE downstream workflow synthesizes a hazard row at the same
-- (org, hazard_rank, disclosing_year) as an existing Public row for orgs
-- whose only disclosed entries are unstructured 'Other:' free-text. Both
-- rows are intentional; we want both visible. Without public_status in
-- the PK, the swap fails with "duplicate primary keys".
--
-- Safe to re-run: each step is idempotent.

BEGIN;

ALTER TABLE "CSTAR_2025_Fact_Hazard"
  DROP CONSTRAINT IF EXISTS "CSTAR_2025_Fact_Hazard_pkey";

-- public_status is non-NULL for every row in v2 ('Public' or 'GEE-Derived');
-- enforce that as a precondition for the new PK. The UPDATE is a defensive
-- backstop in case any future row arrives with NULL — sets it to 'unknown'
-- rather than failing the ALTER outright.
UPDATE "CSTAR_2025_Fact_Hazard"
SET public_status = 'unknown'
WHERE public_status IS NULL;

ALTER TABLE "CSTAR_2025_Fact_Hazard"
  ALTER COLUMN public_status SET NOT NULL;

ALTER TABLE "CSTAR_2025_Fact_Hazard"
  ADD PRIMARY KEY (
    cdp_disclosing_org_number,
    hazard_rank,
    disclosing_year,
    public_status
  );

COMMIT;

-- Verify the new PK is in place
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public."CSTAR_2025_Fact_Hazard"'::regclass
  AND contype = 'p';
