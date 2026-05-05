#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path
from typing import Any
from urllib import error, request

DEFAULT_BASE_URL = "http://127.0.0.1:8088"
DEFAULT_ENDPOINT = "/v1/chat/completions"
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
DEFAULT_CASES_FILE = SCRIPT_DIR / "chat_eval_cases.json"
DEFAULT_COMMENTS_CSV = ROOT_DIR / "comments.csv"
DEFAULT_ORG_DATA_DIR = ROOT_DIR / "org-data"
DEFAULT_QUESTIONS_FILE = ROOT_DIR / "data" / "questions.json"
MAX_SOLUTION_CARDS_PER_CATEGORY = 3
MAX_PEER_ACTIONS_PER_SOLUTION = 2
MAX_CONTEXT_TEXT_CHARS = 1200

STATUS_MAP = {
    "implementation": "IMPLEMENTATION_UNDERWAY_COMPLETION_GT_ONE_YEAR",
    "in implementation": "IMPLEMENTATION_UNDERWAY_COMPLETION_GT_ONE_YEAR",
    "in operation": "ACTION_IN_OPERATION_JURISDICTION_WIDE",
    "operational": "ACTION_IN_OPERATION_JURISDICTION_WIDE",
    "scoping": "SCOPING",
    "pre-feasibility": "PRE_FEASIBILITY",
    "pre feasibility": "PRE_FEASIBILITY",
    "project feasibility": "PROJECT_FEASIBILITY",
    "project structuring": "PROJECT_STRUCTURING",
    "transaction preparation": "TRANSACTION_PREPARATION",
    "post implementation": "POST_IMPLEMENTATION",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run local chat endpoint evaluations with locationData context.",
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL for the local API (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help=f"Chat endpoint path (default: {DEFAULT_ENDPOINT})",
    )
    parser.add_argument(
        "--cases-file",
        type=Path,
        default=DEFAULT_CASES_FILE,
        help="Path to a JSON cases file.",
    )
    parser.add_argument(
        "--questions-file",
        type=Path,
        help=(
            "Optional formatted questions JSON file. Cases may include orgId or "
            "accountId and will be paired with org-data/<id>.json."
        ),
    )
    parser.add_argument(
        "--csv-file",
        type=Path,
        help="Optional CSV file with Question / Location / Relevant Data columns.",
    )
    parser.add_argument(
        "--comments-csv",
        type=Path,
        help=(
            "Optional reviewed comments.csv file. Each question is paired with "
            "org-data/<org_id>.json as locationData."
        ),
    )
    parser.add_argument(
        "--org-data-dir",
        type=Path,
        default=DEFAULT_ORG_DATA_DIR,
        help=f"Directory containing reviewed org JSON files (default: {DEFAULT_ORG_DATA_DIR})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit the number of cases run.",
    )
    parser.add_argument(
        "--location-filter",
        default="",
        help="Only run cases whose location contains this text.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="Request timeout in seconds.",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=1,
        help="Number of retries for transient HTTP 5xx or connection errors.",
    )
    parser.add_argument(
        "--retry-backoff",
        type=float,
        default=1.0,
        help="Initial retry backoff in seconds (doubles after each retry).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print normalized payloads without calling the API.",
    )
    parser.add_argument(
        "--dry-run-summary",
        action="store_true",
        help="Print compact normalized payload summaries without calling the API.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional file to write JSON results.",
    )
    parser.add_argument(
        "--fail-on-checks",
        action="store_true",
        help="Exit non-zero when expected text or assertion checks fail.",
    )
    return parser.parse_args()


def split_location(location: str) -> tuple[str, str]:
    parts = [part.strip() for part in location.split(",", maxsplit=1)]
    if len(parts) == 2:
        return parts[0], parts[1]
    return location.strip() or "Unknown Location", "Unknown Country"


def coerce_float(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def coerce_int(value: Any, default: int = 0) -> int:
    if value in (None, ""):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def normalize_hazard_ref(item: Any) -> dict[str, Any]:
    if isinstance(item, str):
        return {"hazardType": item, "otherHazardDetails": None}
    if not isinstance(item, dict):
        return {"hazardType": "OTHERS", "otherHazardDetails": str(item)}
    if "hazard" in item and isinstance(item["hazard"], dict):
        item = item["hazard"]
    return {
        "hazardType": item.get("hazardType", "OTHERS"),
        "otherHazardDetails": item.get("otherHazardDetails"),
    }


def normalize_sector(item: Any) -> dict[str, Any]:
    if isinstance(item, str):
        return {"sectorType": item, "otherSectorDetails": None}
    if not isinstance(item, dict):
        return {"sectorType": "OTHERS", "otherSectorDetails": str(item)}
    return {
        "sectorType": item.get("sectorType", "OTHERS"),
        "otherSectorDetails": item.get("otherSectorDetails"),
    }


def normalize_statistics(stats: Any) -> dict[str, Any]:
    if not isinstance(stats, dict):
        stats = {}
    return {
        "populationExposedValue": stats.get("populationExposedValue"),
        "populationExposedPercentage": stats.get("populationExposedPercentage"),
        "gdpAtRiskValue": stats.get("gdpAtRiskValue"),
        "gdpAtRiskPercentage": stats.get("gdpAtRiskPercentage"),
        "gdpAtRiskCurrencyCode": stats.get("gdpAtRiskCurrencyCode"),
        "vulnerableSectors": [
            normalize_sector(item) for item in stats.get("vulnerableSectors", [])
        ],
    }


def normalize_hazard_profile(item: Any, rank: int) -> dict[str, Any]:
    if not isinstance(item, dict):
        item = {}
    hazard = item.get("hazard") if isinstance(item.get("hazard"), dict) else item
    return {
        "hazard": normalize_hazard_ref(hazard),
        "hazardRank": coerce_int(item.get("hazardRank"), rank),
        "source": item.get("source"),
        "description": item.get("description"),
        "vulnerableGroups": item.get("vulnerableGroups", []),
        "proportionExposedRange": item.get("proportionExposedRange"),
        "impact": item.get("impact"),
        "mostExposedSectors": [
            normalize_sector(sector) for sector in item.get("mostExposedSectors", [])
        ],
    }


def normalize_action_status(item: Any) -> dict[str, Any] | None:
    if item in (None, ""):
        return None
    if isinstance(item, dict):
        status_type = item.get("statusType") or item.get("status")
        return {
            "statusType": status_type or "OTHERS",
            "otherStatusDetails": item.get("otherStatusDetails"),
        }
    if isinstance(item, str):
        mapped = STATUS_MAP.get(item.strip().lower())
        return {
            "statusType": mapped or "OTHERS",
            "otherStatusDetails": None if mapped else item,
        }
    return None


def normalize_goal(item: Any, index: int) -> dict[str, Any]:
    if not isinstance(item, dict):
        item = {}
    description = item.get("description")
    title = item.get("title") or description or f"Goal {index}"
    return {
        "title": title,
        "description": description,
        "hazardsAddressed": [
            normalize_hazard_ref(hazard) for hazard in item.get("hazardsAddressed", [])
        ],
        "metricIndicator": item.get("metricIndicator"),
        "comment": item.get("comment"),
        "baseYear": item.get("baseYear"),
        "targetYear": item.get("targetYear"),
    }


def normalize_action(item: Any, index: int) -> dict[str, Any]:
    if not isinstance(item, dict):
        item = {}
    return {
        "title": item.get("title") or f"Action {index}",
        "status": normalize_action_status(item.get("status")),
        "coBenefits": item.get("coBenefits", []),
        "hazardsAddressed": [
            normalize_hazard_ref(hazard) for hazard in item.get("hazardsAddressed", [])
        ],
        "totalCostUsd": item.get("totalCostUsd"),
        "timeframe": item.get("timeframe"),
        "description": item.get("description"),
        "resilienceEnhanced": item.get("resilienceEnhanced"),
        "impactedSectors": [
            normalize_sector(sector) for sector in item.get("impactedSectors", [])
        ],
    }


def normalize_project(item: Any, index: int) -> dict[str, Any]:
    if not isinstance(item, dict):
        item = {}
    status = item.get("status")
    if isinstance(status, str):
        status = STATUS_MAP.get(status.strip().lower(), status)
    return {
        "title": item.get("title") or f"Project {index}",
        "status": status,
        "description": item.get("description"),
        "projectArea": item.get("projectArea"),
        "financeStatus": item.get("financeStatus"),
        "financeModel": item.get("financeModel"),
        "fundedPercent": item.get("fundedPercent"),
        "totalAmount": item.get("totalAmount"),
        "totalNeeded": item.get("totalNeeded"),
    }


def truncate_text(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    if len(value) <= MAX_CONTEXT_TEXT_CHARS:
        return value
    return value[: MAX_CONTEXT_TEXT_CHARS - 20].rstrip() + "... [truncated]"


def build_data_provenance(data: dict[str, Any]) -> dict[str, Any]:
    hazards = data.get("hazards") or {}
    stats = hazards.get("statistics") if isinstance(hazards, dict) else {}
    has_aggregate_stats = isinstance(stats, dict) and any(
        stats.get(key) is not None
        for key in (
            "populationExposedValue",
            "populationExposedPercentage",
            "gdpAtRiskValue",
            "gdpAtRiskPercentage",
        )
    )
    has_hazard_ordering = any(
        isinstance(hazard, dict) and hazard.get("hazardRank") is not None
        for hazard in (hazards.get("hazards", []) if isinstance(hazards, dict) else [])
    )
    return {
        "contextShape": "Endpoint-shaped platform data derived from selected location data; not a verbatim public disclosure export.",
        "aggregateStatistics": (
            "Aggregate structured values for the location; do not apply them to every hazard unless per-hazard rows support that."
            if has_aggregate_stats
            else "No aggregate exposure or GDP-at-risk statistic is present in the selected context."
        ),
        "hazardOrdering": (
            "Hazard ordering is platform structured ordering, not an official jurisdiction-provided ranking unless explicitly stated elsewhere."
            if has_hazard_ordering
            else "No formal hazard ranking evidence is present in the selected context."
        ),
        "contextTrimming": "Long text fields and peer solution examples may be shortened for evaluation payload size.",
    }


def normalize_solutions(data: dict[str, Any]) -> dict[str, Any]:
    solutions = (data.get("solutions") or {}).get("solutions", {})
    if not isinstance(solutions, dict):
        return {"solutions": {}}

    trimmed_categories = {}
    for category, cards in solutions.items():
        if not isinstance(cards, list):
            continue
        trimmed_cards = [
            normalize_solution_card(card)
            for card in cards[:MAX_SOLUTION_CARDS_PER_CATEGORY]
            if isinstance(card, dict)
        ]
        if trimmed_cards:
            trimmed_categories[category] = trimmed_cards
    return {
        "solutions": trimmed_categories,
        "trimmingNote": (
            f"Showing up to {MAX_SOLUTION_CARDS_PER_CATEGORY} solution cards per "
            f"category and {MAX_PEER_ACTIONS_PER_SOLUTION} peer examples per card."
        ),
    }


def normalize_solution_card(card: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        "solution": card.get("solution"),
        "solutionCategory": card.get("solutionCategory"),
        "hazardFilter": card.get("hazardFilter"),
        "hasLocalAction": card.get("hasLocalAction"),
        "pctPeerTakingAction": card.get("pctPeerTakingAction"),
        "solutionHazardsAddressed": [
            normalize_hazard_ref(hazard)
            for hazard in card.get("solutionHazardsAddressed", [])
        ],
    }
    peer_actions = card.get("peerActions")
    if isinstance(peer_actions, list):
        normalized["peerActions"] = [
            normalize_peer_action(item)
            for item in peer_actions[:MAX_PEER_ACTIONS_PER_SOLUTION]
            if isinstance(item, dict)
        ]
    return normalized


def normalize_peer_action(item: dict[str, Any]) -> dict[str, Any]:
    action = item.get("action") if isinstance(item.get("action"), dict) else {}
    return {
        "peerName": item.get("peerName"),
        "action": {
            "title": action.get("title"),
            "status": normalize_action_status(action.get("status")),
            "timeframe": action.get("timeframe"),
            "description": truncate_text(action.get("description")),
            "hazardsAddressed": [
                normalize_hazard_ref(hazard)
                for hazard in action.get("hazardsAddressed", [])
            ],
            "coBenefits": action.get("coBenefits", [])[:5],
            "resilienceEnhanced": action.get("resilienceEnhanced", [])[:5],
        },
    }


def normalize_location_profile(
    data: dict[str, Any], fallback_location: str = ""
) -> dict[str, Any]:
    data = data or {}
    fallback_name, fallback_country = split_location(fallback_location)
    hazards_input = data.get("hazards", {})
    if isinstance(hazards_input, list):
        hazards_input = {"hazards": hazards_input}

    if any(key in data for key in ("goals", "actions", "projects")):
        government_input = {
            "goals": data.get("goals", []),
            "actions": data.get("actions", []),
            "projects": data.get("projects", []),
        }
    else:
        government_input = (
            data.get("governmentActions") or data.get("government_actions") or {}
        )

    return {
        "organizationId": data.get("organizationId"),
        "name": data.get("name") or fallback_name,
        "countryName": data.get("countryName") or fallback_country,
        "disclosureYear": data.get("disclosureYear"),
        "lat": coerce_float(data.get("lat"), 0.0),
        "lng": coerce_float(data.get("lng"), 0.0),
        "geometry": data.get("geometry") or {},
        "isReportingLeader": bool(data.get("isReportingLeader", False)),
        "hazards": {
            "statistics": normalize_statistics(hazards_input.get("statistics", {})),
            "hazards": [
                normalize_hazard_profile(item, index)
                for index, item in enumerate(hazards_input.get("hazards", []), start=1)
            ],
        },
        "governmentActions": {
            "goals": [
                normalize_goal(item, index)
                for index, item in enumerate(government_input.get("goals", []), start=1)
            ],
            "actions": [
                normalize_action(item, index)
                for index, item in enumerate(
                    government_input.get("actions", []), start=1
                )
            ],
            "projects": [
                normalize_project(item, index)
                for index, item in enumerate(
                    government_input.get("projects", []), start=1
                )
            ],
        },
        "solutions": {
            **normalize_solutions(data),
        },
        "dataProvenance": build_data_provenance(data),
    }


def parse_jsonish(text: str) -> dict[str, Any]:
    candidate = text.strip()
    if not candidate:
        return {}

    attempts = [candidate]
    if not candidate.startswith("{"):
        attempts.append("{" + candidate + "}")
    if candidate.startswith('"') and candidate.endswith('"'):
        attempts.append(candidate[1:-1])
        attempts.append("{" + candidate[1:-1] + "}")

    for attempt in attempts:
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            continue

    raise ValueError("Could not parse JSON-like content")


def _load_org_location_data(org_id: int, org_data_dir: Path) -> dict[str, Any]:
    org_data_path = org_data_dir / f"{org_id}.json"
    return json.loads(org_data_path.read_text(encoding="utf-8"))


def _case_org_id(case: dict[str, Any]) -> int | None:
    org_id = case.get("orgId", case.get("accountId", case.get("org_id")))
    if org_id in (None, ""):
        return None
    return int(org_id)


def load_cases_from_json(
    cases_file: Path,
    org_data_dir: Path = DEFAULT_ORG_DATA_DIR,
) -> list[dict[str, Any]]:
    payload = json.loads(cases_file.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        shared_location_data = payload.get("locationData")
        cases = payload.get("cases", [])
        default_location = payload.get("location") or ""
    else:
        shared_location_data = None
        cases = payload
        default_location = ""

    normalized_cases = []
    for index, raw_case in enumerate(cases, start=1):
        case = raw_case if isinstance(raw_case, dict) else {}
        location = case.get("location") or default_location or ""
        org_id = _case_org_id(case)
        location_data = case.get("locationData") or shared_location_data
        if location_data is None and org_id is not None:
            location_data = _load_org_location_data(org_id, org_data_dir)
        if location_data is None:
            location_data = {}
        normalized_cases.append(
            {
                "id": case.get("id") or f"case-{index}",
                "orgId": org_id,
                "location": location,
                "questionType": case.get("questionType", ""),
                "question": case["question"],
                "expectedContains": case.get("expectedContains", []),
                "assertions": case.get("assertions", {}),
                "review": case.get("review", ""),
                "sourceFile": case.get("sourceFile", ""),
                "sourceRow": case.get("sourceRow"),
                "locationData": normalize_location_profile(location_data, location),
            }
        )
    return normalized_cases


def load_cases_from_questions_file(
    questions_file: Path = DEFAULT_QUESTIONS_FILE,
    org_data_dir: Path = DEFAULT_ORG_DATA_DIR,
) -> list[dict[str, Any]]:
    return load_cases_from_json(questions_file, org_data_dir)


def load_cases_from_csv(csv_file: Path) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    with csv_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            question = (row.get("Question") or "").strip()
            location = (row.get("Location") or "").strip()
            relevant_data_raw = row.get("Relevant Data") or ""
            if not question or not location or not relevant_data_raw.strip():
                continue
            try:
                relevant_data = parse_jsonish(relevant_data_raw)
                location_data = normalize_location_profile(relevant_data, location)
            except ValueError:
                continue

            expected = (row.get("Answer") or "").strip()
            cases.append(
                {
                    "id": row.get("ID") or f"csv-{len(cases) + 1}",
                    "location": location,
                    "questionType": row.get("Question Type") or "",
                    "question": question,
                    "expectedContains": [expected] if expected else [],
                    "locationData": location_data,
                }
            )
    return cases


def load_cases_from_reviewed_comments(
    comments_csv: Path = DEFAULT_COMMENTS_CSV,
    org_data_dir: Path = DEFAULT_ORG_DATA_DIR,
) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    with comments_csv.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            question = (row.get("question") or "").strip()
            org_id_raw = (row.get("org_id") or "").strip()
            if not question or not org_id_raw:
                continue

            org_id = int(org_id_raw)
            location_data = _load_org_location_data(org_id, org_data_dir)
            location = (
                row.get("page_or_jurisdiction")
                or ", ".join(
                    item
                    for item in (
                        row.get("matched_organization"),
                        row.get("matched_country_or_area"),
                    )
                    if item
                )
            )
            source_row = row.get("source_row") or str(len(cases) + 1)
            cases.append(
                {
                    "id": f"reviewed-{org_id}-{source_row}",
                    "sourceFile": row.get("source_file", ""),
                    "sourceRow": source_row,
                    "location": location,
                    "questionType": "reviewed-comment",
                    "question": question,
                    "expectedContains": [],
                    "review": row.get("review", ""),
                    "locationData": normalize_location_profile(location_data, location),
                }
            )
    return cases


def filter_cases(
    cases: list[dict[str, Any]], location_filter: str, limit: int
) -> list[dict[str, Any]]:
    filtered = cases
    if location_filter:
        needle = location_filter.lower()
        filtered = [case for case in filtered if needle in case["location"].lower()]
    if limit > 0:
        filtered = filtered[:limit]
    return filtered


def post_chat_completion(
    base_url: str,
    endpoint: str,
    payload: dict[str, Any],
    timeout: int,
    retries: int = 0,
    retry_backoff: float = 1.0,
) -> dict[str, Any]:
    url = base_url.rstrip("/") + endpoint
    body = json.dumps(payload).encode("utf-8")
    attempts = retries + 1
    for attempt in range(attempts):
        req = request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            if exc.code < 500 or attempt == attempts - 1:
                raise
            time.sleep(retry_backoff * (2**attempt))
        except error.URLError:
            if attempt == attempts - 1:
                raise
            time.sleep(retry_backoff * (2**attempt))

    raise RuntimeError("unreachable")


def score_case(
    answer: str,
    expected_contains: list[str],
    assertions: dict[str, Any] | None = None,
) -> dict[str, Any]:
    assertions = assertions or {}
    matched = []
    missing = []
    answer_lower = answer.lower()
    for item in expected_contains:
        if item.lower() in answer_lower:
            matched.append(item)
        else:
            missing.append(item)

    required_all = assertions.get("requiredAll", [])
    assertion_matched = []
    assertion_missing = []
    for item in required_all:
        if item.lower() in answer_lower:
            assertion_matched.append(item)
        else:
            assertion_missing.append(item)

    required_any = assertions.get("requiredAny", [])
    matched_any = [item for item in required_any if item.lower() in answer_lower]
    missing_any = []
    if required_any and not matched_any:
        missing_any = required_any

    required_any_groups = assertions.get("requiredAnyGroups", [])
    matched_any_groups = []
    missing_any_groups = []
    for group in required_any_groups:
        group_matches = [item for item in group if item.lower() in answer_lower]
        if group_matches:
            matched_any_groups.append(group_matches)
        else:
            missing_any_groups.append(group)

    forbidden = assertions.get("forbidden", [])
    forbidden_found = [item for item in forbidden if item.lower() in answer_lower]

    has_checks = bool(
        expected_contains
        or required_all
        or required_any
        or required_any_groups
        or forbidden
    )
    passed = None
    if has_checks:
        passed = not (
            missing
            or assertion_missing
            or missing_any
            or missing_any_groups
            or forbidden_found
        )

    return {
        "passed": passed,
        "matched": matched,
        "missing": missing,
        "assertions": {
            "matchedAll": assertion_matched,
            "missingAll": assertion_missing,
            "matchedAny": matched_any,
            "missingAny": missing_any,
            "matchedAnyGroups": matched_any_groups,
            "missingAnyGroups": missing_any_groups,
            "forbiddenFound": forbidden_found,
        },
    }


def count_solution_cards(solutions: dict[str, Any]) -> int:
    solution_groups = (solutions or {}).get("solutions", {})
    if not isinstance(solution_groups, dict):
        return 0
    return sum(len(cards) for cards in solution_groups.values() if isinstance(cards, list))


def count_peer_actions(solutions: dict[str, Any]) -> int:
    solution_groups = (solutions or {}).get("solutions", {})
    if not isinstance(solution_groups, dict):
        return 0
    total = 0
    for cards in solution_groups.values():
        if not isinstance(cards, list):
            continue
        for card in cards:
            if isinstance(card, dict) and isinstance(card.get("peerActions"), list):
                total += len(card["peerActions"])
    return total


def build_payload_summary(case: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    location_data = payload.get("locationData") or {}
    hazards = location_data.get("hazards") or {}
    government_actions = location_data.get("governmentActions") or {}
    solutions = location_data.get("solutions") or {}
    payload_bytes = len(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    provenance = location_data.get("dataProvenance") or {}
    return {
        "id": case["id"],
        "orgId": case.get("orgId") or location_data.get("organizationId"),
        "location": case["location"],
        "question": case["question"],
        "payloadBytes": payload_bytes,
        "counts": {
            "hazards": len(hazards.get("hazards", [])),
            "goals": len(government_actions.get("goals", [])),
            "actions": len(government_actions.get("actions", [])),
            "projects": len(government_actions.get("projects", [])),
            "solutionCards": count_solution_cards(solutions),
            "peerActions": count_peer_actions(solutions),
        },
        "provenance": {
            "aggregateStatistics": provenance.get("aggregateStatistics"),
            "hazardOrdering": provenance.get("hazardOrdering"),
            "contextTrimming": provenance.get("contextTrimming"),
        },
    }


def run_cases(args: argparse.Namespace) -> int:
    if args.questions_file:
        cases = load_cases_from_questions_file(args.questions_file, args.org_data_dir)
    elif args.comments_csv:
        cases = load_cases_from_reviewed_comments(args.comments_csv, args.org_data_dir)
    elif args.csv_file:
        cases = load_cases_from_csv(args.csv_file)
    else:
        cases = load_cases_from_json(args.cases_file)
    cases = filter_cases(cases, args.location_filter, args.limit)

    if not cases:
        print("No cases found.", file=sys.stderr)
        return 1

    results = []
    failed_check_ids = []
    for case in cases:
        payload = {
            "messages": [{"role": "user", "content": case["question"]}],
            "locationData": case["locationData"],
        }

        print(f"\n[{case['id']}] {case['location']} :: {case['question']}")
        if args.dry_run_summary:
            summary = build_payload_summary(case, payload)
            print(json.dumps(summary, indent=2, ensure_ascii=False))
            results.append(summary)
            continue

        if args.dry_run:
            print(json.dumps(payload, indent=2))
            results.append({"id": case["id"], "payload": payload})
            continue

        try:
            response = post_chat_completion(
                args.base_url,
                args.endpoint,
                payload,
                args.timeout,
                retries=args.retries,
                retry_backoff=args.retry_backoff,
            )
            answer = (
                response.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            score = score_case(
                answer,
                case["expectedContains"],
                assertions=case.get("assertions", {}),
            )
            status_text = "PASS" if score["passed"] is not False else "CHECK"
            print(f"Status: {status_text}")
            print(f"Answer: {answer}\n")
            if score["passed"] is not None:
                print(
                    f"Matched: {len(score['matched'])} | Missing: {len(score['missing'])}"
                )
                assertion_score = score["assertions"]
                assertion_issues = (
                    assertion_score["missingAll"]
                    or assertion_score["missingAny"]
                    or assertion_score["missingAnyGroups"]
                    or assertion_score["forbiddenFound"]
                )
                if assertion_issues:
                    print(f"Assertion issues: {json.dumps(assertion_score)}")
                if score["passed"] is False:
                    failed_check_ids.append(case["id"])
            results.append(
                {
                    "id": case["id"],
                    "orgId": case.get("orgId"),
                    "location": case["location"],
                    "question": case["question"],
                    "review": case.get("review", ""),
                    "answer": answer,
                    "score": score,
                }
            )
        except error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            print(f"HTTP {exc.code}: {error_body}", file=sys.stderr)
            results.append(
                {
                    "id": case["id"],
                    "location": case["location"],
                    "question": case["question"],
                    "error": {"status": exc.code, "body": error_body},
                }
            )
        except error.URLError as exc:
            print(f"Connection error: {exc}", file=sys.stderr)
            return 1

    if args.output:
        args.output.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print(f"Wrote results to {args.output}")

    if args.fail_on_checks and failed_check_ids:
        print(
            f"Failed answer checks: {', '.join(failed_check_ids)}",
            file=sys.stderr,
        )
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(run_cases(parse_args()))
