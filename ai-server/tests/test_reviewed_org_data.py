import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMMENTS_CSV = ROOT / "comments.csv"
ORG_DATA_DIR = ROOT / "org-data"


def _reviewed_org_ids() -> set[int]:
    with COMMENTS_CSV.open(newline="", encoding="utf-8") as csv_file:
        return {
            int(row["org_id"])
            for row in csv.DictReader(csv_file)
            if row.get("org_id", "").strip()
        }


def test_reviewed_comment_orgs_have_grounding_files():
    org_ids = _reviewed_org_ids()

    assert org_ids == {831391, 10894, 31176, 73051, 31169, 74594}
    for org_id in org_ids:
        data_path = ORG_DATA_DIR / f"{org_id}.json"
        assert data_path.exists(), f"Missing grounding file for {org_id}"

        payload = json.loads(data_path.read_text(encoding="utf-8"))
        assert payload["organizationId"] == org_id
        assert payload["geometry"] == {}
        assert payload["hazards"]["hazards"]


def test_reviewed_org_statistics_are_aggregate_not_per_hazard_claims():
    queretaro = json.loads((ORG_DATA_DIR / "831391.json").read_text(encoding="utf-8"))

    stats = queretaro["hazards"]["statistics"]
    assert stats["populationExposedPercentage"] == 50.0
    assert stats["gdpAtRiskPercentage"] == 25.0

    hazard_ranges = {
        hazard.get("proportionExposedRange")
        for hazard in queretaro["hazards"]["hazards"]
    }
    assert "91-100%" in hazard_ranges
    assert "41-50%" in hazard_ranges
    assert None in hazard_ranges
