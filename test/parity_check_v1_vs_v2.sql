-- Parity check: CSTAR_2025_processed (v1, live) vs CSTAR_2025_processed_v2 (new run).
-- Goal: validate ≥ 95% per-row content match, with the few diffs being acronym-preservation wins
-- (acronyms recovered) rather than regressions or unexplained translation drift.
--
-- Run order: 1, 2, 3 give the verdict. 4 + 5 are spot-check follow-ups.
-- Matching strategy: join `*_translated` tables on (cdp_disclosing_org_number, row_order,
-- disclosure_cycle) — those are stable across runs because they come from the raw Q-tables.
-- Fact `*_final` tables use ROW_NUMBER-assigned indexes that may drift between runs, so we
-- compare via the upstream translated tables instead.
-- Goal pipeline aggregates inline (no goal_translated table) — see query 5 for that case.

-- ============================================================
-- 1. Quick parity dashboard — single row per pipeline with match %
-- ============================================================
-- Healthy: each *_match column ≥ 95% of total.
WITH
action_compare AS (
  SELECT
    COUNT(*) AS total,
    COUNTIF(o.action_english             = n.action_english)             AS title_match,
    COUNTIF(o.action_description_english = n.action_description_english) AS desc_match,
    COUNTIF(o.hazard_addressed_english   = n.hazard_addressed_english)   AS hazard_match,
    COUNTIF(o.sectors_applied_english    = n.sectors_applied_english)    AS sectors_match
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.action_translated`     o
  FULL OUTER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.action_translated` n
    USING (cdp_disclosing_org_number, row_order, disclosure_cycle)
),
hazard_compare AS (
  SELECT
    COUNT(*) AS total,
    COUNTIF(o.hazard_english             = n.hazard_english)             AS title_match,
    COUNTIF(o.impacts_english            = n.impacts_english)            AS desc_match,
    COUNTIF(o.population_exposed_english = n.population_exposed_english) AS pop_match
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.hazard_translated`     o
  FULL OUTER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.hazard_translated` n
    USING (cdp_disclosing_org_number, row_order, disclosure_cycle)
),
funding_compare AS (
  SELECT
    COUNT(*) AS total,
    COUNTIF(o.project_title_english       = n.project_title_english)       AS title_match,
    COUNTIF(o.project_descirption_english = n.project_descirption_english) AS desc_match
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.funding_translated`     o
  FULL OUTER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.funding_translated` n
    USING (cdp_disclosing_org_number, row_order, disclosure_cycle)
)
SELECT 'action'  AS pipeline, total, title_match, desc_match, hazard_match,        sectors_match  FROM action_compare
UNION ALL
SELECT 'hazard',             total, title_match, desc_match, pop_match AS hazard_match, NULL AS sectors_match  FROM hazard_compare
UNION ALL
SELECT 'funding',            total, title_match, desc_match, NULL,                     NULL          FROM funding_compare;


-- ============================================================
-- 2. Classify the diffs (the key validation query)
-- ============================================================
-- For each pipeline, count rows where text differs and categorize as:
--   new_recovered_acronym  — new has an acronym orig didn't → improvement
--   new_lost_acronym       — orig had an acronym new doesn't → regression (should be ~0)
--   no_acronyms_diff       — text differs but no acronym change → model variance noise
--
-- Repeat the pattern for action / hazard / funding by changing the table + column references.
-- ACTION example below:
WITH paired AS (
  SELECT
    o.cdp_disclosing_org_number AS org_id,
    o.row_order,
    o.action_english AS orig,
    n.action_english AS new_text
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.action_translated` o
  FULL OUTER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.action_translated` n
    USING (cdp_disclosing_org_number, row_order, disclosure_cycle)
  WHERE o.action_english IS DISTINCT FROM n.action_english
),
classified AS (
  SELECT
    *,
    REGEXP_EXTRACT_ALL(orig,     r'\b(?:[A-Za-z]\.){2,}[A-Za-z]?\b|\b[A-Z]{2,}(?:[/-][A-Z0-9]+)*\b') AS orig_acronyms,
    REGEXP_EXTRACT_ALL(new_text, r'\b(?:[A-Za-z]\.){2,}[A-Za-z]?\b|\b[A-Z]{2,}(?:[/-][A-Z0-9]+)*\b') AS new_acronyms,
    CASE
      WHEN orig IS NULL     THEN 'only_in_new'
      WHEN new_text IS NULL THEN 'only_in_orig'
      ELSE                       'differs'
    END AS shape
  FROM paired
)
SELECT
  shape,
  COUNTIF(EXISTS (SELECT 1 FROM UNNEST(new_acronyms)  a WHERE a NOT IN UNNEST(orig_acronyms))) AS new_recovered_acronym,
  COUNTIF(EXISTS (SELECT 1 FROM UNNEST(orig_acronyms) a WHERE a NOT IN UNNEST(new_acronyms)))  AS new_lost_acronym,
  COUNTIF(ARRAY_LENGTH(orig_acronyms) = 0 AND ARRAY_LENGTH(new_acronyms) = 0)                  AS no_acronyms_diff,
  COUNT(*) AS total_diff
FROM classified
GROUP BY shape;


-- ============================================================
-- 3. Show me the actual acronym recoveries (the wins)
-- ============================================================
-- Use this to eyeball: are the "recovered" tokens real acronyms (CDP, MOSE, PERAL, …) or just
-- regex-matched all-caps prose (MISE, DECHETS, etc. — those would be false-positive "wins").
WITH paired AS (
  SELECT
    o.cdp_disclosing_org_number AS org_id,
    o.row_order,
    o.action_english AS orig,
    n.action_english AS new_text
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.action_translated` o
  JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.action_translated` n
    USING (cdp_disclosing_org_number, row_order, disclosure_cycle)
  WHERE o.action_english IS DISTINCT FROM n.action_english
)
SELECT
  org_id, row_order, orig, new_text,
  ARRAY(
    SELECT a FROM UNNEST(
      REGEXP_EXTRACT_ALL(new_text, r'\b(?:[A-Za-z]\.){2,}[A-Za-z]?\b|\b[A-Z]{2,}(?:[/-][A-Z0-9]+)*\b')
    ) AS a
    WHERE a NOT IN UNNEST(
      REGEXP_EXTRACT_ALL(orig, r'\b(?:[A-Za-z]\.){2,}[A-Za-z]?\b|\b[A-Z]{2,}(?:[/-][A-Z0-9]+)*\b')
    )
  ) AS recovered
FROM paired
WHERE ARRAY_LENGTH(
  ARRAY(
    SELECT a FROM UNNEST(
      REGEXP_EXTRACT_ALL(new_text, r'\b(?:[A-Za-z]\.){2,}[A-Za-z]?\b|\b[A-Z]{2,}(?:[/-][A-Z0-9]+)*\b')
    ) AS a
    WHERE a NOT IN UNNEST(
      REGEXP_EXTRACT_ALL(orig, r'\b(?:[A-Za-z]\.){2,}[A-Za-z]?\b|\b[A-Z]{2,}(?:[/-][A-Z0-9]+)*\b')
    )
  )
) > 0
ORDER BY org_id, row_order
LIMIT 50;


-- ============================================================
-- 4. Spot non-acronym diffs — needs human review
-- ============================================================
-- Rows where text differs but acronym sets are identical = model variance, not pipeline change.
-- Should be small and unsurprising.
WITH paired AS (
  SELECT
    o.cdp_disclosing_org_number AS org_id,
    o.row_order,
    o.action_english AS orig,
    n.action_english AS new_text,
    REGEXP_EXTRACT_ALL(o.action_english, r'\b(?:[A-Za-z]\.){2,}[A-Za-z]?\b|\b[A-Z]{2,}(?:[/-][A-Z0-9]+)*\b') AS o_a,
    REGEXP_EXTRACT_ALL(n.action_english, r'\b(?:[A-Za-z]\.){2,}[A-Za-z]?\b|\b[A-Z]{2,}(?:[/-][A-Z0-9]+)*\b') AS n_a
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.action_translated` o
  JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.action_translated` n
    USING (cdp_disclosing_org_number, row_order, disclosure_cycle)
  WHERE o.action_english IS DISTINCT FROM n.action_english
)
SELECT org_id, row_order, orig, new_text
FROM paired
WHERE (SELECT ARRAY_AGG(x ORDER BY x) FROM UNNEST(o_a) x) = (SELECT ARRAY_AGG(x ORDER BY x) FROM UNNEST(n_a) x)
LIMIT 50;


-- ============================================================
-- 5. Goal pipeline — per-org distinct-goal overlap
-- ============================================================
-- Goals collapse via STRING_AGG/GROUP BY in fact_goal, so we match on (org, goal_english)
-- and count overlap per org. Healthy: overlap / orig_count ≥ 0.9 for most orgs.
WITH
orig_goals AS (
  SELECT cdp_disclosing_org_number AS org_id, ARRAY_AGG(DISTINCT goal_english) AS goals
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.fact_goal_final`
  WHERE goal_english IS NOT NULL
  GROUP BY 1
),
new_goals AS (
  SELECT cdp_disclosing_org_number AS org_id, ARRAY_AGG(DISTINCT goal_english) AS goals
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final`
  WHERE goal_english IS NOT NULL
  GROUP BY 1
)
SELECT
  COALESCE(o.org_id, n.org_id)                                                              AS org_id,
  ARRAY_LENGTH(o.goals)                                                                     AS orig_count,
  ARRAY_LENGTH(n.goals)                                                                     AS new_count,
  ARRAY_LENGTH(ARRAY(SELECT x FROM UNNEST(o.goals) x WHERE x IN UNNEST(n.goals)))           AS overlap_count
FROM orig_goals o FULL OUTER JOIN new_goals n USING (org_id)
ORDER BY ABS(COALESCE(ARRAY_LENGTH(n.goals), 0) - COALESCE(ARRAY_LENGTH(o.goals), 0)) DESC;


-- ============================================================
-- 6. Per-org row-count parity across the 4 _final fact tables
-- ============================================================
-- Big per-org row-count drift means the pipeline structure shifted (new null-filter
-- dropped rows, or different sentinel handling). Healthy: all deltas 0 or ±1.
WITH
orig_counts AS (
  SELECT cdp_disclosing_org_number AS org_id, 'fact_action_final'      AS tbl, COUNT(*) AS c FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.fact_action_final`      GROUP BY 1
  UNION ALL SELECT cdp_disclosing_org_number, 'fact_goal_final',        COUNT(*) FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.fact_goal_final`        GROUP BY 1
  UNION ALL SELECT cdp_disclosing_org_number, 'fact_hazard_final',      COUNT(*) FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.fact_hazard_final`      GROUP BY 1
  UNION ALL SELECT cdp_disclosing_org_number, 'fact_funding_gap_final', COUNT(*) FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed.fact_funding_gap_final` GROUP BY 1
),
new_counts AS (
  SELECT cdp_disclosing_org_number AS org_id, 'fact_action_final'      AS tbl, COUNT(*) AS c FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final`      GROUP BY 1
  UNION ALL SELECT cdp_disclosing_org_number, 'fact_goal_final',        COUNT(*) FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_goal_final`        GROUP BY 1
  UNION ALL SELECT cdp_disclosing_org_number, 'fact_hazard_final',      COUNT(*) FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final`      GROUP BY 1
  UNION ALL SELECT cdp_disclosing_org_number, 'fact_funding_gap_final', COUNT(*) FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_funding_gap_final` GROUP BY 1
)
SELECT
  COALESCE(o.org_id, n.org_id) AS org_id,
  COALESCE(o.tbl, n.tbl)       AS tbl,
  COALESCE(o.c, 0)             AS orig,
  COALESCE(n.c, 0)             AS new_,
  COALESCE(n.c, 0) - COALESCE(o.c, 0) AS delta
FROM orig_counts o
FULL OUTER JOIN new_counts n USING (org_id, tbl)
WHERE COALESCE(o.c, 0) != COALESCE(n.c, 0)
ORDER BY ABS(COALESCE(n.c, 0) - COALESCE(o.c, 0)) DESC
LIMIT 100;


-- ============================================================
-- Interpretation cheat sheet
-- ============================================================
--   Query 1 — *_match columns ≥ 95% of total          → strong parity baseline
--   Query 2 — new_recovered_acronym > new_lost        → acronym protection is moving the needle
--   Query 3 — eyeball: real acronyms vs regex noise   → confirms wins are genuine
--   Query 4 — small set, mostly synonym swaps         → pipeline change is targeted
--   Query 5 — overlap_count / orig_count ≥ 0.9        → goal-side parity holds
--   Query 6 — small per-org deltas (≤ 1)              → no row-count regressions
--
-- Red flags:
--   - Query 1 < 80% match           → model version drift or major translation re-engineering
--   - Query 2 new_lost > new_recov  → regression on acronyms (likely a regex bug)
--   - Query 6 large deltas          → pipeline structure changed (verify which rows dropped)
