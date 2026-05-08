#!/usr/bin/env bash

set -euo pipefail

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BASE_URL="${FRONTEND_BASE_URL:-http://127.0.0.1:8000}"
AI_SERVER_URL="${AI_SERVER_URL:-${FRONTEND_AI_SERVER_URL:-http://127.0.0.1:8088}}"
API_KEY="${FRONTEND_API_KEY:-}"
API_KEY_HEADER_NAME="${FRONTEND_API_KEY_HEADER_NAME:-X-API-Key}"
AI_SERVER_API_KEY="${FRONTEND_AI_SERVER_API_KEY:-${AI_SERVER_API_KEY:-${API_KEY}}}"
AI_SERVER_API_KEY_HEADER_NAME="${FRONTEND_AI_SERVER_API_KEY_HEADER_NAME:-${AI_SERVER_API_KEY_HEADER_NAME:-X-API-Key}}"
AUTH_DISABLED="${FRONTEND_AUTH_DISABLED:-false}"
DEBUG_MODE="${FRONTEND_DEBUG_MODE:-true}"
MAPS_API_KEY="${FRONTEND_MAPS_API_KEY:-}"

cat > src/environments/environment.ts <<EOF
export const environment = {
  production: true,
  baseUrl: '${BASE_URL}',
  aiServerUrl: '${AI_SERVER_URL}',
  aiModel: 'cdp-gemini',
  apiKey: '${API_KEY}',
  apiKeyHeaderName: '${API_KEY_HEADER_NAME}',
  aiServerApiKey: '${AI_SERVER_API_KEY}',
  aiServerApiKeyHeaderName: '${AI_SERVER_API_KEY_HEADER_NAME}',
  authDisabled: ${AUTH_DISABLED},
  isDebugMode: ${DEBUG_MODE},
  mapsConfig: {
    apiKey: '${MAPS_API_KEY}',
  },
};
EOF
