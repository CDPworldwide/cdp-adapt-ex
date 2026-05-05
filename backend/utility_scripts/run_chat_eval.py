#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any
from urllib import error, request

DEFAULT_BASE_URL = "http://127.0.0.1:8088"
DEFAULT_ENDPOINT = "/v1/chat/completions"
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CASES_FILE = SCRIPT_DIR / "chat_eval_cases.json"

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
        "--csv-file",
        type=Path,
        help="Optional CSV file with Question / Location / Relevant Data columns.",
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
        "--dry-run",
        action="store_true",
        help="Print normalized payloads without calling the API.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional file to write JSON results.",
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
        "name": data.get("name") or fallback_name,
        "countryName": data.get("countryName") or fallback_country,
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
            "solutions": (data.get("solutions") or {}).get("solutions", {}),
        },
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


def load_cases_from_json(cases_file: Path) -> list[dict[str, Any]]:
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
        location_data = case.get("locationData") or shared_location_data or {}
        normalized_cases.append(
            {
                "id": case.get("id") or f"case-{index}",
                "location": location,
                "questionType": case.get("questionType", ""),
                "question": case["question"],
                "expectedContains": case.get("expectedContains", []),
                "locationData": normalize_location_profile(location_data, location),
            }
        )
    return normalized_cases


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
    base_url: str, endpoint: str, payload: dict[str, Any], timeout: int
) -> dict[str, Any]:
    url = base_url.rstrip("/") + endpoint
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def score_case(answer: str, expected_contains: list[str]) -> dict[str, Any]:
    if not expected_contains:
        return {"passed": None, "matched": [], "missing": []}
    matched = []
    missing = []
    answer_lower = answer.lower()
    for item in expected_contains:
        if item.lower() in answer_lower:
            matched.append(item)
        else:
            missing.append(item)
    return {"passed": not missing, "matched": matched, "missing": missing}


def run_cases(args: argparse.Namespace) -> int:
    cases = (
        load_cases_from_csv(args.csv_file)
        if args.csv_file
        else load_cases_from_json(args.cases_file)
    )
    cases = filter_cases(cases, args.location_filter, args.limit)

    if not cases:
        print("No cases found.", file=sys.stderr)
        return 1

    results = []
    for case in cases:
        payload = {
            "messages": [{"role": "user", "content": case["question"]}],
            "locationData": case["locationData"],
        }

        print(f"\n[{case['id']}] {case['location']} :: {case['question']}")
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
            )
            answer = (
                response.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            score = score_case(answer, case["expectedContains"])
            status_text = "PASS" if score["passed"] is not False else "CHECK"
            print(f"Status: {status_text}")
            print(f"Answer: {answer}\n")
            if score["passed"] is not None:
                print(
                    f"Matched: {len(score['matched'])} | Missing: {len(score['missing'])}"
                )
            results.append(
                {
                    "id": case["id"],
                    "location": case["location"],
                    "question": case["question"],
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

    return 0


if __name__ == "__main__":
    raise SystemExit(run_cases(parse_args()))
