-- CSTAR 2025 BigQuery validation suite.
--
-- Run after the notebook + post_notebook_finalize_tables.sql rebuild the
-- _final / _TEST tables, before kicking off migrate_cstar_2025_via_gcs.sh.
-- Mirrors the structural checks the migration script runs against Cloud
-- SQL staging — a clean pass here means migration won't trip on dup-PKs
-- or missing geometry.
--
-- Project / dataset / source tables are hardcoded to the migration
-- script's defaults; edit inline if pointing elsewhere.
--
-- Pass criteria: each section documents its expectation inline. General
-- rule — dup-PK / cap / completeness queries should all return zero rows.

-- ============================================================
-- 1. Row counts (sanity sweep)
-- ============================================================
SELECT 'dim_cdp_geo_and_ecoregion_TEST' AS tbl, COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
UNION ALL SELECT 'fact_hazard_final_TEST',      COUNT(*)
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
UNION ALL SELECT 'fact_goal_final_TEST',             COUNT(*)
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`
UNION ALL SELECT 'fact_action_final_TEST',      COUNT(*)
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`
UNION ALL SELECT 'fact_funding_gap_final_TEST', COUNT(*)
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_funding_gap_final_TEST`
UNION ALL SELECT 'peer_solutions_final_TEST',   COUNT(*)
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
UNION ALL SELECT 'solution_examples_TEST',      COUNT(*)
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`
ORDER BY tbl;

-- ============================================================
-- 2. Duplicate-PK checks (must each return zero rows)
-- ============================================================

-- dim: (org, year)
SELECT cdp_disclosing_org_number, disclosing_year, COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
GROUP BY 1, 2 HAVING n > 1;

-- hazard: (org, rank, year, public_status) -- 4-col PK after the ALTER
SELECT cdp_disclosing_org_number, hazard_rank, disclosing_year, public_status, COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
GROUP BY 1, 2, 3, 4 HAVING n > 1;

-- goal: (org, year, goal_index)
SELECT cdp_disclosing_org_number, disclosing_year, goal_index, COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`
GROUP BY 1, 2, 3 HAVING n > 1;

-- action: (org, year, action_index, row_order)
SELECT cdp_disclosing_org_number, disclosing_year, action_index, row_order, COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`
GROUP BY 1, 2, 3, 4 HAVING n > 1;

-- funding gap: (org, year, project_area_index, project_index)
SELECT cdp_disclosing_org_number, disclosing_year, project_area_index, project_index, COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_funding_gap_final_TEST`
GROUP BY 1, 2, 3, 4 HAVING n > 1;

-- peer solutions: (year, target_org_id, hazard_filter, action_index)
SELECT disclosing_year, target_org_id, hazard_filter, action_index, COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
GROUP BY 1, 2, 3, 4 HAVING n > 1;

-- solution examples: (year, target_org_id, hazard_filter, peer_org_id, action_index, row_order)
-- row_order disambiguates same title action rows
SELECT disclosing_year, target_org_id, hazard_filter, peer_org_id, action_index, row_order, COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`
GROUP BY 1, 2, 3, 4, 5, 6 HAVING n > 1;

-- ============================================================
-- 3. Peer-solutions <=25 per (target_org, hazard_filter)
--
-- The notebook (cell c_VBvGaclotV) caps to 5 per category, then 25
-- overall per (target, hazard). These queries are regression detectors
-- -- a hit means the cap logic broke upstream.
-- ============================================================

-- Any group over the 25 cap (should be empty).
SELECT
  target_org_id,
  hazard_filter,
  COUNT(*) AS n_solutions
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
GROUP BY target_org_id, hazard_filter
HAVING n_solutions > 25
ORDER BY n_solutions DESC;

-- Distribution of group sizes (all rows should land in <=25 buckets).
SELECT
  CASE
    WHEN n_solutions <= 10 THEN '01_le_10'
    WHEN n_solutions <= 20 THEN '02_11_to_20'
    WHEN n_solutions <= 25 THEN '03_21_to_25'
    WHEN n_solutions <= 30 THEN '04_26_to_30'
    ELSE                         '05_gt_30'
  END AS bucket,
  COUNT(*) AS n_groups
FROM (
  SELECT target_org_id, hazard_filter, COUNT(*) AS n_solutions
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
  GROUP BY target_org_id, hazard_filter
)
GROUP BY bucket
ORDER BY bucket;

-- Same cap, applied to solution_examples for consistency.
SELECT
  target_org_id,
  hazard_filter,
  COUNT(*) AS n_examples
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`
GROUP BY target_org_id, hazard_filter
HAVING n_examples > 25
ORDER BY n_examples DESC;

-- ============================================================
-- 4. Dim geometry / centroid / public-status completeness
-- ============================================================
SELECT
  COUNTIF(geometry IS NOT NULL) AS with_geometry,
  COUNTIF(geometry IS NULL)     AS missing_geometry,
  COUNTIF(centroid IS NOT NULL) AS with_centroid,
  COUNTIF(centroid IS NULL)     AS missing_centroid,
  COUNTIF(public_status = 'Public') AS public_rows,
  COUNTIF(disclosure_status = 'non-disclosed') AS non_disclosed_rows
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`;

-- ============================================================
-- 5. Sentinel orgs (Quezon, Hoje-Taastrup, Lulea)
--
-- Quezon wasn't in the original data migration — it had to go in via
-- Missing_Data (populated from the cdp-geospatial-ops repo, which
-- holds every geometry fix we've applied). Kept as a sentinel here
-- to confirm the geometry-fixes path still surfaces it.
-- ============================================================
SELECT
  cdp_disclosing_org_number,
  disclosing_organization,
  public_status,
  geometry IS NOT NULL AS has_geometry
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
WHERE cdp_disclosing_org_number IN (54348, 58489, 60226)
ORDER BY cdp_disclosing_org_number;

-- ============================================================
-- 6. Coverage: every dim org has hazards + peer solutions + examples
--
-- Returns offender list. Zero rows = full coverage.
-- Non-Public disclosers intentionally have no hazards/peer rows in the
-- public-facing tables; uncomment the filter in `dim` if you want to
-- scope the check to disclosing orgs only.
--
-- Known expected exceptions (these are data gaps, not regressions):
--   - Anchorage
--   - <TBD second org>
-- ============================================================
WITH dim AS (
  SELECT DISTINCT cdp_disclosing_org_number, disclosing_organization, public_status, disclosure_status
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  -- WHERE COALESCE(public_status, '') <> 'Non-Public'
),
haz AS (
  SELECT DISTINCT cdp_disclosing_org_number
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
  WHERE public_status IN ('Public', 'GEE-Derived')
),
peer AS (
  SELECT DISTINCT target_org_id AS cdp_disclosing_org_number
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
),
examples AS (
  SELECT DISTINCT target_org_id AS cdp_disclosing_org_number
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`
)
SELECT
  d.cdp_disclosing_org_number,
  d.disclosing_organization,
  d.public_status,
  d.disclosure_status,
  h.cdp_disclosing_org_number IS NOT NULL AS has_hazards,
  p.cdp_disclosing_org_number IS NOT NULL AS has_peer_solutions,
  e.cdp_disclosing_org_number IS NOT NULL AS has_solution_examples
FROM dim d
LEFT JOIN haz      h USING (cdp_disclosing_org_number)
LEFT JOIN peer     p USING (cdp_disclosing_org_number)
LEFT JOIN examples e USING (cdp_disclosing_org_number)
WHERE h.cdp_disclosing_org_number IS NULL
   OR p.cdp_disclosing_org_number IS NULL
   OR e.cdp_disclosing_org_number IS NULL
ORDER BY has_hazards, has_peer_solutions, has_solution_examples, d.cdp_disclosing_org_number;

-- Summary roll-up (handy snapshot before the offender list).
WITH dim AS (
  SELECT DISTINCT cdp_disclosing_org_number
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
),
haz AS (
  SELECT DISTINCT cdp_disclosing_org_number
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
  WHERE public_status IN ('Public', 'GEE-Derived')
),
peer AS (
  SELECT DISTINCT target_org_id AS cdp_disclosing_org_number
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
),
examples AS (
  SELECT DISTINCT target_org_id AS cdp_disclosing_org_number
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`
)
SELECT
  COUNT(*) AS n_dim_orgs,
  COUNTIF(h.cdp_disclosing_org_number IS NULL) AS missing_hazards,
  COUNTIF(p.cdp_disclosing_org_number IS NULL) AS missing_peer_solutions,
  COUNTIF(e.cdp_disclosing_org_number IS NULL) AS missing_solution_examples,
  COUNTIF(h.cdp_disclosing_org_number IS NOT NULL
       AND p.cdp_disclosing_org_number IS NOT NULL
       AND e.cdp_disclosing_org_number IS NOT NULL) AS fully_covered
FROM dim d
LEFT JOIN haz      h USING (cdp_disclosing_org_number)
LEFT JOIN peer     p USING (cdp_disclosing_org_number)
LEFT JOIN examples e USING (cdp_disclosing_org_number);

-- ============================================================
-- 7. Non-discloser peer-solutions caps (5/category, 25/hazard_filter)
--
-- Non-disclosers (disclosure_status = 'non-disclosed') must obey the
-- same caps as disclosers, including the 'All' hazard_filter row.
-- Each sub-query should return zero rows.
-- ============================================================
-- 7a. Solution-category cap: max 5 solutions per (target, hazard_filter,
--     solution_category). Includes hazard_filter = 'All'.
WITH non_disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status = 'non-disclosed'
),
nd_solutions AS (
  SELECT ps.*
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
  INNER JOIN non_disclosers nd USING (target_org_id)
)
SELECT
  target_org_id,
  hazard_filter,
  solution_category,
  COUNT(*) AS n_in_category
FROM nd_solutions
GROUP BY target_org_id, hazard_filter, solution_category
HAVING n_in_category > 5
ORDER BY n_in_category DESC, target_org_id, hazard_filter, solution_category;

-- 7b. Overall cap: max 25 solutions per (target, hazard_filter).
--     Explicitly enumerates the 'All' row so a zero result here is a
--     positive confirmation that the 'All' branch is also capped.
WITH non_disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status = 'non-disclosed'
),
nd_solutions AS (
  SELECT ps.*
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
  INNER JOIN non_disclosers nd USING (target_org_id)
)
SELECT
  target_org_id,
  hazard_filter,
  COUNT(*) AS n_solutions
FROM nd_solutions
GROUP BY target_org_id, hazard_filter
HAVING n_solutions > 25
ORDER BY n_solutions DESC, target_org_id, hazard_filter;

-- 7c. Coverage sanity: every non-discloser surfaces at least one row
--     in peer_solutions (including the 'All' bucket). If a non-discloser
--     has no 'All' row, the 'All' branch missed them.
WITH non_disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status = 'non-disclosed'
),
nd_all_filter AS (
  SELECT DISTINCT target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
  WHERE hazard_filter = 'All'
)
SELECT nd.target_org_id
FROM non_disclosers nd
LEFT JOIN nd_all_filter a USING (target_org_id)
WHERE a.target_org_id IS NULL
ORDER BY nd.target_org_id;

-- 7d. Bucket distribution restricted to non-disclosers, split by
--     hazard_filter = 'All' vs specific hazards (sanity snapshot).
WITH non_disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status = 'non-disclosed'
),
nd_groups AS (
  SELECT
    ps.target_org_id,
    ps.hazard_filter,
    IF(ps.hazard_filter = 'All', 'All', 'specific_hazard') AS filter_kind,
    COUNT(*) AS n_solutions
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
  INNER JOIN non_disclosers nd USING (target_org_id)
  GROUP BY 1, 2
)
SELECT
  filter_kind,
  CASE
    WHEN n_solutions <= 10 THEN '01_le_10'
    WHEN n_solutions <= 20 THEN '02_11_to_20'
    WHEN n_solutions <= 25 THEN '03_21_to_25'
    WHEN n_solutions <= 30 THEN '04_26_to_30'
    ELSE                         '05_gt_30'
  END AS bucket,
  COUNT(*) AS n_groups
FROM nd_groups
GROUP BY filter_kind, bucket
ORDER BY filter_kind, bucket;

-- ============================================================
-- 8. Discloser peer-solutions caps (5/category, 25/hazard_filter)
--
-- Mirrors section 7 for disclosers (disclosure_status IS DISTINCT FROM
-- 'non-disclosed'). Each sub-query should return zero rows.
-- ============================================================

-- 8a. Solution-category cap: max 5 per (target, hazard_filter, solution_category).
WITH disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status IS DISTINCT FROM 'non-disclosed'
),
d_solutions AS (
  SELECT ps.*
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
  INNER JOIN disclosers d USING (target_org_id)
)
SELECT
  target_org_id,
  hazard_filter,
  solution_category,
  COUNT(*) AS n_in_category
FROM d_solutions
GROUP BY target_org_id, hazard_filter, solution_category
HAVING n_in_category > 5
ORDER BY n_in_category DESC, target_org_id, hazard_filter, solution_category;

-- 8b. Overall cap: max 25 per (target, hazard_filter), 'All' included.
WITH disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status IS DISTINCT FROM 'non-disclosed'
),
d_solutions AS (
  SELECT ps.*
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
  INNER JOIN disclosers d USING (target_org_id)
)
SELECT
  target_org_id,
  hazard_filter,
  COUNT(*) AS n_solutions
FROM d_solutions
GROUP BY target_org_id, hazard_filter
HAVING n_solutions > 25
ORDER BY n_solutions DESC, target_org_id, hazard_filter;

-- 8c. Coverage sanity: every discloser has an 'All' bucket row.
WITH disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status IS DISTINCT FROM 'non-disclosed'
),
d_all_filter AS (
  SELECT DISTINCT target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
  WHERE hazard_filter = 'All'
)
SELECT d.target_org_id
FROM disclosers d
LEFT JOIN d_all_filter a USING (target_org_id)
WHERE a.target_org_id IS NULL
ORDER BY d.target_org_id;

-- 8d. Bucket distribution split by 'All' vs specific hazards.
WITH disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status IS DISTINCT FROM 'non-disclosed'
),
d_groups AS (
  SELECT
    ps.target_org_id,
    ps.hazard_filter,
    IF(ps.hazard_filter = 'All', 'All', 'specific_hazard') AS filter_kind,
    COUNT(*) AS n_solutions
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
  INNER JOIN disclosers d USING (target_org_id)
  GROUP BY 1, 2
)
SELECT
  filter_kind,
  CASE
    WHEN n_solutions <= 10 THEN '01_le_10'
    WHEN n_solutions <= 20 THEN '02_11_to_20'
    WHEN n_solutions <= 25 THEN '03_21_to_25'
    WHEN n_solutions <= 30 THEN '04_26_to_30'
    ELSE                         '05_gt_30'
  END AS bucket,
  COUNT(*) AS n_groups
FROM d_groups
GROUP BY filter_kind, bucket
ORDER BY filter_kind, bucket;

-- ============================================================
-- 9. peer_solutions <-> solution_examples alignment (_TEST tables)
--
-- Scoped to DISCLOSERS only.
--
-- The _TEST tables aren't a clean snapshot of the _final tables: the
-- second-pipeline (non-discloser/GEE) workflow adds net-new rows to
-- peer_solutions_final_TEST without always populating
-- solution_examples_TEST. So strict alignment is only required for
-- discloser targets.
--
-- Empirically, broken down by hazard_filter kind:
--   specific_hazard discloser rows: zero orphans -- alignment holds.
--   All_branch discloser rows: a small fraction (~2%) are orphans.
--     This is a real gap, not structural -- peer_list_filtered does
--     carry top_hazard='All' rows for most targets, and 98% of the
--     All branch produces examples. Worth tracking the trend.
--
-- Expected (disclosers):
--   9a: zero rows. Discloser example pointing at a solution that
--       was capped out of peer_solutions_final_TEST.
--   9b: small or zero. Discloser peer-solution with no example to
--       render. Small counts can be legitimate (no usable
--       fact_action row); large counts mean cell WyyjG56RePFx is
--       dropping rows.
--   9c: zero rows. Drift between action_index in the two tables.
--   9d: one-row summary roll-up (disclosers).
--
-- Informational (no pass/fail):
--   9e: same orphan counts for non-disclosers. Net-new from the
--       second pipeline -- expect a non-trivial number here, just
--       useful to track over time.
-- ============================================================

-- 9a. Discloser solution_examples rows whose key is absent from peer_solutions
--     (hazard_filter = 'All' excluded -- structural, see header).
WITH disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status IS DISTINCT FROM 'non-disclosed'
)
SELECT
  se.target_org_id,
  se.hazard_filter,
  se.action_english,
  COUNT(*) AS orphan_example_rows
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST` se
INNER JOIN disclosers d USING (target_org_id)
LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
  ON  se.target_org_id  = ps.target_org_id
  AND se.hazard_filter  = ps.hazard_filter
  AND se.action_english = ps.action_english
WHERE ps.target_org_id IS NULL
GROUP BY se.target_org_id, se.hazard_filter, se.action_english
ORDER BY orphan_example_rows DESC, se.target_org_id, se.hazard_filter;

-- 9b. Discloser peer_solutions rows with no matching example
--     (hazard_filter = 'All' excluded -- structural, see header).
WITH disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status IS DISTINCT FROM 'non-disclosed'
)
SELECT
  ps.target_org_id,
  ps.hazard_filter,
  ps.action_english,
  ps.action_count,
  ps.action_rank
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
INNER JOIN disclosers d USING (target_org_id)
LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST` se
  ON  ps.target_org_id  = se.target_org_id
  AND ps.hazard_filter  = se.hazard_filter
  AND ps.action_english = se.action_english
WHERE se.target_org_id IS NULL
ORDER BY ps.action_count DESC, ps.target_org_id, ps.hazard_filter;

-- 9c. Discloser action_index drift between the two tables
--     (hazard_filter = 'All' excluded -- structural, see header).
WITH disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status IS DISTINCT FROM 'non-disclosed'
)
SELECT
  ps.target_org_id,
  ps.hazard_filter,
  ps.action_english,
  ps.action_index AS peer_solutions_action_index,
  se.action_index AS solution_examples_action_index,
  COUNT(*) AS n_rows
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
INNER JOIN disclosers d USING (target_org_id)
INNER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST` se
  ON  ps.target_org_id  = se.target_org_id
  AND ps.hazard_filter  = se.hazard_filter
  AND ps.action_english = se.action_english
WHERE ps.action_index IS DISTINCT FROM se.action_index
GROUP BY 1, 2, 3, 4, 5
ORDER BY n_rows DESC;

-- 9d. Summary roll-up: discloser slice + non-discloser slice side by side.
WITH dim AS (
  SELECT DISTINCT
    cdp_disclosing_org_number AS target_org_id,
    CASE WHEN disclosure_status = 'non-disclosed' THEN 'non_discloser' ELSE 'discloser' END AS target_kind
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
),
ps AS (
  SELECT p.*, d.target_kind
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` p
  LEFT JOIN dim d USING (target_org_id)
),
se AS (
  SELECT s.*, d.target_kind
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST` s
  LEFT JOIN dim d USING (target_org_id)
)
SELECT
  COALESCE(ps.target_kind, se.target_kind, 'no_dim_row') AS target_kind,
  COUNTIF(ps.target_org_id IS NOT NULL) AS peer_solutions_rows,
  COUNTIF(se.target_org_id IS NOT NULL) AS solution_examples_rows,
  COUNTIF(se.target_org_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM ps p2
    WHERE p2.target_org_id  = se.target_org_id
      AND p2.hazard_filter  = se.hazard_filter
      AND p2.action_english = se.action_english
  )) AS orphan_example_rows,
  COUNTIF(ps.target_org_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM se s2
    WHERE s2.target_org_id  = ps.target_org_id
      AND s2.hazard_filter  = ps.hazard_filter
      AND s2.action_english = ps.action_english
  )) AS solutions_without_examples
FROM ps FULL OUTER JOIN se
  ON  ps.target_org_id  = se.target_org_id
  AND ps.hazard_filter  = se.hazard_filter
  AND ps.action_english = se.action_english
GROUP BY target_kind
ORDER BY target_kind;

-- 9e. Informational: non-discloser orphan breakdown (expected to be nonzero;
--     useful to track drift over time, not a pass/fail check).
WITH non_disclosers AS (
  SELECT DISTINCT cdp_disclosing_org_number AS target_org_id
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST`
  WHERE disclosure_status = 'non-disclosed'
)
SELECT
  'orphan_examples_for_non_disclosers' AS metric,
  COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST` se
INNER JOIN non_disclosers nd USING (target_org_id)
LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
  ON  se.target_org_id  = ps.target_org_id
  AND se.hazard_filter  = ps.hazard_filter
  AND se.action_english = ps.action_english
WHERE ps.target_org_id IS NULL
UNION ALL
SELECT
  'solutions_without_examples_for_non_disclosers' AS metric,
  COUNT(*) AS n
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` ps
INNER JOIN non_disclosers nd USING (target_org_id)
LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST` se
  ON  ps.target_org_id  = se.target_org_id
  AND ps.hazard_filter  = se.hazard_filter
  AND ps.action_english = se.action_english
WHERE se.target_org_id IS NULL;

-- ============================================================
-- 10. Post-translation-fix validation (notebook re-run).
--
-- Verifies the new other_hazard_segments_map cell ran and that the
-- CombinedTranslations patch in 4dzZkdt9T-8M / eBK6kws2bwoU /
-- uxWYq-YZT-1B propagated through downstream tables.
-- ============================================================

-- 10a. Map exists, has expected size, no duplicate raw keys, no NULLs.
SELECT
  COUNT(*) AS n_rows,
  COUNT(DISTINCT raw) AS n_distinct_raw,
  COUNTIF(raw IS NULL OR clean IS NULL) AS n_null
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.other_hazard_segments_map`;
-- Expect: n_rows >= 50, n_rows = n_distinct_raw (no dupes), n_null = 0.

-- 10b. None of the static-map raw segments should still appear in any
--      downstream hazard field. Returns the segments still present
--      and where (zero rows = clean).
WITH static_raw AS (
  SELECT raw FROM UNNEST([
    'Other: Granizo', 'Other: Chuvas de granizo',
    'Other: Radiación UV', 'Other: Radiacion UV',
    'Other: Seca', 'Other: Secas', 'Other: Sequia',
    'Other: Sequias', 'Other: Sequías',
    'Other: Isla de calor urbana', 'Other: Islas de calor urbanas',
    'Other: Ilha de calor urbano',
    'Other: Efecto isla de calor urbana', 'Other: Efecto de islas de calor urbanas',
    'Other: Ola de calor', 'Other: Olas de calor', 'Other: Ondas de calor',
    'Other: Temperaturas extremas',
    'Other: Incendio forestal', 'Other: Incendios', 'Other: Fuego terrestre',
    'Other: Movimento de massa', 'Other: Calidad aire', 'Other: Anegamiento',
    'Other: Seguridad alimentaria', 'Other: Inseguridad alimentaria',
    'Other: Soberanía alimentaria', 'Other: Salud laboral',
    'Other: Impactos negativos en la salud', 'Other: Desarrollo urbano',
    'Other: Torbellinos', 'Other: Hundimiento',
    'Other: Escasez de agua', 'Other: Escasez hídrica',
    'Other: Subida do nível médio do mar', 'Other: Enfermedad alérgicas',
    'Other: pérdida de insfraestructura', 'Other: Riscos tecnológicos',
    'Other: Incorrecta gestión de residuos', 'Other: Independencia energética',
    'Other: Gestão Ambiental', 'Other: Creación de capacidades en comunidad escolar',
    'Other: Aumento de energia limpa no municipio', 'Other: Aumento de las malas olores',
    'Other: no se', 'Other: No se', 'Other: no hay',
    'Other: 재해 대응', 'Other: 수질', 'Other: 대기질 오염'
  ]) AS raw
),
downstream_segments AS (
  SELECT 'fact_hazard_final_TEST' AS src, TRIM(hazard_english) AS seg
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
  UNION ALL
  SELECT 'fact_action_final_TEST', TRIM(s)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
    UNNEST(SPLIT(hazard_addressed_english, '|')) AS s
  UNION ALL
  SELECT 'fact_goal_final_TEST', TRIM(s)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`,
    UNNEST(SPLIT(hazard_addressed_english, '|')) AS s
  UNION ALL
  SELECT 'solution_examples_TEST', TRIM(s)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`,
    UNNEST(SPLIT(hazard_addressed_english, '|')) AS s
)
SELECT d.src, d.seg, COUNT(*) AS n
FROM downstream_segments d
INNER JOIN static_raw s ON d.seg = s.raw
GROUP BY d.src, d.seg
ORDER BY n DESC;

-- 10c. Catch-all: any 'Other:' segment still containing diacritics or
--      non-Latin script in the downstream tables. If 10b is clean but
--      this returns rows, those are NEW segments the static map doesn't
--      cover -- the ML fallback either didn't fire or didn't translate
--      them. Worth eyeballing.
WITH downstream_segments AS (
  SELECT 'fact_hazard_final_TEST' AS src, TRIM(hazard_english) AS seg
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
  UNION ALL
  SELECT 'fact_action_final_TEST', TRIM(s)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
    UNNEST(SPLIT(hazard_addressed_english, '|')) AS s
  UNION ALL
  SELECT 'fact_goal_final_TEST', TRIM(s)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`,
    UNNEST(SPLIT(hazard_addressed_english, '|')) AS s
)
SELECT src, seg, COUNT(*) AS n
FROM downstream_segments
WHERE LOWER(seg) LIKE 'other:%'
  AND (
    REGEXP_CONTAINS(seg, r'[áéíóúñüçãõâêîôûäëïöÁÉÍÓÚÑÜÇÃÕ]')
    OR REGEXP_CONTAINS(seg, r'[\x{4E00}-\x{9FFF}\x{3040}-\x{309F}\x{30A0}-\x{30FF}\x{AC00}-\x{D7AF}\x{0400}-\x{04FF}\x{0600}-\x{06FF}\x{0E00}-\x{0E7F}]')
  )
GROUP BY src, seg
ORDER BY n DESC
LIMIT 100;

-- 10d. Row explosion check. If the LEFT JOIN to the map ever multiplied
--      rows (duplicate raw keys in the map), fact_action / fact_hazard
--      row counts would inflate vs the prior baseline. Snapshot here;
--      compare against the pre-run row counts from 1.
SELECT
  (SELECT COUNT(*) FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`) AS fact_action_rows,
  (SELECT COUNT(*) FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`)        AS fact_goal_rows,
  (SELECT COUNT(*) FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`) AS fact_hazard_rows;

-- 10e. NULL hazard fields where they shouldn't be. The split/rejoin
--      step would return NULL only on a zero-segment string. Should be
--      zero rows: any rendered row dropping to NULL is a regression.
SELECT 'fact_action_final_TEST' AS src, COUNT(*) AS null_hazard_rows
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`
WHERE hazard_addressed_english IS NULL
UNION ALL
SELECT 'fact_goal_final_TEST', COUNT(*)
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`
WHERE hazard_addressed_english IS NULL
UNION ALL
SELECT 'fact_hazard_final_TEST', COUNT(*)
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
WHERE hazard_english IS NULL;


-- ============================================================================
-- 12 — Did Other: hazard-segment translations actually land?
-- ============================================================================
-- After the notebook re-runs with the de-correlated CombinedTranslations + new
-- other_hazard_segments_map, any 'Other: <foreign-language text>' that the
-- static map covered should now be the English form. This single query finds
-- non-ASCII 'Other:' segments still appearing in the final fact tables.
-- A clean run should return 0 rows (or only segments we knowingly didn't map).
-- ============================================================================

WITH all_hazard_segments AS (
  SELECT TRIM(seg) AS seg, 'fact_action.hazard_addressed' AS source
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed_english, ''), '|')) AS seg
  UNION ALL
  SELECT TRIM(seg), 'fact_goal.hazard_addressed'
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed_english, ''), '|')) AS seg
  UNION ALL
  SELECT TRIM(hazard_english), 'fact_hazard.hazard_english'
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
)
SELECT
  source,
  seg,
  COUNT(*) AS occurrences
FROM all_hazard_segments
WHERE LOWER(seg) LIKE 'other:%'
  AND REGEXP_CONTAINS(seg, r'[^[:ascii:]]')
GROUP BY source, seg
ORDER BY occurrences DESC
LIMIT 100;


-- 12b — Direct map-applied check: for every `raw` value in the static map,
-- confirm it no longer appears in any fact table. If the new pipeline wired
-- up correctly, this returns 0 rows. Any rows are entries the map should have
-- caught but didn't — investigate the JOIN.
WITH all_hazard_segments AS (
  SELECT TRIM(seg) AS seg
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed_english, ''), '|')) AS seg
  UNION ALL
  SELECT TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed_english, ''), '|')) AS seg
  UNION ALL
  SELECT TRIM(hazard_english)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
),
expected_gone AS (
  SELECT raw, clean
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.other_hazard_segments_map`
  WHERE raw != clean   -- identity-only rows don't have anything to replace
)
SELECT
  eg.raw AS raw_value_still_present,
  eg.clean AS expected_replacement,
  COUNT(*) AS occurrences
FROM expected_gone eg
JOIN all_hazard_segments ahs ON ahs.seg = eg.raw
GROUP BY eg.raw, eg.clean
ORDER BY occurrences DESC;


-- 12c — Coverage-gap check: short non-ASCII `Other:` segments NOT in the map.
-- These are candidates the map *should* arguably handle. Use this to confirm
-- before narrowing a post-patch to a single value — if many appear, prefer
-- adding to static_other_hazard_map.sql + re-running the pipeline.
WITH all_segs AS (
  SELECT TRIM(seg) AS seg
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed_english, ''), '|')) AS seg
  UNION ALL
  SELECT TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed_english, ''), '|')) AS seg
  UNION ALL
  SELECT TRIM(hazard_english)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
)
SELECT
  seg AS unmapped_short_other_segment,
  CHAR_LENGTH(seg) AS chars,
  COUNT(*) AS occurrences
FROM all_segs
WHERE LOWER(seg) LIKE 'other:%'
  AND REGEXP_CONTAINS(seg, r'[^[:ascii:]]')
  AND CHAR_LENGTH(seg) <= 60
  AND seg NOT IN (
    SELECT raw
    FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.other_hazard_segments_map`
  )
GROUP BY seg
ORDER BY occurrences DESC, seg;


-- ============================================================================
-- 12d — Discovery: all foreign-language `Other:` segments across every
-- text column in every fact + solutions table. Pipe-splits each column,
-- filters segments starting with 'Other:' that contain non-ASCII chars.
-- Result groups by (source table.column, segment) with occurrence counts —
-- the inventory of every place the Other: translation gap manifests.
-- ============================================================================

WITH all_other_segments AS (
  -- fact_hazard
  SELECT 'fact_hazard_final_TEST.hazard_english' AS source, TRIM(hazard_english) AS seg
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`
  WHERE hazard_english IS NOT NULL
  UNION ALL
  SELECT 'fact_hazard_final_TEST.population_exposed_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`,
       UNNEST(SPLIT(IFNULL(population_exposed_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_hazard_final_TEST.sectors_exposed_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`,
       UNNEST(SPLIT(IFNULL(sectors_exposed_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_hazard_final_TEST.impacts', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST`,
       UNNEST(SPLIT(IFNULL(impacts, ''), '|')) AS seg

  -- fact_action
  UNION ALL
  SELECT 'fact_action_final_TEST.hazard_addressed_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_action_final_TEST.sectors_applied_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
       UNNEST(SPLIT(IFNULL(sectors_applied_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_action_final_TEST.resilience_enhanced_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
       UNNEST(SPLIT(IFNULL(resilience_enhanced_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_action_final_TEST.cobenefit_realized_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
       UNNEST(SPLIT(IFNULL(cobenefit_realized_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_action_final_TEST.funding_source_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
       UNNEST(SPLIT(IFNULL(funding_source_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_action_final_TEST.action_status_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`,
       UNNEST(SPLIT(IFNULL(action_status_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_action_final_TEST.action_english', TRIM(action_english)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST`
  WHERE action_english IS NOT NULL

  -- fact_goal
  UNION ALL
  SELECT 'fact_goal_final_TEST.hazard_addressed_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_goal_final_TEST.goal_english', TRIM(goal_english)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final_TEST`
  WHERE goal_english IS NOT NULL

  -- fact_funding_gap
  UNION ALL
  SELECT 'fact_funding_gap_final_TEST.project_title_english', TRIM(project_title_english)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_funding_gap_final_TEST`
  WHERE project_title_english IS NOT NULL
  UNION ALL
  SELECT 'fact_funding_gap_final_TEST.project_area_english', TRIM(project_area_english)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_funding_gap_final_TEST`
  WHERE project_area_english IS NOT NULL
  UNION ALL
  SELECT 'fact_funding_gap_final_TEST.finance_status_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_funding_gap_final_TEST`,
       UNNEST(SPLIT(IFNULL(finance_status_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'fact_funding_gap_final_TEST.finance_model_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_funding_gap_final_TEST`,
       UNNEST(SPLIT(IFNULL(finance_model_english, ''), '|')) AS seg

  -- solution_examples
  UNION ALL
  SELECT 'solution_examples_TEST.hazard_addressed_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'solution_examples_TEST.sectors_applied_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`,
       UNNEST(SPLIT(IFNULL(sectors_applied_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'solution_examples_TEST.resilience_enhanced_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`,
       UNNEST(SPLIT(IFNULL(resilience_enhanced_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'solution_examples_TEST.cobenefit_realized_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`,
       UNNEST(SPLIT(IFNULL(cobenefit_realized_english, ''), '|')) AS seg
  UNION ALL
  SELECT 'solution_examples_TEST.action_status_english', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST`,
       UNNEST(SPLIT(IFNULL(action_status_english, ''), '|')) AS seg

  -- peer_solutions
  UNION ALL
  SELECT 'peer_solutions_final_TEST.hazard_addressed', TRIM(seg)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`,
       UNNEST(SPLIT(IFNULL(hazard_addressed, ''), '|')) AS seg
  UNION ALL
  SELECT 'peer_solutions_final_TEST.action_english', TRIM(action_english)
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
  WHERE action_english IS NOT NULL
)
SELECT
  source,
  seg,
  CHAR_LENGTH(seg) AS chars,
  COUNT(*) AS occurrences
FROM all_other_segments
WHERE LOWER(seg) LIKE 'other:%'
  AND REGEXP_CONTAINS(seg, r'[^[:ascii:]]')
GROUP BY source, seg
ORDER BY occurrences DESC, source, seg
LIMIT 500;
