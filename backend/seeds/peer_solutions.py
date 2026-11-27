from decimal import Decimal

from app.models.location_details import PeerSolutions
from seeds.discloser import ACTION, ACTION_INDEX, HAZARD, ORG_ID, YEAR

ROWS = [
    PeerSolutions(
        disclosing_year=YEAR,
        target_org_id=ORG_ID,
        hazard_filter="All",
        action_index=ACTION_INDEX,
        solution_category="Ecosystem-based actions",
        solution="Green infrastructure",
        action_rank=1,
        action_english=ACTION,
        hazard_addressed=HAZARD,
        peer_org_cnt=1,
        action_count=1,
        pct_peers=Decimal("1.0"),
        has_local_action=True,
    )
]
