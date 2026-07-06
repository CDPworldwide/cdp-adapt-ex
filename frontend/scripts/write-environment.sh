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
GOOGLE_ANALYTICS_MEASUREMENT_ID="${FRONTEND_GOOGLE_ANALYTICS_MEASUREMENT_ID:-}"
GOOGLE_ANALYTICS_ENABLED="${FRONTEND_GOOGLE_ANALYTICS_ENABLED:-false}"
POSTHOG_KEY="${FRONTEND_POSTHOG_KEY:-}"
POSTHOG_HOST="${FRONTEND_POSTHOG_HOST:-/_cdp}"
POSTHOG_UI_HOST="${FRONTEND_POSTHOG_UI_HOST:-https://eu.posthog.com}"
POSTHOG_ENABLED="${FRONTEND_POSTHOG_ENABLED:-false}"
POSTHOG_SESSION_REPLAY_ENABLED="${FRONTEND_POSTHOG_SESSION_REPLAY_ENABLED:-true}"
SENTRY_DSN="${FRONTEND_SENTRY_DSN:-}"
SENTRY_ENABLED="${FRONTEND_SENTRY_ENABLED:-false}"
SENTRY_ENVIRONMENT="${FRONTEND_SENTRY_ENVIRONMENT:-production}"
SENTRY_RELEASE="${FRONTEND_SENTRY_RELEASE:-}"
SENTRY_TRACES_SAMPLE_RATE="${FRONTEND_SENTRY_TRACES_SAMPLE_RATE:-0.05}"

write_environment_file() {
  local output_path="$1"
  local production_flag="$2"

  cat > "$output_path" <<EOF
export const environment = {
  production: ${production_flag},
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
  googleAnalytics: {
    measurementId: '${GOOGLE_ANALYTICS_MEASUREMENT_ID}',
    enabled: ${GOOGLE_ANALYTICS_ENABLED},
  },
  posthog: {
    key: '${POSTHOG_KEY}',
    host: '${POSTHOG_HOST}',
    uiHost: '${POSTHOG_UI_HOST}',
    enabled: ${POSTHOG_ENABLED},
    sessionReplayEnabled: ${POSTHOG_SESSION_REPLAY_ENABLED},
  },
  sentry: {
    dsn: '${SENTRY_DSN}',
    enabled: ${SENTRY_ENABLED},
    environment: '${SENTRY_ENVIRONMENT}',
    release: '${SENTRY_RELEASE}',
    tracesSampleRate: ${SENTRY_TRACES_SAMPLE_RATE},
  },
};
EOF
}

write_environment_file src/environments/environment.ts true
write_environment_file src/environments/environment.development.ts false
