-- CENTRAL DIMENSION TABLE --
--drop table "CSTAR_2025_Dim_Central"
CREATE TABLE "CSTAR_2025_Dim_Central" (
    "disclosure_cycle" VARCHAR(255),
    "cdp_requesting_org_number" integer,
    "requesting_organization" character varying(255),
    "projects" character varying(255),
    "cdp_requested_org_number" integer,
    "requested_organization" character varying(255),
    "cdp_disclosing_org_number" integer,
    "disclosing_organization" character varying(255),
    "disclosing_org_type" character varying(255),
    "cdp_region" character varying(255),
    "discloser_country_or_area" character varying(255),
    "questionnaire" character varying(255),
    "eligible_pathway" character varying(255),
    "selected_pathway" character varying(255),
    "disclosure_status" character varying(255),
    "public_status" character varying(255),
    "previous_response_status" character varying(255),
    "reporting_language" character varying(255),
    "reporting_gov" character varying(255),
    "next_high_gov" character varying(255),
    "next_low_gov" character varying(255),
    "jdx_areasize" double precision,
    "jdx_natural_pct" character varying(255),
    "current_pop" double precision,
    "cur_pop_year" double precision,
    "proj_pop" double precision,
    "proj_pop_year" double precision,
    "reporting_currency" character varying(255),
    "reporting_framework" character varying(255),
    "climate_assess_yn" character varying(255),
    "adpt_goal_yn" character varying(255),
    "action_plan_yn" TEXT,
    "champ_yn" boolean,
    "gs_gn" character varying(255),
    "gdp_pc" double precision,
    "dev_status" character varying(255),
    "income_group" character varying(255),
    "fx_rate" double precision,
    "disclosing_year" INTEGER,
    "ranked_hazards" TEXT,
    "ranked_sectors" TEXT,
    "requesting_auth" character varying(255),
    "ided_non_disclosers" character varying(255),
    "geom_wkt" TEXT,
    "has_geometry" BOOLEAN,
    "ecoregion" character varying(255)

);

-- add primary key for "CSTAR_2025_Dim_Central"
-- Add disclosing_year as part of the primary key
-- 1. Make ALL involved columns Not Null
ALTER TABLE "CSTAR_2025_Dim_Central"
ALTER COLUMN cdp_disclosing_org_number SET NOT NULL,
ALTER COLUMN disclosing_year SET NOT NULL;

-- 2. Create the composite Primary Key
ALTER TABLE "CSTAR_2025_Dim_Central"
ADD CONSTRAINT "CSTAR_2025_Dim_Central_pkey" PRIMARY KEY (cdp_disclosing_org_number, disclosing_year);

-----------------------------------------
--Geospatial Cleanup: Convert the text-based WKT column into a native PostGIS geometry column for map performance.
-- 1. Add the actual spatial column (SRID 4326 = WGS84/GPS)
ALTER TABLE "CSTAR_2025_Dim_Central"
ADD COLUMN geometry GEOMETRY(Geometry, 4326);

-- 2. Parse text into geometry
UPDATE "CSTAR_2025_Dim_Central"
SET geometry = ST_GeomFromText(NULLIF(geom_wkt, ''), 4326)
WHERE geom_wkt IS NOT NULL AND geom_wkt != '';

-- 3. Create a spatial index (Crucial for map performance)
CREATE INDEX idx_target_table_geom
ON "CSTAR_2025_Dim_Central"  USING GIST (geometry);

-- 4. Clean up intermediate column
ALTER TABLE "CSTAR_2025_Dim_Central"
DROP COLUMN geom_wkt;

-----------------------------------------
-- change requesting org to pipe deliminated too to be consistent
UPDATE "CSTAR_2025_Dim_Central"
SET "requesting_auth" = REPLACE("requesting_auth", ',', '|')
WHERE "requesting_auth" LIKE '%,%'; -- Optional: Only update rows containing a comma

-- FACT HAZARD TABLE --
--drop table "CSTAR_2025_Fact_Hazard";
CREATE TABLE "CSTAR_2025_Fact_Hazard" (
    disclosure_cycle VARCHAR(255),
    cdp_disclosing_org_number INTEGER,
    public_status VARCHAR(255),
    hazard_english VARCHAR(255),
    population_exposed_english TEXT,
    sectors_exposed_english TEXT,
    impacts TEXT,
    population_range VARCHAR(255),
    hazard_probability VARCHAR(255),
    hazard_magnitude VARCHAR(255),
    intensity_change VARCHAR(255),
    frequency_change VARCHAR(255),
    time_frame VARCHAR(255),
    summary_text TEXT,
    hazard_rank INTEGER,
    disclosing_year INTEGER
);

-- add primary key for "CSTAR_2025_Fact_Hazard"
-- 1. Make ALL involved columns Not Null
ALTER TABLE "CSTAR_2025_Fact_Hazard"
ALTER COLUMN cdp_disclosing_org_number SET NOT NULL,
ALTER COLUMN hazard_rank SET NOT NULL,
ALTER COLUMN disclosing_year SET NOT NULL;

-- 2. Create the composite Primary Key
ALTER TABLE "CSTAR_2025_Fact_Hazard"
ADD PRIMARY KEY (cdp_disclosing_org_number, hazard_rank, disclosing_year);

-- FACT GOAL TABLE --
--drop table "CSTAR_2025_Fact_Goal";
CREATE TABLE "CSTAR_2025_Fact_Goal" (
    disclosure_cycle VARCHAR(255),
    cdp_disclosing_org_number INTEGER,
    disclosing_organization VARCHAR(255),
    public_status VARCHAR(255),
    goal_english TEXT,
    hazard_addressed_english TEXT,
    base_year NUMERIC, -- FLOAT is generally not recommended for precise numbers, NUMERIC is better
    target_year NUMERIC,
    metric_used_english TEXT,
    comment_english TEXT,
    disclosing_year INTEGER,
    goal_index INTEGER
);

-- add primary key for "CSTAR_2025_Fact_Goal"
-- 1. Make ALL involved columns Not Null
ALTER TABLE "CSTAR_2025_Fact_Goal"
ALTER COLUMN cdp_disclosing_org_number SET NOT NULL,
ALTER COLUMN disclosing_year SET NOT NULL,
ALTER COLUMN goal_index SET NOT NULL;

-- 2. Create the composite Primary Key
ALTER TABLE "CSTAR_2025_Fact_Goal"
ADD PRIMARY KEY (cdp_disclosing_org_number, disclosing_year, goal_index);

-- FACT ACTION TABLE --
--drop table "CSTAR_2025_Fact_Action";
CREATE TABLE "CSTAR_2025_Fact_Action" (
    "disclosure_cycle" character varying(255),
    "cdp_disclosing_org_number" integer,
    "disclosing_organization" character varying(255),
    "public_status" character varying(255),
    "action_english" text,
    "hazard_addressed_english" text,
    "action_description_english" text,
    "sectors_applied_english" text,
    "resilience_enhanced_english" text,
    "cobenefit_realized_english" text,
    "timeframe_english" character varying(255),
    "funding_source_english" text,
    "action_status_english" text,
    "total_cost_usd" NUMERIC,
    "action_index" INTEGER,
    "disclosing_year" INTEGER
);

-- add primary key for "CSTAR_2025_Fact_Goal"
-- 1. Make ALL involved columns Not Null
ALTER TABLE "CSTAR_2025_Fact_Action"
ALTER COLUMN cdp_disclosing_org_number SET NOT NULL,
ALTER COLUMN disclosing_year SET NOT NULL,
ALTER COLUMN action_index SET NOT NULL;

-- 2. Create the composite Primary Key
ALTER TABLE "CSTAR_2025_Fact_Action"
ADD PRIMARY KEY (cdp_disclosing_org_number, disclosing_year, action_index);


-- FACT FUNDING GAP TABLE --
--drop table "CSTAR_2025_Fact_Funding_Gap";
CREATE TABLE "CSTAR_2025_Fact_Funding_Gap" (
    "disclosure_cycle" character varying(255),
    "cdp_disclosing_org_number" integer,
    "disclosing_organization" character varying(255),
    "public_status" character varying(255),
    "project_area_english" TEXT,
    "project_title_english" TEXT,
    "development_stage" character varying(255),
    "finance_status_english" TEXT,
    "finance_model_english" TEXT,
    "project_descirption_english" text,
    "total_cost_usd" numeric,
    "total_needed_usd" numeric,
    "disclosing_year" INTEGER,
    "project_area_index" INTEGER,
    "project_index" INTEGER
);

-- add primary key for "CSTAR_2025_Fact_Funding_Gap"
-- 1. Make ALL involved columns Not Null
ALTER TABLE "CSTAR_2025_Fact_Funding_Gap"
ALTER COLUMN cdp_disclosing_org_number SET NOT NULL,
ALTER COLUMN disclosing_year SET NOT NULL,
ALTER COLUMN project_area_index SET NOT NULL,
ALTER COLUMN project_index SET NOT NULL;

-- 2. Create the composite Primary Key
ALTER TABLE "CSTAR_2025_Fact_Funding_Gap"
ADD PRIMARY KEY (cdp_disclosing_org_number, disclosing_year, project_area_index, project_index);


---- Peer Solution TABLE --
--drop table "CSTAR_2025_Peer_Solutions";
CREATE TABLE "CSTAR_2025_Peer_Solutions" (
    disclosing_year INTEGER,
    target_org_id INTEGER,
    hazard_filter VARCHAR(255),
    solution_category VARCHAR(255), -- Use VARCHAR for STRING type, specify a length
    solution TEXT,
    action_rank INTEGER,
    action_english TEXT,           -- Use TEXT for potentially longer strings
    action_index INTEGER,
    hazard_addressed VARCHAR(255),
    peer_org_cnt INTEGER,
    action_count INTEGER,
    pct_peers NUMERIC,        -- Use NUMERIC for FLOAT, specify precision and scale
    has_local_action BOOLEAN
);

-- add primary key
-- 1. Make ALL involved columns Not Null
ALTER TABLE "CSTAR_2025_Peer_Solutions"
ALTER COLUMN disclosing_year SET NOT NULL,
ALTER COLUMN target_org_id SET NOT NULL,
ALTER COLUMN hazard_filter SET NOT NULL,
ALTER COLUMN action_index SET NOT NULL;

-- 2. Create the composite Primary Key
ALTER TABLE "CSTAR_2025_Peer_Solutions"
ADD PRIMARY KEY (disclosing_year, target_org_id, hazard_filter, action_index);

---- Solution Examples TABLE --
--drop table "CSTAR_2025_Solution_Examples";
CREATE TABLE "CSTAR_2025_Solution_Examples" (
    disclosing_year INTEGER,
    target_org_id INTEGER,
    hazard_filter VARCHAR(255),
    action_english TEXT,           -- Use TEXT for potentially long strings
    peer_org_id INTEGER,
    peer_org_name VARCHAR(255),
    action_index INTEGER,
    hazard_addressed_english TEXT, -- Use TEXT for potentially long strings
    action_description_english TEXT, -- Use TEXT for potentially long strings
    sectors_applied_english TEXT,  -- Use TEXT for potentially long strings
    resilience_enhanced_english TEXT, -- Use TEXT for potentially long strings
    cobenefit_realized_english TEXT, -- Use TEXT for potentially long strings
    timeframe_english VARCHAR(255),  -- Use VARCHAR for shorter strings, specify length
    funding_source_english TEXT,   -- Use TEXT for potentially long strings
    action_status_english TEXT, -- Use VARCHAR for shorter strings, specify length
    total_cost_usd NUMERIC, -- Use NUMERIC for monetary values, specify precision and scale
    completeness_score INTEGER
);

-- add primary key
-- 1. Make ALL involved columns Not Null
ALTER TABLE "CSTAR_2025_Solution_Examples"
ALTER COLUMN disclosing_year SET NOT NULL,
ALTER COLUMN target_org_id SET NOT NULL,
ALTER COLUMN hazard_filter SET NOT NULL,
ALTER COLUMN peer_org_id SET NOT NULL,
ALTER COLUMN action_index SET NOT NULL;

-- 2. Create the composite Primary Key
ALTER TABLE "CSTAR_2025_Solution_Examples"
ADD PRIMARY KEY (disclosing_year, target_org_id, hazard_filter, peer_org_id, action_index);
