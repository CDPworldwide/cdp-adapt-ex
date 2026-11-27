from app.models.location_details import FactHazards
from seeds.discloser import HAZARD, ORG_ID, YEAR

ROWS = [
    FactHazards(
        cdp_disclosing_org_number=ORG_ID,
        disclosing_year=YEAR,
        hazard_rank=1,
        hazard_english=HAZARD,
        public_status="Public",
        hazard_probability="High",
        hazard_magnitude="High",
        intensity_change="Increasing",
        frequency_change="Increasing",
        time_frame="Medium-term (2026-2050)",
        summary_text="Mountain View faces a high risk of drought.",
    )
]
