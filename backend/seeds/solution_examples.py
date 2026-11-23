from app.models.location_details import SolutionsExamples
from seeds.discloser import ACTION, ACTION_INDEX, HAZARD, ORG_ID, YEAR

# The peer isn't seeded, so its map thumbnail won't show.
PEER_ORG_ID = 14088

ROWS = [
    SolutionsExamples(
        disclosing_year=YEAR,
        target_org_id=ORG_ID,
        hazard_filter="All",
        action_index=ACTION_INDEX,
        row_order=0,
        peer_org_id=PEER_ORG_ID,
        peer_org_name="Oslo Municipality",
        action_english=ACTION,
        hazard_addressed_english=HAZARD,
        action_description_english="Green roofs and open stormwater channels.",
        action_status_english="Action in operation (jurisdiction-wide)",
        timeframe_english="Medium-term (2026-2050)",
        funding_source_english="Jurisdiction's own resources",
        completeness_score=1,
    )
]
