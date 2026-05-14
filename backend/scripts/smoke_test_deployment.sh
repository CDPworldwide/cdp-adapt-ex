#!/usr/bin/env bash
set -euo pipefail

: "${BACKEND_URL:?BACKEND_URL is required}"
: "${BACKEND_API_KEY:?BACKEND_API_KEY is required}"

SMOKE_TEST_LOCATION_ORG_ID="${SMOKE_TEST_LOCATION_ORG_ID:-834406}"
SMOKE_TEST_LOCATION_EXPECTED_STATUS="${SMOKE_TEST_LOCATION_EXPECTED_STATUS:-}"
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

echo "Backend deployment smoke tests passed: health=${health_status}, location=${location_status}"
