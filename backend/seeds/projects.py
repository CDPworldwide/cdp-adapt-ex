from app.models.location_details import FactProjects
from seeds.discloser import ORG_ID, ORG_NAME, YEAR

ROWS = [
    FactProjects(
        cdp_disclosing_org_number=ORG_ID,
        disclosing_year=YEAR,
        project_index=1,
        project_area_index=1,
        disclosing_organization=ORG_NAME,
        public_status="Public",
        project_area_english="Water management",
        project_title_english="Recycled Water Expansion",
        development_stage="Implementation",
        finance_status_english="Project partially funded and seeking additional "
        "funding",
        finance_model_english="Grants",
        total_cost_usd=5000000,
        total_needed_usd=500000,
    )
]
