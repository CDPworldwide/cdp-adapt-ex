-- Ecoregion-change check for pending geometry-fixes.
--
-- For each org in a staged set of new geometries, computes what ecoregion
-- the new polygon would land in using the same logic as the
-- `dim_cdp_geo_and_ecoregion` cell of `CDP CSTAR run-to-rule-them-all-ETL.ipynb`:
--   1. ST_INTERSECTS against `climate_zones.ecoregions`.
--   2. Per-org, sum intersection area per biome.
--   3. Pick the biome with the largest total intersection area.
--
-- Compares the new ecoregion against the current one in
-- `dim_cdp_geo_and_ecoregion_TEST` and flags only disclosers whose
-- ecoregion would change (or disappear). Non-disclosers and orgs without
-- a currently-documented ecoregion are excluded — those are unlikely to
-- have peer-matching expectations to preserve.
--
-- Usage (from Cloud Shell or local with bq CLI):
--
--   # 1. Load the pending NDJSON into a temp BQ table:
--   bq load \
--     --source_format=NEWLINE_DELIMITED_JSON \
--     --replace \
--     --autodetect \
--     "$PROJECT_ID:Missing_Data.geometry_fixes_staging" \
--     /path/to/geospatial/cdp-geospatial-ops/local_data/pending_merge_bundle.ndjson
--
--   # 2. Run this check:
--   bq query --use_legacy_sql=false --project_id="$PROJECT_ID" \
--     < scripts/check_ecoregion_changes.sql
--
--   # 3. (optional) drop the temp table:
--   bq rm -f -t "$PROJECT_ID:Missing_Data.geometry_fixes_staging"
--
-- Pass criteria: zero rows = every disclosing org's ecoregion is unchanged.
-- Any returned row needs review before applying the geometry fix.

WITH pending AS (
  SELECT
    SAFE_CAST(account_id AS INT64) AS cdp_disclosing_org_number,
    organization_name,
    ST_GEOGFROMTEXT(
      REGEXP_REPLACE(geometry_wkt, r' (Z|ZM|M) ', ' '),
      make_valid => TRUE
    ) AS new_geometry
  FROM `project-bb4fd058-24e7-4ccb-b06.Missing_Data.geometry_fixes_staging`
),

-- Mirrors the notebook's cdp_intersections / ranked_biomes / largest_area
-- pattern: SUM intersection area per biome, then pick the largest per org.
pending_intersections AS (
  SELECT
    p.cdp_disclosing_org_number,
    eco.biome_name,
    SUM(ST_AREA(ST_INTERSECTION(p.new_geometry, eco.geometry))) AS total_intersection_area
  FROM pending p
  INNER JOIN `project-bb4fd058-24e7-4ccb-b06.climate_zones.ecoregions` eco
    ON ST_INTERSECTS(p.new_geometry, eco.geometry)
  GROUP BY 1, 2
),

pending_with_new_ecoregion AS (
  SELECT
    p.cdp_disclosing_org_number,
    p.organization_name,
    pi.biome_name AS new_ecoregion
  FROM pending p
  LEFT JOIN pending_intersections pi
    USING (cdp_disclosing_org_number)
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY p.cdp_disclosing_org_number
    ORDER BY pi.total_intersection_area DESC NULLS LAST
  ) = 1
)

SELECT
  d.cdp_disclosing_org_number,
  p.organization_name AS pending_org_name,
  d.disclosing_organization AS dim_org_name,
  d.disclosure_status,
  d.public_status,
  d.ecoregion AS current_ecoregion,
  p.new_ecoregion,
  CASE
    WHEN p.new_ecoregion IS NULL
      THEN 'WARN: new geometry intersects no biome'
    WHEN p.new_ecoregion != d.ecoregion
      THEN 'CHANGE: ecoregion would differ'
    ELSE 'ok'
  END AS verdict
FROM pending_with_new_ecoregion p
INNER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST` d
  USING (cdp_disclosing_org_number)
WHERE d.disclosure_status IS DISTINCT FROM 'non-disclosed'
  AND d.ecoregion IS NOT NULL
  AND p.new_ecoregion IS DISTINCT FROM d.ecoregion
ORDER BY verdict, d.cdp_disclosing_org_number;
