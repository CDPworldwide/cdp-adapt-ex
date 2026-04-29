#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${FRONTEND_BASE_URL:-http://127.0.0.1:8000}"
API_KEY="${FRONTEND_API_KEY:-}"
API_KEY_HEADER_NAME="${FRONTEND_API_KEY_HEADER_NAME:-X-API-Key}"
AUTH_DISABLED="${FRONTEND_AUTH_DISABLED:-false}"
DEBUG_MODE="${FRONTEND_DEBUG_MODE:-true}"
MAPS_API_KEY="${FRONTEND_MAPS_API_KEY:-}"

cat > src/environments/environment.ts <<EOF
export const environment = {
  production: true,
  baseUrl: '${BASE_URL}',
  apiKey: '${API_KEY}',
  apiKeyHeaderName: '${API_KEY_HEADER_NAME}',
  authDisabled: ${AUTH_DISABLED},
  isDebugMode: ${DEBUG_MODE},
  mapsConfig: {
    apiKey: '${MAPS_API_KEY}',
  },
};
EOF
