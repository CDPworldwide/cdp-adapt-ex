#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$BACKEND_DIR/.env}"
EXPLICIT_POSTGRES_PORT="${POSTGRES_PORT:-}"
EXPLICIT_CLOUD_SQL_PROXY_PORT="${CLOUD_SQL_PROXY_PORT:-}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

CONTAINER_NAME="${CLOUD_SQL_PROXY_CONTAINER_NAME:-pac-cloud-sql-proxy}"
INSTANCE_CONNECTION_NAME="${CLOUD_SQL_INSTANCE_CONNECTION_NAME:-project-bb4fd058-24e7-4ccb-b06:us-central1:cdp-test}"
PROXY_IMAGE="${CLOUD_SQL_PROXY_IMAGE:-gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.21.2}"
PROXY_RUNTIME="${CLOUD_SQL_PROXY_RUNTIME:-auto}"
LOCAL_HOST="${POSTGRES_HOST:-127.0.0.1}"
LOCAL_PORT="${EXPLICIT_CLOUD_SQL_PROXY_PORT:-${EXPLICIT_POSTGRES_PORT:-55432}}"
CONTAINER_PORT="${CLOUD_SQL_PROXY_CONTAINER_PORT:-5432}"

if ! command -v gcloud >/dev/null 2>&1; then
  printf 'gcloud is required to mint an access token for Cloud SQL proxy.\n' >&2
  exit 1
fi

if [ -z "$INSTANCE_CONNECTION_NAME" ]; then
  printf 'CLOUD_SQL_INSTANCE_CONNECTION_NAME is required.\n' >&2
  exit 1
fi

case "$LOCAL_HOST" in
  localhost|127.0.0.1|0.0.0.0)
    ;;
  *)
    printf 'Warning: POSTGRES_HOST=%s is not a local host; publishing proxy on 127.0.0.1:%s anyway.\n' "$LOCAL_HOST" "$LOCAL_PORT" >&2
    ;;
esac

if command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$LOCAL_PORT" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  printf 'Port %s is already in use. Set CLOUD_SQL_PROXY_PORT to choose another port.\n' "$LOCAL_PORT" >&2
  exit 1
fi

printf 'Starting Cloud SQL proxy for %s on 127.0.0.1:%s\n' "$INSTANCE_CONNECTION_NAME" "$LOCAL_PORT" >&2

if [ "$PROXY_RUNTIME" = "native" ] || {
  [ "$PROXY_RUNTIME" = "auto" ] && command -v cloud-sql-proxy >/dev/null 2>&1
}; then
  if ! command -v cloud-sql-proxy >/dev/null 2>&1; then
    printf 'cloud-sql-proxy is not installed. Set CLOUD_SQL_PROXY_RUNTIME=docker to use Docker.\n' >&2
    exit 1
  fi

  exec cloud-sql-proxy \
    --token "$(gcloud auth print-access-token)" \
    --address 127.0.0.1 \
    --port "$LOCAL_PORT" \
    "$INSTANCE_CONNECTION_NAME"
fi

if ! command -v docker >/dev/null 2>&1; then
  printf 'docker is required to run the Cloud SQL proxy container.\n' >&2
  exit 1
fi

DOCKER_CONTEXT_ARGS=()
DOCKER_CONTEXT_NAME="${CLOUD_SQL_PROXY_DOCKER_CONTEXT:-${DOCKER_CONTEXT:-}}"
if [ -z "$DOCKER_CONTEXT_NAME" ] && docker context ls --format '{{.Name}}' | grep -Fxq 'orbstack'; then
  DOCKER_CONTEXT_NAME="orbstack"
fi
if [ -n "$DOCKER_CONTEXT_NAME" ]; then
  DOCKER_CONTEXT_ARGS=(--context "$DOCKER_CONTEXT_NAME")
fi

if ! docker "${DOCKER_CONTEXT_ARGS[@]}" info >/dev/null 2>&1; then
  if [ "$DOCKER_CONTEXT_NAME" = "orbstack" ]; then
    printf 'OrbStack Docker context is configured, but OrbStack is not reachable. Start OrbStack and retry.\n' >&2
  else
    printf 'Docker is installed, but the Docker daemon is not reachable. Start Docker and retry.\n' >&2
  fi
  exit 1
fi

if docker "${DOCKER_CONTEXT_ARGS[@]}" ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  docker "${DOCKER_CONTEXT_ARGS[@]}" rm -f "$CONTAINER_NAME" >/dev/null
fi

exec docker "${DOCKER_CONTEXT_ARGS[@]}" run --rm \
  --name "$CONTAINER_NAME" \
  -p "127.0.0.1:${LOCAL_PORT}:${CONTAINER_PORT}" \
  "$PROXY_IMAGE" \
  --token "$(gcloud auth print-access-token)" \
  --address 0.0.0.0 \
  --port "$CONTAINER_PORT" \
  "$INSTANCE_CONNECTION_NAME"
