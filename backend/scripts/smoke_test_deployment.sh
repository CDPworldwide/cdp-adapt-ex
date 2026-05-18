#!/usr/bin/env bash
set -euo pipefail

: "${BACKEND_URL:?BACKEND_URL is required}"
: "${BACKEND_API_KEY:?BACKEND_API_KEY is required}"

SMOKE_TEST_LOCATION_ORG_ID="${SMOKE_TEST_LOCATION_ORG_ID:-834406}"
SMOKE_TEST_LOCATION_EXPECTED_STATUS="${SMOKE_TEST_LOCATION_EXPECTED_STATUS:-}"
SMOKE_TEST_TRANSLATION_ORG_ID="${SMOKE_TEST_TRANSLATION_ORG_ID:-$SMOKE_TEST_LOCATION_ORG_ID}"
SMOKE_TEST_TRANSLATION_TARGET_LANGUAGE="${SMOKE_TEST_TRANSLATION_TARGET_LANGUAGE:-}"
BACKEND_URL="${BACKEND_URL%/}"

request_status() {
  local url="$1"
  local body_file="$2"
  local status

  if ! status="$(curl -sS -o "$body_file" -w "%{http_code}" \
    -H "X-API-Key: ${BACKEND_API_KEY}" \
    "$url")"; then
    echo "000"
    return
  fi

  echo "$status"
}

health_body="$(mktemp)"
health_status="$(request_status "${BACKEND_URL}/api/v1/health" "$health_body")"
if [ "$health_status" != "200" ]; then
  echo "Backend health check failed: ${BACKEND_URL}/api/v1/health -> HTTP ${health_status}"
  sed -n '1,40p' "$health_body"
  exit 1
fi

location_url="${BACKEND_URL}/api/v1/locations/id/${SMOKE_TEST_LOCATION_ORG_ID}"
location_body="$(mktemp)"
location_status="$(request_status "$location_url" "$location_body")"

case "$location_status" in
  5* | 000)
    echo "Location smoke test failed: ${location_url} -> HTTP ${location_status}"
    sed -n '1,80p' "$location_body"
    exit 1
    ;;
esac

if [ -n "$SMOKE_TEST_LOCATION_EXPECTED_STATUS" ] &&
  [ "$location_status" != "$SMOKE_TEST_LOCATION_EXPECTED_STATUS" ]; then
  echo "Location smoke test returned unexpected status: ${location_url} -> HTTP ${location_status}, expected ${SMOKE_TEST_LOCATION_EXPECTED_STATUS}"
  sed -n '1,80p' "$location_body"
  exit 1
fi

if [ -n "$SMOKE_TEST_TRANSLATION_TARGET_LANGUAGE" ]; then
  translation_url="${BACKEND_URL}/api/v1/locations/id/${SMOKE_TEST_TRANSLATION_ORG_ID}?target_language=${SMOKE_TEST_TRANSLATION_TARGET_LANGUAGE}"
  translation_body="$(mktemp)"
  translation_status="$(request_status "$translation_url" "$translation_body")"

  if [ "$translation_status" != "200" ]; then
    echo "Translated location smoke test failed: ${translation_url} -> HTTP ${translation_status}"
    sed -n '1,80p' "$translation_body"
    exit 1
  fi

  python3 - "$translation_body" "$SMOKE_TEST_TRANSLATION_TARGET_LANGUAGE" <<'PY'
import json
import sys

body_path, expected_language = sys.argv[1], sys.argv[2]
with open(body_path, encoding="utf-8") as body:
    payload = json.load(body)

reporting_language = payload.get("location", {}).get("reportingLanguage")
if reporting_language != expected_language:
    print(
        "Translated location smoke test returned reportingLanguage="
        f"{reporting_language!r}, expected {expected_language!r}"
    )
    sys.exit(1)
PY
fi

if [ -n "$SMOKE_TEST_TRANSLATION_TARGET_LANGUAGE" ]; then
  echo "Backend deployment smoke tests passed: health=${health_status}, location=${location_status}, translated_location=${translation_status}"
else
  echo "Backend deployment smoke tests passed: health=${health_status}, location=${location_status}"
fi
