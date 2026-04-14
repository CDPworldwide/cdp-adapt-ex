#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$CLIENT_DIR")"
BACKEND_DIR="${PROJECT_ROOT}/backend"

BACKEND_PORT="${BACKEND_PORT:-4352}"
API_URL="${API_URL:-http://127.0.0.1:${BACKEND_PORT}}"
OPENAPI_URL="${API_URL}/openapi.json"
BACKEND_PID=""
BACKEND_LOG=""

cleanup() {
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "Stopping temporary backend (pid $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

fetch_openapi() {
    curl -sf "$OPENAPI_URL" -o openapi.json
}

start_backend() {
    BACKEND_LOG="$(mktemp -t pac-api-client-generate.XXXXXX.log)"

    echo "Starting backend on port ${BACKEND_PORT}..."
    (
        cd "$BACKEND_DIR"
        export SKIP_DATABASE_INIT=true
        exec uv run uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
    ) >"$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!

    echo "Waiting for backend to become ready..."
    for _ in $(seq 1 30); do
        if curl -sf "$OPENAPI_URL" -o openapi.json; then
            echo "Successfully fetched OpenAPI spec"
            return 0
        fi

        if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            echo "Backend failed to start. Log output:"
            cat "$BACKEND_LOG"
            return 1
        fi

        sleep 1
    done

    echo "Backend did not become ready within 30 seconds. Log output:"
    cat "$BACKEND_LOG"
    return 1
}

cd "$CLIENT_DIR"

echo "Fetching OpenAPI spec from ${OPENAPI_URL}..."

if fetch_openapi; then
    echo "Successfully fetched OpenAPI spec"
else
    echo "Warning: Could not fetch from ${OPENAPI_URL}"
    start_backend
fi

echo "Generating TypeScript client..."
npm run generate

echo "Client generation complete!"
echo "Run 'npm run build' to compile TypeScript"
