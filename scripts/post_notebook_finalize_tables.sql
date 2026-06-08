-- CSTAR 2025 downstream processing (BigQuery).
--
-- Finishes what the notebook (`scripts/CDP CSTAR
-- run-to-rule-them-all-ETL.ipynb`) leaves unfinished. The notebook
-- covers only Public disclosers with structured ranked_hazards;
-- this script adds:
--   *  Centroids + water-cropping of mostly-water geometries
--   *  Geometry fixes COALESCEd in from Missing_Data
--   *  Hazard text normalization (sentence case, preserves acronyms)
--   *  GEE-Derived hazards for non-disclosers, non-Public disclosers
--   *  GEE-Derived hazards for Public disclosers with NULL or only "Other" ranked_hazards, excluding landslides (skipped Q2_2)
--   *  Peer_solutions / solution_examples for the above.
--
-- Reads: CSTAR_2025_processed_v2.*_final (notebook output) +
-- Missing_Data.* (from the geospatial/cdp-geospatial-ops repo).
-- Writes: CSTAR_2025_processed_v2.*_TEST (the inputs for
-- backend/scripts/migrate_cstar_2025_via_gcs.sh).
--
-- Run between the notebook rebuild and migration. From Cloud Shell:
--   bq query --use_legacy_sql=false --project_id=project-bb4fd058-24e7-4ccb-b06 \
--     < cdp-adapt-ex/scripts/post_notebook_finalize_tables.sql
-- Stages depend on each other (geometry -> ecoregion -> GEE hazards
-- -> peer match -> examples). Run top to bottom, not piecemeal.
--
-- Transitional: should fold into the notebook once stable.

-- 1. cdp-dim geometries

CREATE TEMP FUNCTION restore_caps(formatted STRING, original STRING)
RETURNS STRING
LANGUAGE js AS r"""
  if (formatted === null || original === null) return formatted;

  const caps = original.match(/\b[A-Z]{2,}[A-Za-z0-9]*\b/g) || [];
  let out = formatted;

  for (const cap of caps) {
    const escaped = cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('\\b' + escaped + '\\b', 'gi'), cap);
  }

  return out;
""";

CREATE OR REPLACE TABLE `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST` AS

WITH geometry_fixes AS (
  SELECT
    SAFE_CAST(account_id AS INT64) AS cdp_disclosing_org_number,
    SAFE_CAST(population AS INT64) AS population,
    ST_GEOGFROMTEXT(
      REGEXP_REPLACE(geometry_wkt, r' (Z|ZM|M) ', ' '),
      make_valid => TRUE
    ) AS geometry
  FROM `project-bb4fd058-24e7-4ccb-b06.Missing_Data.geometry-fixes`
),

nondiscloser_rows AS (
  SELECT
    SAFE_CAST(account_id AS INT64) AS cdp_disclosing_org_number,
    SAFE_CAST(population AS INT64) AS current_pop,
    organization_name AS disclosing_organization,
    2025 AS cur_pop_year,
    'non-disclosed' AS disclosure_status,
    'GEE-Derived' AS public_status,
    1 AS has_geometry,
    ST_GEOGFROMTEXT(
      REGEXP_REPLACE(geometry_wkt, r' (Z|ZM|M) ', ' '),
      make_valid => TRUE
    ) AS geometry
  FROM `project-bb4fd058-24e7-4ccb-b06.Missing_Data.nondiscloser-geometries`
),

base_plus_nondisclosers AS (
  SELECT *
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion`

  FULL OUTER UNION ALL BY NAME

  SELECT *
  FROM nondiscloser_rows
),

joined_missing AS (
  SELECT
    d.* EXCEPT(geometry),
    d.geometry AS original_geometry,

    ST_GEOGFROMTEXT(
      REGEXP_REPLACE(m.geometry_wkt, r' (Z|ZM|M) ', ' '),
      make_valid => TRUE
    ) AS missing_data_geometry
  FROM base_plus_nondisclosers d
  LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.Missing_Data.missing-data` m
    ON SAFE_CAST(m.account_number AS INT64) = d.cdp_disclosing_org_number
),

joined_fixes AS (
  SELECT
    jm.*,
    gf.geometry AS geometry_fixes_geometry,
    gf.population AS geometry_fixes_population
  FROM joined_missing jm
  LEFT JOIN geometry_fixes gf
    ON jm.cdp_disclosing_org_number = gf.cdp_disclosing_org_number
),

formatted AS (
  SELECT
    *,

    CASE
      WHEN ranked_hazards IS NULL THEN NULL
      ELSE ARRAY_TO_STRING(
        ARRAY(
          SELECT
            restore_caps(
              CASE
                WHEN STARTS_WITH(TRIM(h), 'Other: ') THEN
                  CONCAT(
                    'Other: ',
                    UPPER(SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 1, 1)),
                    SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 2)
                  )
                ELSE
                  CONCAT(
                    UPPER(SUBSTR(LOWER(TRIM(h)), 1, 1)),
                    SUBSTR(LOWER(TRIM(h)), 2)
                  )
              END,
              TRIM(h)
            )
          FROM UNNEST(SPLIT(ranked_hazards, '|')) AS h
        ),
        '|'
      )
    END AS ranked_hazards_new
  FROM joined_fixes
),

pre_water_crop AS (
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY cdp_disclosing_org_number, disclosing_organization
    ) AS row_id,

    * EXCEPT(
      original_geometry,
      missing_data_geometry,
      geometry_fixes_geometry,
      geometry_fixes_population,
      ranked_hazards,
      ranked_hazards_new,
      current_pop,
      public_status
    ),

    CASE
      WHEN disclosure_status = 'non-disclosed'
        THEN COALESCE(geometry_fixes_population, current_pop)
      ELSE current_pop
    END AS current_pop,

    CASE
      WHEN disclosure_status = 'non-disclosed'
        THEN 'GEE-Derived'
      ELSE public_status
    END AS public_status,

    ranked_hazards_new AS ranked_hazards,

    IFNULL(ranked_hazards_new != ranked_hazards, FALSE)
      AS ranked_hazards_updated,

    COALESCE(geometry_fixes_geometry, missing_data_geometry) IS NOT NULL
      AS geometry_changed,

    COALESCE(
      geometry_fixes_geometry,
      missing_data_geometry,
      original_geometry
    ) AS geometry_before_water_crop
  FROM formatted
),

water_stats AS (
  SELECT
    row_id,
    ST_REGIONSTATS(
      geometry_before_water_crop,
      'ee://MODIS/006/MOD44W/2015_01_01',
      'water_mask',
      options => JSON '{"scale": 250}'
    ).mean * 100 AS pct_water
  FROM pre_water_crop
  WHERE geometry_before_water_crop IS NOT NULL
    AND disclosure_status != 'non-disclosed'
),

land_geoms AS (
  SELECT
    ST_GEOGFROMTEXT(geometry_wkt, make_valid => TRUE) AS land_geom
  FROM `project-bb4fd058-24e7-4ccb-b06.Missing_Data.water-geometries`
  WHERE geometry_wkt IS NOT NULL
),

land_by_row AS (
  SELECT
    p.row_id,
    ST_UNION_AGG(l.land_geom) AS land_geom
  FROM pre_water_crop p
  JOIN water_stats ws USING (row_id)
  JOIN land_geoms l
    ON ST_INTERSECTS(p.geometry_before_water_crop, l.land_geom)
  WHERE ws.pct_water > 50
    AND ws.pct_water < 100
  GROUP BY p.row_id
),

cropped AS (
  SELECT
    p.row_id,
    ST_INTERSECTION(p.geometry_before_water_crop, l.land_geom) AS cropped_land_geom
  FROM pre_water_crop p
  JOIN land_by_row l USING (row_id)
),

final_geometry AS (
  SELECT
    p.* EXCEPT(row_id, geometry_before_water_crop),

    CASE
      WHEN ws.pct_water > 50
        AND ws.pct_water < 100
        AND c.cropped_land_geom IS NOT NULL
        AND NOT ST_ISEMPTY(c.cropped_land_geom)
        AND ST_AREA(c.cropped_land_geom) < ST_AREA(p.geometry_before_water_crop)
      THEN c.cropped_land_geom
      ELSE p.geometry_before_water_crop
    END AS geometry,

    ws.pct_water,

    ST_AREA(p.geometry_before_water_crop) / 1e6 AS original_area_km2,

    ST_AREA(
      CASE
        WHEN ws.pct_water > 50
          AND ws.pct_water < 100
          AND c.cropped_land_geom IS NOT NULL
          AND NOT ST_ISEMPTY(c.cropped_land_geom)
          AND ST_AREA(c.cropped_land_geom) < ST_AREA(p.geometry_before_water_crop)
        THEN c.cropped_land_geom
        ELSE p.geometry_before_water_crop
      END
    ) / 1e6 AS final_area_km2,

    CASE
      WHEN ws.pct_water > 50
        AND ws.pct_water < 100
        AND c.cropped_land_geom IS NOT NULL
        AND NOT ST_ISEMPTY(c.cropped_land_geom)
        AND ST_AREA(c.cropped_land_geom) < ST_AREA(p.geometry_before_water_crop)
      THEN TRUE
      ELSE FALSE
    END AS geometry_cropped_for_water

  FROM pre_water_crop p
  LEFT JOIN water_stats ws USING (row_id)
  LEFT JOIN cropped c USING (row_id)
)

SELECT
  *,

  CASE
    WHEN cdp_disclosing_org_number IN (31111, 72891, 72953)
      AND geometry IS NOT NULL
    THEN ST_CENTROID(
      (
        SELECT part
        FROM UNNEST(ST_DUMP(geometry)) AS part
        ORDER BY ST_AREA(part) DESC
        LIMIT 1
      )
    )
    ELSE ST_CENTROID(geometry)
  END AS centroid

FROM final_geometry;

-- 2. fact-hazard
CREATE TEMP FUNCTION restore_caps(formatted STRING, original STRING)
RETURNS STRING
LANGUAGE js AS r"""
  if (formatted === null || original === null) return formatted;
  const caps = original.match(/\b[A-Z]{2,}[A-Za-z0-9]*\b/g) || [];
  let out = formatted;
  for (const cap of caps) {
    const escaped = cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('\\b' + escaped + '\\b', 'gi'), cap);
  }
  return out;
""";

CREATE TEMP FUNCTION format_hazard(h STRING)
RETURNS STRING AS (
  restore_caps(
    CASE
      WHEN h IS NULL THEN NULL
      WHEN STARTS_WITH(TRIM(h), 'Other: ') THEN CONCAT(
        'Other: ',
        UPPER(SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 1, 1)),
        SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 2)
      )
      ELSE CONCAT(
        UPPER(SUBSTR(LOWER(TRIM(h)), 1, 1)),
        SUBSTR(LOWER(TRIM(h)), 2)
      )
    END,
    TRIM(h)
  )
);

CREATE OR REPLACE TABLE `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final_TEST` AS
WITH source_data AS (
  SELECT *
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_hazard_final`
),

formatted AS (
  SELECT
    *,
    format_hazard(hazard_english) AS hazard_english_new
  FROM source_data
),

existing_rows AS (
  SELECT
    * EXCEPT(hazard_english, hazard_english_new),
    hazard_english_new AS hazard_english,
    IFNULL(hazard_english_new != hazard_english, FALSE) AS hazard_english_updated,
    FALSE AS is_nondiscloser
  FROM formatted
),

nondiscloser_geoms AS (
  SELECT
    SAFE_CAST(n.account_id AS INT64) AS cdp_disclosing_org_number,
    COALESCE(
      ST_GEOGFROMTEXT(
        REGEXP_REPLACE(gf.geometry_wkt, r' (Z|ZM|M) ', ' '),
        make_valid => TRUE
      ),
      ST_GEOGFROMTEXT(
        REGEXP_REPLACE(n.geometry_wkt, r' (Z|ZM|M) ', ' '),
        make_valid => TRUE
      )
    ) AS geometry
  FROM `project-bb4fd058-24e7-4ccb-b06.Missing_Data.nondiscloser-geometries` n
  LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.Missing_Data.geometry-fixes` gf
    ON SAFE_CAST(gf.account_id AS INT64) = SAFE_CAST(n.account_id AS INT64)
),

assets AS (
  SELECT * FROM UNNEST([
    STRUCT(
      'hazards-v2/coastal-flood/coastal-flood_historical_2010_rp100' AS asset_path,
      'flood_score' AS band,
      'Coastal flooding (incl. sea level rise)' AS hazard_english
    ),
    STRUCT(
      'hazards-v2/cold/frost_days_score_1to5_historical_1985_2014_epsg4326_lon-180_180',
      'b1',
      'Extreme cold'
    ),
    STRUCT(
      'hazards-v2/fire/FWI_N45_score_1to5_1985_2014_epsg4326_lon-180_180_historical',
      'b1',
      'Fire weather (risk of wildfires)'
    ),
    STRUCT(
      'hazards-v2/heat/hotdays_score_1to5_historical_1985_2014_epsg4326_lon-180_180',
      'b1',
      'Extreme heat'
    ),
    STRUCT(
      'hazards-v2/landslides/Landslides_Historical',
      'b1',
      'Other: Landslides'
    ),
    STRUCT(
      'hazards-v2/precip/pr_rx5day_score_1to5_historical_1985_2014_epsg4326_lon-180_180',
      'b1',
      'Heavy precipitation'
    ),
    STRUCT(
      'hazards-v2/riverine-flood/riverine-flood_historical_1980_rp100',
      'flood_score',
      'River flooding'
    ),
    STRUCT(
      'hazards-v2/water-stress/WRI_Water_Stress_historical',
      'bws_score',
      'Water stress'
    )
  ])
),

nondiscloser_hazard_scores AS (
  SELECT
    n.cdp_disclosing_org_number,
    a.hazard_english,
    NULLIF(
      ST_REGIONSTATS(
        n.geometry,
        CONCAT('ee://projects/project-bb4fd058-24e7-4ccb-b06/assets/', a.asset_path),
        a.band,
        options => JSON '{"scale": 25000}'
      ).mean,
      -9999
    ) AS mean_hazard_score
  FROM nondiscloser_geoms n
  CROSS JOIN assets a
  WHERE n.geometry IS NOT NULL
),

ranked_nondiscloser_hazards AS (
  SELECT
    cdp_disclosing_org_number,
    'GEE-Derived' AS public_status,
    ROW_NUMBER() OVER (
      PARTITION BY cdp_disclosing_org_number
      ORDER BY mean_hazard_score DESC NULLS LAST, hazard_english
    ) AS hazard_rank,
    hazard_english,
    FALSE AS hazard_english_updated,
    TRUE AS is_nondiscloser
  FROM nondiscloser_hazard_scores
),

top_4_nondiscloser_hazards AS (
  SELECT *
  FROM ranked_nondiscloser_hazards
  WHERE hazard_rank <= 4
),

covered_accounts AS (
  SELECT DISTINCT cdp_disclosing_org_number
  FROM existing_rows
  WHERE cdp_disclosing_org_number IS NOT NULL
    AND hazard_english IS NOT NULL
    AND TRIM(hazard_english) != ''
    AND (
      NOT STARTS_WITH(TRIM(hazard_english), 'Other:')
      OR TRIM(hazard_english) = 'Other: Landslides'
    )
    AND (public_status IS NULL OR public_status != 'Non-Public')

  UNION DISTINCT

  SELECT DISTINCT cdp_disclosing_org_number
  FROM top_4_nondiscloser_hazards
  WHERE cdp_disclosing_org_number IS NOT NULL
),

accounts_to_score AS (
  SELECT
    d.cdp_disclosing_org_number,
    d.geometry
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST` d
  LEFT JOIN covered_accounts c
    ON c.cdp_disclosing_org_number = d.cdp_disclosing_org_number
  WHERE d.geometry IS NOT NULL
    AND c.cdp_disclosing_org_number IS NULL
),

gee_hazard_scores AS (
  SELECT
    a.cdp_disclosing_org_number,
    asset.hazard_english,
    NULLIF(
      ST_REGIONSTATS(
        a.geometry,
        CONCAT('ee://projects/project-bb4fd058-24e7-4ccb-b06/assets/', asset.asset_path),
        asset.band,
        options => JSON '{"scale": 25000}'
      ).mean,
      -9999
    ) AS mean_hazard_score
  FROM accounts_to_score a
  CROSS JOIN assets asset
),

ranked_gee_hazards AS (
  SELECT
    cdp_disclosing_org_number,
    'GEE-Derived' AS public_status,
    ROW_NUMBER() OVER (
      PARTITION BY cdp_disclosing_org_number
      ORDER BY mean_hazard_score DESC NULLS LAST, hazard_english
    ) AS hazard_rank,
    hazard_english,
    FALSE AS hazard_english_updated,
    FALSE AS is_nondiscloser
  FROM gee_hazard_scores
),

top_4_gee_hazards AS (
  SELECT *
  FROM ranked_gee_hazards
  WHERE hazard_rank <= 4
)

SELECT *
FROM existing_rows
WHERE (
  NOT STARTS_WITH(TRIM(hazard_english), 'Other:')
  OR TRIM(hazard_english) = 'Other: Landslides'
)

FULL OUTER UNION ALL BY NAME

SELECT *
FROM existing_rows

FULL OUTER UNION ALL BY NAME

SELECT *
FROM top_4_nondiscloser_hazards

FULL OUTER UNION ALL BY NAME

SELECT *
FROM top_4_gee_hazards;

-- 3. fact-action
CREATE TEMP FUNCTION restore_caps(formatted STRING, original STRING)
RETURNS STRING
LANGUAGE js AS r"""
  if (formatted === null || original === null) return formatted;
  const caps = original.match(/\b[A-Z]{2,}[A-Za-z0-9]*\b/g) || [];
  let out = formatted;
  for (const cap of caps) {
    const escaped = cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('\\b' + escaped + '\\b', 'gi'), cap);
  }
  return out;
""";

CREATE TEMP FUNCTION format_hazard(h STRING)
RETURNS STRING AS (
  restore_caps(
    CASE
      WHEN h IS NULL THEN NULL
      WHEN STARTS_WITH(TRIM(h), 'Other: ') THEN CONCAT(
        'Other: ',
        UPPER(SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 1, 1)),
        SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 2)
      )
      ELSE CONCAT(
        UPPER(SUBSTR(LOWER(TRIM(h)), 1, 1)),
        SUBSTR(LOWER(TRIM(h)), 2)
      )
    END,
    TRIM(h)
  )
);

CREATE OR REPLACE TABLE `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST` AS

WITH source_data AS (
  SELECT
    * REPLACE(
      SAFE_CAST(
        REGEXP_REPLACE(CAST(total_cost_usd AS STRING), r',', '')
        AS FLOAT64
      ) AS total_cost_usd
    )
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final`
),

formatted AS (
  SELECT
    *,
    CASE
      WHEN hazard_addressed_english IS NULL THEN NULL
      ELSE ARRAY_TO_STRING(
        ARRAY(
          SELECT format_hazard(h)
          FROM UNNEST(SPLIT(hazard_addressed_english, '|')) AS h
        ),
        '|'
      )
    END AS hazard_addressed_english_new
  FROM source_data
)

SELECT
  * EXCEPT(hazard_addressed_english, hazard_addressed_english_new),
  hazard_addressed_english_new AS hazard_addressed_english,
  IFNULL(
    hazard_addressed_english_new != hazard_addressed_english,
    FALSE
  ) AS hazard_addressed_english_updated
FROM formatted;

-- 4. fact-funding

CREATE OR REPLACE TABLE `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_funding_gap_final_TEST`
AS
SELECT
  * REPLACE (
    SAFE_CAST(
      REGEXP_REPLACE(CAST(total_cost_usd AS STRING), r',', '') AS FLOAT64
    ) AS total_cost_usd,
    SAFE_CAST(
      REGEXP_REPLACE(CAST(total_needed_usd AS STRING), r',', '') AS FLOAT64
    ) AS total_needed_usd
  )
FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_funding_gap_final`;

-- 5. peer-solutions
CREATE TEMP FUNCTION restore_caps(formatted STRING, original STRING)
RETURNS STRING
LANGUAGE js AS r"""
  if (formatted === null || original === null) return formatted;
  const caps = original.match(/\b[A-Z]{2,}[A-Za-z0-9]*\b/g) || [];
  let out = formatted;
  for (const cap of caps) {
    const escaped = cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('\\b' + escaped + '\\b', 'gi'), cap);
  }
  return out;
""";

CREATE TEMP FUNCTION format_hazard(h STRING)
RETURNS STRING AS (
  restore_caps(
    CASE
      WHEN h IS NULL THEN NULL
      WHEN STARTS_WITH(TRIM(h), 'Other: ') THEN CONCAT('Other: ', UPPER(SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 1, 1)), SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 2))
      ELSE CONCAT(UPPER(SUBSTR(LOWER(TRIM(h)), 1, 1)), SUBSTR(LOWER(TRIM(h)), 2))
    END,
    TRIM(h)
  )
);

CREATE OR REPLACE TABLE `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST` AS
WITH formatted_existing AS (
  SELECT
    *,
    CASE WHEN hazard_addressed IS NULL THEN NULL ELSE ARRAY_TO_STRING(ARRAY(SELECT format_hazard(h) FROM UNNEST(SPLIT(hazard_addressed, '|')) AS h), '|') END AS hazard_addressed_new,
    CASE WHEN hazard_filter IS NULL THEN NULL ELSE ARRAY_TO_STRING(ARRAY(SELECT format_hazard(h) FROM UNNEST(SPLIT(hazard_filter, '|')) AS h), '|') END AS hazard_filter_new
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final`
),
existing_rows AS (
  SELECT
    * EXCEPT(hazard_addressed, hazard_filter, hazard_addressed_new, hazard_filter_new),
    hazard_addressed_new AS hazard_addressed,
    IFNULL(hazard_addressed_new != hazard_addressed, FALSE) AS hazard_addressed_updated,
    hazard_filter_new AS hazard_filter,
    IFNULL(hazard_filter_new != hazard_filter, FALSE) AS hazard_filter_updated,
    FALSE AS is_nondiscloser,
    CAST(NULL AS STRING) AS public_status
  FROM formatted_existing
),
gee_target_geoms AS (
  SELECT
    target_org_id,
    ARRAY_AGG(geometry ORDER BY source_priority DESC LIMIT 1)[OFFSET(0)] AS geometry,
    'GEE-Derived' AS public_status
  FROM (
    SELECT
      d.cdp_disclosing_org_number AS target_org_id,
      d.geometry,
      1 AS source_priority
    FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST` d
    WHERE d.geometry IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM existing_rows e
        WHERE e.target_org_id = d.cdp_disclosing_org_number
      )

    UNION ALL

    SELECT
      SAFE_CAST(n.account_id AS INT64) AS target_org_id,
      COALESCE(
        ST_GEOGFROMTEXT(REGEXP_REPLACE(gf.geometry_wkt, r' (Z|ZM|M) ', ' '), make_valid => TRUE),
        ST_GEOGFROMTEXT(REGEXP_REPLACE(n.geometry_wkt, r' (Z|ZM|M) ', ' '), make_valid => TRUE)
      ) AS geometry,
      2 AS source_priority
    FROM `project-bb4fd058-24e7-4ccb-b06.Missing_Data.nondiscloser-geometries` n
    LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.Missing_Data.geometry-fixes` gf
      ON SAFE_CAST(gf.account_id AS INT64) = SAFE_CAST(n.account_id AS INT64)
  )
  WHERE target_org_id IS NOT NULL
    AND geometry IS NOT NULL
  GROUP BY target_org_id
),
assets AS (
  SELECT * FROM UNNEST([
    STRUCT('hazards-v2/coastal-flood/coastal-flood_historical_2010_rp100' AS asset_path, 'flood_score' AS band, 'Coastal flooding (incl. sea level rise)' AS hazard_english),
    STRUCT('hazards-v2/cold/frost_days_score_1to5_historical_1985_2014_epsg4326_lon-180_180', 'b1', 'Extreme cold'),
    STRUCT('hazards-v2/fire/FWI_N45_score_1to5_1985_2014_epsg4326_lon-180_180_historical', 'b1', 'Fire weather (risk of wildfires)'),
    STRUCT('hazards-v2/heat/hotdays_score_1to5_historical_1985_2014_epsg4326_lon-180_180', 'b1', 'Extreme heat'),
    STRUCT('hazards-v2/landslides/Landslides_Historical', 'b1', 'Other: Landslides'),
    STRUCT('hazards-v2/precip/pr_rx5day_score_1to5_historical_1985_2014_epsg4326_lon-180_180', 'b1', 'Heavy precipitation'),
    STRUCT('hazards-v2/riverine-flood/riverine-flood_historical_1980_rp100', 'flood_score', 'River flooding'),
    STRUCT('hazards-v2/water-stress/WRI_Water_Stress_historical', 'bws_score', 'Water stress')
  ])
),
gee_hazard_scores AS (
  SELECT
    g.target_org_id,
    a.hazard_english,
    NULLIF(ST_REGIONSTATS(
      g.geometry,
      CONCAT('ee://projects/project-bb4fd058-24e7-4ccb-b06/assets/', a.asset_path),
      a.band,
      options => JSON '{"scale": 25000}'
    ).mean, -9999) AS mean_hazard_score
  FROM gee_target_geoms g
  CROSS JOIN assets a
),
target_city_top_hazards AS (
  SELECT
    s.target_org_id,
    eco.BIOME_NAME AS target_ecoregion,
    s.hazard_english AS top_hazard,
    s.mean_hazard_score
  FROM (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY target_org_id
        ORDER BY mean_hazard_score DESC NULLS LAST, hazard_english
      ) AS hazard_rank
    FROM gee_hazard_scores
  ) s
  LEFT JOIN gee_target_geoms g
    ON s.target_org_id = g.target_org_id
  LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.climate_zones.ecoregions` eco
    ON ST_INTERSECTS(g.geometry, eco.geometry)
  WHERE s.hazard_rank <= 4
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY s.target_org_id, s.hazard_english
    ORDER BY ST_AREA(ST_INTERSECTION(g.geometry, eco.geometry)) DESC NULLS LAST
  ) = 1
),
peer_city_hazards_addressed AS (
  SELECT DISTINCT
    a.cdp_disclosing_org_number AS peer_org_id,
    b.ecoregion AS peer_ecoregion,
    a.action_english,
    a.action_index,
    TRIM(hazard) AS hazard_addressed
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST` a
  INNER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST` b
    ON a.cdp_disclosing_org_number = b.cdp_disclosing_org_number
  CROSS JOIN UNNEST(SPLIT(a.hazard_addressed_english, '|')) AS hazard
  WHERE TRIM(hazard) != 'Action does not address hazard'
    AND TRIM(hazard) != ''
    AND hazard IS NOT NULL
    AND NOT REGEXP_CONTAINS(LOWER(TRIM(hazard)), r'\bother:')
    AND b.public_status = 'Public'
    AND b.ecoregion IS NOT NULL
    AND TRIM(a.action_english) != ''
    AND TRIM(SPLIT(a.action_english, ':')[SAFE_OFFSET(0)]) != 'No adaptation action in place'
    AND NOT REGEXP_CONTAINS(LOWER(TRIM(SPLIT(a.action_english, ':')[SAFE_OFFSET(0)])), r'\bother\b')
    AND NOT REGEXP_CONTAINS(LOWER(TRIM(SPLIT(a.action_english, ':')[SAFE_OFFSET(1)])), r'\bother\b')
),
peer_list_gee_targets AS (
  SELECT DISTINCT
    t.target_org_id,
    t.top_hazard,
    p.peer_org_id,
    p.action_english,
    p.action_index
  FROM target_city_top_hazards t
  INNER JOIN peer_city_hazards_addressed p
    ON t.target_ecoregion = p.peer_ecoregion
   AND t.top_hazard = p.hazard_addressed
  WHERE t.target_org_id != p.peer_org_id
),
peer_actions AS (
  SELECT
    pc.target_org_id,
    pc.top_hazard,
    pc.peer_org_id,
    q9.action_english,
    q9.action_index,
    TRIM(SPLIT(q9.action_english, ':')[SAFE_OFFSET(0)]) AS solution_category,
    TRIM(SPLIT(q9.action_english, ':')[SAFE_OFFSET(1)]) AS solution
  FROM peer_list_gee_targets pc
  INNER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST` q9
    ON pc.peer_org_id = q9.cdp_disclosing_org_number
   AND pc.action_english = q9.action_english
   AND pc.action_index = q9.action_index
),

-- Hazard-specific rows:
-- 1) aggregate by target + hazard + solution
-- 2) top 5 per solution_category
-- 3) top 25 overall per target + hazard
agg_peer_actions AS (
  SELECT
    target_org_id,
    top_hazard,
    solution_category,
    solution,
    action_english,
    action_index,
    COUNT(*) AS action_count,
    COUNT(DISTINCT peer_org_id) AS org_count
  FROM peer_actions
  GROUP BY 1,2,3,4,5,6
),
rank_action AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY target_org_id, top_hazard, solution_category
      ORDER BY action_count DESC, org_count DESC, action_english
    ) AS action_rank
  FROM agg_peer_actions
),
hazard_level_pre_top25 AS (
  SELECT
    2025 AS disclosing_year,
    r.target_org_id,
    r.top_hazard AS hazard_filter,
    r.solution_category,
    r.solution,
    r.action_rank,
    r.action_english,
    r.action_index,
    r.top_hazard AS hazard_addressed,
    pcl.peer_org_cnt,
    r.action_count,
    SAFE_DIVIDE(r.action_count, pcl.peer_org_cnt) AS pct_peers
  FROM rank_action r
  INNER JOIN (
    SELECT
      target_org_id,
      top_hazard,
      COUNT(DISTINCT peer_org_id) AS peer_org_cnt
    FROM peer_actions
    GROUP BY 1,2
  ) pcl
    ON r.target_org_id = pcl.target_org_id
   AND r.top_hazard = pcl.top_hazard
  WHERE r.action_rank <= 5
),
hazard_level AS (
  SELECT * EXCEPT(overall_rank)
  FROM (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY target_org_id, hazard_filter
        ORDER BY action_count DESC, pct_peers DESC, solution_category, solution
      ) AS overall_rank
    FROM hazard_level_pre_top25
  )
  WHERE overall_rank <= 25
),

-- All-hazard rows:
-- same logic as hazard-specific rows, but across all top hazards.
all_level_ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY target_org_id, solution_category
      ORDER BY action_count DESC, pct_peers DESC, action_english
    ) AS action_rank
  FROM (
    SELECT
      2025 AS disclosing_year,
      target_org_id,
      'All' AS hazard_filter,
      solution_category,
      solution,
      action_english,
      action_index,
      STRING_AGG(DISTINCT top_hazard, ' | ') AS hazard_addressed,
      COUNT(DISTINCT peer_org_id) AS peer_org_cnt,
      COUNT(*) AS action_count,
      SAFE_DIVIDE(COUNT(*), COUNT(DISTINCT peer_org_id)) AS pct_peers
    FROM peer_actions
    GROUP BY 1,2,3,4,5,6,7
  )
),
all_level_pre_top25 AS (
  SELECT *
  FROM all_level_ranked
  WHERE action_rank <= 5
),
all_level AS (
  SELECT * EXCEPT(overall_rank)
  FROM (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY target_org_id
        ORDER BY action_count DESC, pct_peers DESC, solution_category, solution
      ) AS overall_rank
    FROM all_level_pre_top25
  )
  WHERE overall_rank <= 25
),
gee_derived_peer_solutions AS (
  SELECT
    *,
    FALSE AS hazard_addressed_updated,
    FALSE AS hazard_filter_updated,
    TRUE AS is_nondiscloser,
    'GEE-Derived' AS public_status
  FROM hazard_level

  UNION ALL BY NAME

  SELECT
    *,
    FALSE AS hazard_addressed_updated,
    FALSE AS hazard_filter_updated,
    TRUE AS is_nondiscloser,
    'GEE-Derived' AS public_status
  FROM all_level
)
SELECT * FROM existing_rows
FULL OUTER UNION ALL BY NAME
SELECT * FROM gee_derived_peer_solutions;

-- 6. solution-examples

CREATE TEMP FUNCTION restore_caps(formatted STRING, original STRING)
RETURNS STRING
LANGUAGE js AS r"""
  if (formatted === null || original === null) return formatted;
  const caps = original.match(/\b[A-Z]{2,}[A-Za-z0-9]*\b/g) || [];
  let out = formatted;
  for (const cap of caps) {
    const escaped = cap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('\\b' + escaped + '\\b', 'gi'), cap);
  }
  return out;
""";

CREATE TEMP FUNCTION format_hazard(h STRING)
RETURNS STRING AS (
  restore_caps(
    CASE
      WHEN h IS NULL THEN NULL
      WHEN STARTS_WITH(TRIM(h), 'Other: ') THEN CONCAT('Other: ', UPPER(SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 1, 1)), SUBSTR(LOWER(SUBSTR(TRIM(h), 8)), 2))
      ELSE CONCAT(UPPER(SUBSTR(LOWER(TRIM(h)), 1, 1)), SUBSTR(LOWER(TRIM(h)), 2))
    END,
    TRIM(h)
  )
);

CREATE OR REPLACE TABLE `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples_TEST` AS
WITH formatted_existing AS (
  SELECT
    *,
    CASE
      WHEN hazard_addressed_english IS NULL THEN NULL
      ELSE ARRAY_TO_STRING(
        ARRAY(
          SELECT format_hazard(h)
          FROM UNNEST(SPLIT(hazard_addressed_english, '|')) AS h
        ),
        '|'
      )
    END AS hazard_addressed_new,
    CASE
      WHEN hazard_filter IS NULL THEN NULL
      ELSE ARRAY_TO_STRING(
        ARRAY(
          SELECT format_hazard(h)
          FROM UNNEST(SPLIT(hazard_filter, '|')) AS h
        ),
        '|'
      )
    END AS hazard_filter_new
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.solution_examples`
),

peer_solution_status_lookup AS (
  SELECT
    target_org_id,
    hazard_filter,
    action_english,
    action_index,
    ANY_VALUE(public_status) AS public_status
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
  GROUP BY 1,2,3,4
),

existing_rows AS (
  SELECT
    e.* EXCEPT(hazard_addressed_english, hazard_filter, hazard_addressed_new, hazard_filter_new),
    e.hazard_addressed_new AS hazard_addressed_english,
    IFNULL(e.hazard_addressed_new != e.hazard_addressed_english, FALSE) AS hazard_addressed_updated,
    e.hazard_filter_new AS hazard_filter,
    IFNULL(e.hazard_filter_new != e.hazard_filter, FALSE) AS hazard_filter_updated,
    FALSE AS is_nondiscloser,
    ps.public_status
  FROM formatted_existing e
  LEFT JOIN peer_solution_status_lookup ps
    ON e.target_org_id = ps.target_org_id
   AND e.hazard_filter_new = ps.hazard_filter
   AND e.action_english = ps.action_english
   AND e.action_index = ps.action_index
),

gee_target_geoms AS (
  SELECT
    target_org_id,
    ARRAY_AGG(geometry ORDER BY source_priority DESC LIMIT 1)[OFFSET(0)] AS geometry
  FROM (
    SELECT
      ps.target_org_id,
      d.geometry,
      1 AS source_priority
    FROM (
      SELECT DISTINCT target_org_id
      FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
      WHERE public_status = 'GEE-Derived'
        AND target_org_id IS NOT NULL
    ) ps
    INNER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST` d
      ON ps.target_org_id = d.cdp_disclosing_org_number
    WHERE d.geometry IS NOT NULL

    UNION ALL

    SELECT
      SAFE_CAST(n.account_id AS INT64) AS target_org_id,
      COALESCE(
        ST_GEOGFROMTEXT(REGEXP_REPLACE(gf.geometry_wkt, r' (Z|ZM|M) ', ' '), make_valid => TRUE),
        ST_GEOGFROMTEXT(REGEXP_REPLACE(n.geometry_wkt, r' (Z|ZM|M) ', ' '), make_valid => TRUE)
      ) AS geometry,
      2 AS source_priority
    FROM `project-bb4fd058-24e7-4ccb-b06.Missing_Data.nondiscloser-geometries` n
    LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.Missing_Data.geometry-fixes` gf
      ON SAFE_CAST(gf.account_id AS INT64) = SAFE_CAST(n.account_id AS INT64)
    WHERE SAFE_CAST(n.account_id AS INT64) IN (
      SELECT DISTINCT target_org_id
      FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
      WHERE public_status = 'GEE-Derived'
        AND target_org_id IS NOT NULL
    )
  )
  WHERE target_org_id IS NOT NULL
    AND geometry IS NOT NULL
  GROUP BY target_org_id
),

gee_target_ecoregions AS (
  SELECT
    g.target_org_id,
    eco.BIOME_NAME AS target_ecoregion
  FROM gee_target_geoms g
  LEFT JOIN `project-bb4fd058-24e7-4ccb-b06.climate_zones.ecoregions` eco
    ON ST_INTERSECTS(g.geometry, eco.geometry)
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY g.target_org_id
    ORDER BY ST_AREA(ST_INTERSECTION(g.geometry, eco.geometry)) DESC NULLS LAST
  ) = 1
),

/* -------------------------
   Hazard-specific examples
   ------------------------- */

gee_peer_solution_rows_hazard AS (
  SELECT *
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
  WHERE public_status = 'GEE-Derived'
    AND hazard_filter != 'All'
    AND action_rank <= 5
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY target_org_id, hazard_filter
    ORDER BY action_count DESC, pct_peers DESC, solution_category, solution
  ) <= 25
),

peer_action_examples_hazard AS (
  SELECT DISTINCT
    ps.disclosing_year,
    ps.target_org_id,
    a.row_order,
    ps.hazard_filter,
    ps.action_english,
    ps.action_index,
    ps.public_status,
    ps.action_count,
    a.cdp_disclosing_org_number AS peer_org_id,
    a.disclosing_organization AS peer_org_name,
    a.hazard_addressed_english,
    a.action_description_english,
    a.sectors_applied_english,
    a.resilience_enhanced_english,
    a.cobenefit_realized_english,
    a.timeframe_english,
    a.funding_source_english,
    a.action_status_english,
    a.total_cost_usd,
    (
      CASE WHEN a.hazard_addressed_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.action_description_english IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN a.sectors_applied_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.resilience_enhanced_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.cobenefit_realized_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.timeframe_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.funding_source_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.action_status_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.total_cost_usd IS NOT NULL THEN 1 ELSE 0 END
    ) AS completeness_score
  FROM gee_peer_solution_rows_hazard ps
  INNER JOIN gee_target_ecoregions t
    ON ps.target_org_id = t.target_org_id
  INNER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST` a
    ON ps.action_english = a.action_english
   AND ps.action_index = a.action_index
  INNER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST` d
    ON a.cdp_disclosing_org_number = d.cdp_disclosing_org_number
   AND d.public_status = 'Public'
   AND d.ecoregion = t.target_ecoregion
  CROSS JOIN UNNEST(SPLIT(a.hazard_addressed_english, '|')) AS hazard
  WHERE TRIM(hazard) = ps.hazard_filter
    AND a.cdp_disclosing_org_number != ps.target_org_id
),

/* -------------------------
   All-hazard examples
   ------------------------- */

gee_peer_solution_rows_all AS (
  SELECT *
  FROM `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.peer_solutions_final_TEST`
  WHERE public_status = 'GEE-Derived'
    AND hazard_filter = 'All'
    AND action_rank <= 5
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY target_org_id
    ORDER BY action_count DESC, pct_peers DESC, solution_category, solution
  ) <= 25
),

peer_action_examples_all AS (
  SELECT DISTINCT
    ps.disclosing_year,
    ps.target_org_id,
    a.row_order,
    ps.hazard_filter,
    ps.action_english,
    ps.action_index,
    ps.public_status,
    ps.action_count,
    a.cdp_disclosing_org_number AS peer_org_id,
    a.disclosing_organization AS peer_org_name,
    a.hazard_addressed_english,
    a.action_description_english,
    a.sectors_applied_english,
    a.resilience_enhanced_english,
    a.cobenefit_realized_english,
    a.timeframe_english,
    a.funding_source_english,
    a.action_status_english,
    a.total_cost_usd,
    (
      CASE WHEN a.hazard_addressed_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.action_description_english IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN a.sectors_applied_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.resilience_enhanced_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.cobenefit_realized_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.timeframe_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.funding_source_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.action_status_english IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN a.total_cost_usd IS NOT NULL THEN 1 ELSE 0 END
    ) AS completeness_score
  FROM gee_peer_solution_rows_all ps
  INNER JOIN gee_target_ecoregions t
    ON ps.target_org_id = t.target_org_id
  INNER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.fact_action_final_TEST` a
    ON ps.action_english = a.action_english
   AND ps.action_index = a.action_index
  INNER JOIN `project-bb4fd058-24e7-4ccb-b06.CSTAR_2025_processed_v2.dim_cdp_geo_and_ecoregion_TEST` d
    ON a.cdp_disclosing_org_number = d.cdp_disclosing_org_number
   AND d.public_status = 'Public'
   AND d.ecoregion = t.target_ecoregion
  WHERE a.cdp_disclosing_org_number != ps.target_org_id
    AND a.hazard_addressed_english IS NOT NULL
    AND TRIM(a.hazard_addressed_english) != ''
    AND TRIM(a.hazard_addressed_english) != 'Action does not address hazard'
),

peer_action_examples AS (
  SELECT * FROM peer_action_examples_hazard
  UNION ALL BY NAME
  SELECT * FROM peer_action_examples_all
),

ranked_examples AS (
  SELECT
    * EXCEPT(action_count),
    ROW_NUMBER() OVER (
      PARTITION BY target_org_id, hazard_filter, action_english, action_index
      ORDER BY completeness_score DESC, peer_org_id
    ) AS example_rank
  FROM peer_action_examples
),

gee_solution_examples_raw AS (
  SELECT
    disclosing_year,
    target_org_id,
    row_order,
    hazard_filter,
    action_english,
    action_index,
    public_status,
    peer_org_id,
    peer_org_name,
    hazard_addressed_english,
    action_description_english,
    sectors_applied_english,
    resilience_enhanced_english,
    cobenefit_realized_english,
    timeframe_english,
    funding_source_english,
    action_status_english,
    total_cost_usd,
    completeness_score
  FROM ranked_examples
  WHERE example_rank <= 10
),

gee_solution_examples_formatted AS (
  SELECT
    *,
    CASE
      WHEN hazard_addressed_english IS NULL THEN NULL
      ELSE ARRAY_TO_STRING(
        ARRAY(
          SELECT format_hazard(h)
          FROM UNNEST(SPLIT(hazard_addressed_english, '|')) AS h
        ),
        '|'
      )
    END AS hazard_addressed_new,
    CASE
      WHEN hazard_filter IS NULL THEN NULL
      ELSE ARRAY_TO_STRING(
        ARRAY(
          SELECT format_hazard(h)
          FROM UNNEST(SPLIT(hazard_filter, '|')) AS h
        ),
        '|'
      )
    END AS hazard_filter_new
  FROM gee_solution_examples_raw
),

gee_solution_examples AS (
  SELECT
    * EXCEPT(hazard_addressed_english, hazard_filter, hazard_addressed_new, hazard_filter_new),
    hazard_addressed_new AS hazard_addressed_english,
    FALSE AS hazard_addressed_updated,
    hazard_filter_new AS hazard_filter,
    FALSE AS hazard_filter_updated,
    TRUE AS is_nondiscloser
  FROM gee_solution_examples_formatted
)

SELECT * FROM existing_rows
FULL OUTER UNION ALL BY NAME
SELECT * FROM gee_solution_examples;
