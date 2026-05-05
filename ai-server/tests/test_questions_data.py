import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_FILE = ROOT / "data" / "questions.json"
ORG_DATA_DIR = ROOT / "org-data"


def test_questions_file_contains_reviewed_batch_cases():
    payload = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
    cases = payload["cases"]

    assert len(cases) == 20
    assert {case["orgId"] for case in cases} == {
        831391,
        10894,
        31176,
        73051,
        31169,
        74594,
    }
    assert all(case["question"].strip() for case in cases)
    assert any("mitigation" in case["question"] for case in cases)
    assert any("ranked the hazards" in case["question"] for case in cases)


def test_questions_file_org_ids_have_location_context():
    payload = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))

    for case in payload["cases"]:
        org_data_path = ORG_DATA_DIR / f"{case['orgId']}.json"
        assert org_data_path.exists()
        org_data = json.loads(org_data_path.read_text(encoding="utf-8"))
        assert org_data["organizationId"] == case["orgId"]
        assert org_data["geometry"] == {}
