from app.models.location_details import FactActions
from seeds.discloser import ACTION, ACTION_INDEX, HAZARD, ORG_ID, ORG_NAME, YEAR

ROWS = [
    FactActions(
        cdp_disclosing_org_number=ORG_ID,
        disclosing_year=YEAR,
        action_index=ACTION_INDEX,
        row_order=0,
        disclosing_organization=ORG_NAME,
        public_status="Public",
        action_english=ACTION,
        hazard_addressed_english=HAZARD,
        action_description_english="Bioswales and rain gardens along city streets.",
        action_status_english="Action in operation (jurisdiction-wide)",
        timeframe_english="Medium-term (2026-2050)",
        funding_source_english="Jurisdiction's own resources",
    )
]
