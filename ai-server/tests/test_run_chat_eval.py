import csv
import json
from urllib import error

from utility_scripts.run_chat_eval import (
    build_payload_summary,
    load_cases_from_json,
    load_cases_from_questions_file,
    load_cases_from_reviewed_comments,
    post_chat_completion,
    score_case,
)


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
    assert cases[0]["locationData"]["organizationId"] == 123
    assert cases[0]["locationData"]["name"] == "City of Mumbai"


def test_load_cases_from_reviewed_comments_uses_org_data_context(tmp_path):
    comments_csv = tmp_path / "comments.csv"
    org_data_dir = tmp_path / "org-data"
    org_data_dir.mkdir()
    with comments_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "source_file",
                "source_row",
                "org_id",
                "matched_organization",
                "matched_country_or_area",
                "page_or_jurisdiction",
                "question",
                "review",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "source_file": "reviewer.csv",
                "source_row": "7",
                "org_id": "831391",
                "matched_organization": "Queretaro",
                "matched_country_or_area": "Mexico",
                "page_or_jurisdiction": "Queretaro, Mexico",
                "question": "has the city ranked the hazards?",
                "review": "Do not claim formal ranking",
            }
        )
    (org_data_dir / "831391.json").write_text(
        json.dumps(
            {
                "organizationId": 831391,
                "name": "Queretaro",
                "countryName": "Mexico",
                "disclosureYear": 2025,
                "geometry": {},
                "hazards": {
                    "statistics": {
                        "populationExposedPercentage": 50,
                        "vulnerableSectors": [],
                    },
                    "hazards": [
                        {
                            "hazard": {"hazardType": "DROUGHT"},
                            "proportionExposedRange": "41-50%",
                        }
                    ],
                },
                "governmentActions": {
                    "goals": [],
                    "actions": [],
                    "projects": [],
                },
                "solutions": {"solutions": {}},
            }
        ),
        encoding="utf-8",
    )

    cases = load_cases_from_reviewed_comments(comments_csv, org_data_dir)

    assert len(cases) == 1
    assert cases[0]["id"] == "reviewed-831391-7"
    assert cases[0]["question"] == "has the city ranked the hazards?"
    assert cases[0]["review"] == "Do not claim formal ranking"
    assert cases[0]["locationData"]["organizationId"] == 831391
    assert cases[0]["locationData"]["disclosureYear"] == 2025
    assert cases[0]["locationData"]["hazards"]["hazards"][0]["hazardRank"] == 1


def test_load_questions_file_resolves_org_data_context(tmp_path):
    questions_file = tmp_path / "questions.json"
    org_data_dir = tmp_path / "org-data"
    org_data_dir.mkdir()
    questions_file.write_text(
        json.dumps(
            {
                "cases": [
                    {
                        "id": "critical-ranking",
                        "orgId": 831391,
                        "location": "Queretaro, Mexico",
                        "question": "has the city ranked the hazards?",
                        "review": "Do not claim formal ranking",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    (org_data_dir / "831391.json").write_text(
        json.dumps(
            {
                "organizationId": 831391,
                "name": "Queretaro",
                "countryName": "Mexico",
                "geometry": {},
                "hazards": {
                    "statistics": {"vulnerableSectors": []},
                    "hazards": [{"hazard": {"hazardType": "DROUGHT"}}],
                },
                "governmentActions": {"goals": [], "actions": [], "projects": []},
                "solutions": {"solutions": {}},
            }
        ),
        encoding="utf-8",
    )

    cases = load_cases_from_questions_file(questions_file, org_data_dir)

    assert cases[0]["id"] == "critical-ranking"
    assert cases[0]["orgId"] == 831391
    assert cases[0]["review"] == "Do not claim formal ranking"
    assert cases[0]["locationData"]["organizationId"] == 831391
    assert cases[0]["locationData"]["name"] == "Queretaro"


def test_questions_file_loader_trims_solution_context(tmp_path):
    questions_file = tmp_path / "questions.json"
    org_data_dir = tmp_path / "org-data"
    org_data_dir.mkdir()
    questions_file.write_text(
        json.dumps(
            {
                "cases": [
                    {
                        "id": "solution-trimming",
                        "orgId": 1,
                        "question": "What peer actions are relevant?",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    (org_data_dir / "1.json").write_text(
        json.dumps(
            {
                "organizationId": 1,
                "name": "Test City",
                "countryName": "Test Country",
                "geometry": {},
                "hazards": {"statistics": {}, "hazards": []},
                "governmentActions": {"goals": [], "actions": [], "projects": []},
                "solutions": {
                    "solutions": {
                        "BEHAVIOURAL": [
                            {
                                "solution": f"Solution {index}",
                                "peerActions": [
                                    {
                                        "peerName": f"Peer {peer_index}",
                                        "action": {
                                            "title": "Action",
                                            "description": "x" * 2000,
                                        },
                                    }
                                    for peer_index in range(4)
                                ],
                            }
                            for index in range(5)
                        ]
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    cases = load_cases_from_questions_file(questions_file, org_data_dir)
    cards = cases[0]["locationData"]["solutions"]["solutions"]["BEHAVIOURAL"]

    assert len(cards) == 3
    assert len(cards[0]["peerActions"]) == 2
    assert cards[0]["peerActions"][0]["action"]["description"].endswith(
        "... [truncated]"
    )
    assert "dataProvenance" in cases[0]["locationData"]


def test_build_payload_summary_reports_compact_context_counts():
    case = {
        "id": "case-1",
        "orgId": 1,
        "location": "Test City",
        "question": "What is happening?",
    }
    payload = {
        "messages": [{"role": "user", "content": case["question"]}],
        "locationData": {
            "organizationId": 1,
            "hazards": {"hazards": [{}, {}]},
            "governmentActions": {
                "goals": [{}],
                "actions": [{}, {}, {}],
                "projects": [{}],
            },
            "solutions": {
                "solutions": {
                    "BEHAVIOURAL": [
                        {"peerActions": [{}, {}]},
                        {"peerActions": [{}]},
                    ]
                }
            },
            "dataProvenance": {
                "aggregateStatistics": "aggregate note",
                "hazardOrdering": "ordering note",
                "contextTrimming": "trimming note",
            },
        },
    }

    summary = build_payload_summary(case, payload)

    assert summary["payloadBytes"] > 0
    assert summary["counts"] == {
        "hazards": 2,
        "goals": 1,
        "actions": 3,
        "projects": 1,
        "solutionCards": 2,
        "peerActions": 3,
    }
    assert summary["provenance"]["hazardOrdering"] == "ordering note"


def test_score_case_applies_review_assertions():
    score = score_case(
        "The disclosure does not show a formal ranking. The platform data has ordering.",
        [],
        assertions={
            "requiredAll": ["formal ranking"],
            "requiredAny": ["platform data", "structured data"],
            "forbidden": ["CSTAR", "directly stated in the disclosure"],
        },
    )

    assert score["passed"] is True
    assert score["assertions"]["matchedAll"] == ["formal ranking"]
    assert score["assertions"]["matchedAny"] == ["platform data"]
    assert score["assertions"]["forbiddenFound"] == []


def test_score_case_fails_missing_and_forbidden_assertions():
    score = score_case(
        "Yes, this is directly stated in the disclosure.",
        [],
        assertions={
            "requiredAll": ["formal ranking"],
            "requiredAnyGroups": [["platform data", "structured data"]],
            "forbidden": ["directly stated in the disclosure"],
        },
    )

    assert score["passed"] is False
    assert score["assertions"]["missingAll"] == ["formal ranking"]
    assert score["assertions"]["missingAnyGroups"] == [
        ["platform data", "structured data"]
    ]
    assert score["assertions"]["forbiddenFound"] == [
        "directly stated in the disclosure"
    ]


def test_post_chat_completion_retries_transient_http_errors(monkeypatch):
    attempts = []

    class StubResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def read(self):
            return b'{"choices":[{"message":{"content":"ok"}}]}'

    def stub_urlopen(req, timeout):
        attempts.append(req)
        if len(attempts) == 1:
            raise error.HTTPError(
                req.full_url,
                502,
                "bad gateway",
                hdrs=None,
                fp=None,
            )
        return StubResponse()

    monkeypatch.setattr("utility_scripts.run_chat_eval.request.urlopen", stub_urlopen)
    monkeypatch.setattr(
        "utility_scripts.run_chat_eval.time.sleep", lambda seconds: None
    )

    response = post_chat_completion(
        "http://example.test",
        "/v1/chat/completions",
        {"messages": []},
        timeout=1,
        retries=1,
    )

    assert response["choices"][0]["message"]["content"] == "ok"
    assert len(attempts) == 2


def test_load_questions_file_preserves_review_assertions():
    cases = load_cases_from_questions_file()
    critical_cases = {case["id"]: case for case in cases if case.get("assertions")}

    assert "comments-row-1" in critical_cases
    assert "comments-row-7" in critical_cases
    assert "CSTAR" in critical_cases["comments-row-1"]["assertions"]["forbidden"]
    assert (
        "may not have reliable mitigation data"
        in critical_cases["comments-row-7"]["assertions"]["requiredAll"]
    )
