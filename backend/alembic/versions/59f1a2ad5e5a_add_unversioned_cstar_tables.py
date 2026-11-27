"""add unversioned cstar tables

Blue/green step 1: create the year-less CSTAR tables (e.g. "Dim_Central").

Two cases, decided per table:

* The old CSTAR_2025_<table> exists (cdp-test, staging, prod, local copies):
  copy its structure with LIKE ... INCLUDING ALL and copy the 2025 rows across.
  The CSTAR_2025_* tables are left untouched, so the app keeps working on them
  until CSTAR_TABLE_PREFIX is switched.

* It doesn't exist (a fresh, empty database, e.g. a per-PR preview DB):
  create the year-less table directly from the definitions below. They were
  taken from `pg_dump --schema-only` of prod's CSTAR_2025_* tables, so on prod
  both paths give identical tables (column order, NOT NULLs, primary keys and
  geometry indexes). That includes the schema changes made by the scripts in
  scripts/one-time-applied/ (row_order in the Fact_Action/Solution_Examples
  PKs, public_status in the Fact_Hazard PK).

  cdp-test's old tables also carry 9 extra indexes added by hand, which the
  copy path copies across; the next migration drops them.

The old tables get dropped in a later migration once the new ones are trusted.

Revision ID: 59f1a2ad5e5a
Revises: 7e96002e433d
Create Date: 2026-11-17 11:21:13.437487

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "59f1a2ad5e5a"
down_revision: Union[str, Sequence[str], None] = "7e96002e433d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_PREFIX = "CSTAR_2025_"

# Definitions for the fresh-database path, one entry per table (in order).
CREATE_SQL: dict[str, list[str]] = {
    "Dim_Central": [
        """
        CREATE TABLE "Dim_Central" (
            disclosure_cycle character varying(255),
            cdp_requesting_org_number integer,
            requesting_organization character varying(255),
            projects character varying(255),
            cdp_requested_org_number integer,
            requested_organization character varying(255),
            cdp_disclosing_org_number integer NOT NULL,
            disclosing_organization character varying(255),
            disclosing_org_type character varying(255),
            cdp_region character varying(255),
            discloser_country_or_area character varying(255),
            questionnaire character varying(255),
            eligible_pathway character varying(255),
            selected_pathway character varying(255),
            disclosure_status character varying(255),
            public_status character varying(255),
            previous_response_status character varying(255),
            reporting_language character varying(255),
            reporting_gov character varying(255),
            next_high_gov character varying(255),
            next_low_gov character varying(255),
            jdx_areasize double precision,
            jdx_natural_pct character varying(255),
            current_pop double precision,
            cur_pop_year double precision,
            proj_pop double precision,
            proj_pop_year double precision,
            reporting_currency character varying(255),
            reporting_framework character varying(255),
            climate_assess_yn character varying(255),
            adpt_goal_yn character varying(255),
            action_plan_yn text,
            champ_yn boolean,
            gs_gn character varying(255),
            gdp_pc double precision,
            dev_status character varying(255),
            income_group character varying(255),
            fx_rate double precision,
            disclosing_year integer NOT NULL,
            ranked_hazards text,
            ranked_sectors text,
            requesting_auth character varying(255),
            ided_non_disclosers character varying(255),
            has_geometry boolean,
            ecoregion character varying(255),
            geometry public.geometry(Geometry,4326),
            centroid public.geometry(Geometry,4326),
            geom_wkt text,
            centroid_wkt text,
            CONSTRAINT "Dim_Central_pkey"
                PRIMARY KEY (cdp_disclosing_org_number, disclosing_year)
        )
        """,
        'CREATE INDEX "Dim_Central_centroid_idx" ON "Dim_Central" USING gist (centroid)',
        'CREATE INDEX "Dim_Central_geometry_idx" ON "Dim_Central" USING gist (geometry)',
    ],
    "Fact_Hazard": [
        """
        CREATE TABLE "Fact_Hazard" (
            disclosure_cycle character varying(255),
            cdp_disclosing_org_number integer NOT NULL,
            public_status character varying(255) NOT NULL,
            hazard_english character varying(255) NOT NULL,
            population_exposed_english text,
            sectors_exposed_english text,
            impacts text,
            population_range character varying(255),
            hazard_probability character varying(255),
            hazard_magnitude character varying(255),
            intensity_change character varying(255),
            frequency_change character varying(255),
            time_frame character varying(255),
            summary_text text,
            hazard_rank integer NOT NULL,
            disclosing_year integer NOT NULL,
            CONSTRAINT "Fact_Hazard_pkey" PRIMARY KEY (
                cdp_disclosing_org_number, hazard_rank, disclosing_year, public_status
            )
        )
        """,
    ],
    "Fact_Goal": [
        """
        CREATE TABLE "Fact_Goal" (
            disclosure_cycle character varying(255),
            cdp_disclosing_org_number integer NOT NULL,
            disclosing_organization character varying(255),
            public_status character varying(255),
            goal_english text,
            hazard_addressed_english text,
            base_year numeric,
            target_year numeric,
            metric_used_english text,
            comment_english text,
            disclosing_year integer NOT NULL,
            goal_index integer NOT NULL,
            CONSTRAINT "Fact_Goal_pkey" PRIMARY KEY (
                cdp_disclosing_org_number, disclosing_year, goal_index
            )
        )
        """,
    ],
    "Fact_Action": [
        """
        CREATE TABLE "Fact_Action" (
            disclosure_cycle character varying(255),
            cdp_disclosing_org_number integer NOT NULL,
            disclosing_organization character varying(255),
            public_status character varying(255),
            action_english text,
            hazard_addressed_english text,
            action_description_english text,
            sectors_applied_english text,
            resilience_enhanced_english text,
            cobenefit_realized_english text,
            timeframe_english character varying(255),
            funding_source_english text,
            action_status_english text,
            total_cost_usd numeric,
            action_index integer NOT NULL,
            disclosing_year integer NOT NULL,
            row_order integer NOT NULL,
            CONSTRAINT "Fact_Action_pkey" PRIMARY KEY (
                cdp_disclosing_org_number, disclosing_year, action_index, row_order
            )
        )
        """,
    ],
    "Fact_Funding_Gap": [
        """
        CREATE TABLE "Fact_Funding_Gap" (
            disclosure_cycle character varying(255),
            cdp_disclosing_org_number integer NOT NULL,
            disclosing_organization character varying(255),
            public_status character varying(255),
            project_area_english text,
            project_title_english text,
            development_stage character varying(255),
            finance_status_english text,
            finance_model_english text,
            project_descirption_english text,
            total_cost_usd numeric,
            total_needed_usd numeric,
            disclosing_year integer NOT NULL,
            project_area_index integer NOT NULL,
            project_index integer NOT NULL,
            CONSTRAINT "Fact_Funding_Gap_pkey" PRIMARY KEY (
                cdp_disclosing_org_number, disclosing_year,
                project_area_index, project_index
            )
        )
        """,
    ],
    "Peer_Solutions": [
        """
        CREATE TABLE "Peer_Solutions" (
            disclosing_year integer NOT NULL,
            target_org_id integer NOT NULL,
            hazard_filter character varying(255) NOT NULL,
            solution_category character varying(255),
            solution text,
            action_rank integer,
            action_english text,
            action_index integer NOT NULL,
            hazard_addressed character varying(255),
            peer_org_cnt integer,
            action_count integer,
            pct_peers numeric,
            has_local_action boolean,
            CONSTRAINT "Peer_Solutions_pkey" PRIMARY KEY (
                disclosing_year, target_org_id, hazard_filter, action_index
            )
        )
        """,
    ],
    "Solution_Examples": [
        """
        CREATE TABLE "Solution_Examples" (
            disclosing_year integer NOT NULL,
            target_org_id integer NOT NULL,
            hazard_filter character varying(255) NOT NULL,
            action_english text,
            peer_org_id integer NOT NULL,
            peer_org_name character varying(255),
            action_index integer NOT NULL,
            hazard_addressed_english text,
            action_description_english text,
            sectors_applied_english text,
            resilience_enhanced_english text,
            cobenefit_realized_english text,
            timeframe_english character varying(255),
            funding_source_english text,
            action_status_english text,
            total_cost_usd numeric,
            completeness_score integer,
            row_order integer NOT NULL,
            CONSTRAINT "Solution_Examples_pkey" PRIMARY KEY (
                disclosing_year, target_org_id, hazard_filter,
                peer_org_id, action_index, row_order
            )
        )
        """,
    ],
}
TABLES = list(CREATE_SQL)


def upgrade() -> None:
    """Create the year-less tables: copied from 2025 if present, else empty."""
    inspector = sa.inspect(op.get_bind())

    # PostGIS for the geometry columns. Already installed on cdp-test/prod
    # (no-op there); needed on a fresh database.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    for table in TABLES:
        old = f"{OLD_PREFIX}{table}"
        if inspector.has_table(old):
            # INCLUDING ALL copies column types, defaults, NOT NULLs, the
            # primary key and the indexes (incl. the PostGIS geometry indexes).
            op.execute(f'CREATE TABLE "{table}" (LIKE "{old}" INCLUDING ALL)')
            op.execute(f'INSERT INTO "{table}" SELECT * FROM "{old}"')
            op.execute(f'ANALYZE "{table}"')
        else:
            for statement in CREATE_SQL[table]:
                op.execute(statement)


def downgrade() -> None:
    """Drop the year-less tables. The CSTAR_2025_* tables are unaffected.

    PostGIS is left installed: other tables may depend on it.
    """
    for table in reversed(TABLES):
        op.execute(f'DROP TABLE IF EXISTS "{table}"')
