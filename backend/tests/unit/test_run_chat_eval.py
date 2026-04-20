import json

from utility_scripts.run_chat_eval import load_cases_from_json


def test_load_cases_from_json_supports_list_root(tmp_path):
    cases_file = tmp_path / "cases.json"
    cases_file.write_text(
        json.dumps(
            [
                {
                    "question": "What is the flood risk?",
                    "location": "Mumbai, India",
                    "locationData": {
                        "organizationId": 123,
                        "name": "City of Mumbai",
                        "countryName": "India",
                        "lat": 19.076,
                        "lng": 72.8777,
                        "geometry": {},
                        "hazards": {
                            "statistics": {"vulnerableSectors": []},
                            "hazards": [],
                        },
                        "governmentActions": {
                            "goals": [],
                            "actions": [],
                            "projects": [],
                        },
                        "solutions": {
                            "solutions": {},
                        },
                    },
                }
            ]
        ),
        encoding="utf-8",
    )

    cases = load_cases_from_json(cases_file)

    assert len(cases) == 1
    assert cases[0]["location"] == "Mumbai, India"
    assert cases[0]["locationData"]["name"] == "City of Mumbai"
