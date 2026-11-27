from app.models.location_details import FactAdaptationGoals
from seeds.discloser import HAZARD, ORG_ID, ORG_NAME, YEAR

ROWS = [
    FactAdaptationGoals(
        cdp_disclosing_org_number=ORG_ID,
        disclosing_year=YEAR,
        goal_index=1,
        disclosing_organization=ORG_NAME,
        public_status="Public",
        goal_english="Reduce potable water use by 20%.",
        hazard_addressed_english=HAZARD,
        base_year=2020,
        target_year=2030,
    )
]
